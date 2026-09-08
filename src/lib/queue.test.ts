import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  claimNextRecordForUser,
  claimPreviousInFile,
  completeRecord,
  OwnershipError,
  releaseRecord,
  skipRecord,
} from "./queue";

async function createUser(username: string) {
  return prisma.user.create({
    data: { name: username, username, passwordHash: "x", role: "DATA_PROCESSOR" },
  });
}

async function createFileWithRecords(n: number) {
  const file = await prisma.sourceFile.create({
    data: { filename: "test.csv", totalRows: n },
  });
  await prisma.record.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      sourceFileId: file.id,
      rowIndex: i,
      name: `Biz ${i}`,
      phone: "555-0000",
    })),
  });
  return file;
}

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.record.deleteMany();
  await prisma.sourceFile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSetting.deleteMany();
});

describe("claimNextRecordForUser", () => {
  it("never assigns the same record to two concurrently-claiming users", async () => {
    await createFileWithRecords(5);
    const userA = await createUser("userA");
    const userB = await createUser("userB");

    const [a, b] = await Promise.all([
      claimNextRecordForUser(userA.id),
      claimNextRecordForUser(userB.id),
    ]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.id).not.toBe(b!.id);
    expect(a!.claimedById).toBe(userA.id);
    expect(b!.claimedById).toBe(userB.id);
  });

  it("resumes the caller's existing claim instead of handing out a new record", async () => {
    await createFileWithRecords(3);
    const user = await createUser("user1");
    const first = await claimNextRecordForUser(user.id);
    const second = await claimNextRecordForUser(user.id);
    expect(second!.id).toBe(first!.id);
  });

  it("returns null when the queue is empty", async () => {
    const user = await createUser("user1");
    const result = await claimNextRecordForUser(user.id);
    expect(result).toBeNull();
  });
});

describe("skipRecord", () => {
  it("returns the record to the pool, visibly marked skipped, for another user to claim", async () => {
    await createFileWithRecords(1);
    const userA = await createUser("userA");
    const userB = await createUser("userB");

    const claimed = await claimNextRecordForUser(userA.id);
    await skipRecord(claimed!.id, userA.id);

    const reclaimed = await claimNextRecordForUser(userB.id);
    expect(reclaimed!.id).toBe(claimed!.id);
    expect(reclaimed!.status).toBe("skipped");
    expect(reclaimed!.claimedById).toBe(userB.id);
  });

  it("does not immediately hand the same user back the record they just skipped, when another is available", async () => {
    await createFileWithRecords(2);
    const user = await createUser("user1");

    const first = await claimNextRecordForUser(user.id);
    await skipRecord(first!.id, user.id);

    const next = await claimNextRecordForUser(user.id, { excludeRecordId: first!.id });
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(first!.id);
    expect(next!.status).toBe("pending");
  });

  it("prioritizes fresh pending records over previously-skipped ones", async () => {
    await createFileWithRecords(2);
    const user = await createUser("user1");

    const first = await claimNextRecordForUser(user.id); // rowIndex 0
    await skipRecord(first!.id, user.id);

    // rowIndex 0 is now skipped+unclaimed; rowIndex 1 is still pending+unclaimed.
    // A fresh claim (no exclusion) should still prefer the pending one.
    const next = await claimNextRecordForUser(user.id);
    expect(next!.status).toBe("pending");
    expect(next!.id).not.toBe(first!.id);
  });

  it("rotates through the entire skipped pool once pending records run out, instead of bouncing between just the first couple", async () => {
    await createFileWithRecords(4);
    const user = await createUser("user1");

    const seen: string[] = [];
    let current = await claimNextRecordForUser(user.id);
    for (let i = 0; i < 8; i++) {
      seen.push(current!.id);
      await skipRecord(current!.id, user.id);
      current = await claimNextRecordForUser(user.id, { excludeRecordId: current!.id });
    }

    // The first 4 skips exhaust the pending pool — one distinct record each.
    expect(new Set(seen.slice(0, 4)).size).toBe(4);

    // Once only skipped records remain, the next 4 claims should cycle
    // through those same 4 records again (oldest-skipped-first), not
    // ping-pong between a smaller subset of them.
    expect(new Set(seen.slice(4, 8)).size).toBe(4);
    expect(seen.slice(4, 8)).toEqual(seen.slice(0, 4));
  });
});

describe("completeRecord", () => {
  it("permanently locks the record — it can never be assigned again", async () => {
    await createFileWithRecords(1);
    const userA = await createUser("userA");
    const userB = await createUser("userB");

    const claimed = await claimNextRecordForUser(userA.id);
    await completeRecord(claimed!.id, userA.id);

    const next = await claimNextRecordForUser(userB.id);
    expect(next).toBeNull();

    const record = await prisma.record.findUnique({ where: { id: claimed!.id } });
    expect(record!.status).toBe("done");
    expect(record!.doneById).toBe(userA.id);
  });
});

describe("ownership enforcement", () => {
  it("rejects done/skip/release from a user who doesn't hold the claim", async () => {
    await createFileWithRecords(1);
    const userA = await createUser("userA");
    const userB = await createUser("userB");

    const claimed = await claimNextRecordForUser(userA.id);

    await expect(completeRecord(claimed!.id, userB.id)).rejects.toThrow(OwnershipError);
    await expect(skipRecord(claimed!.id, userB.id)).rejects.toThrow(OwnershipError);
    await expect(releaseRecord(claimed!.id, userB.id)).rejects.toThrow(OwnershipError);
  });
});

describe("claimPreviousInFile", () => {
  it("steps back to the previous row and claims it, releasing the current claim without changing its status", async () => {
    const file = await createFileWithRecords(3);
    const user = await createUser("user1");
    const rows = await prisma.record.findMany({
      where: { sourceFileId: file.id },
      orderBy: { rowIndex: "asc" },
    });

    await prisma.record.update({ where: { id: rows[0].id }, data: { status: "skipped" } });
    await prisma.record.update({
      where: { id: rows[1].id },
      data: { claimedById: user.id, claimedAt: new Date() },
    });

    const result = await claimPreviousInFile(rows[1].id, user.id);
    expect(result.moved).toBe(true);
    expect(result.record!.id).toBe(rows[0].id);
    expect(result.record!.claimedById).toBe(user.id);

    const releasedRow = await prisma.record.findUnique({ where: { id: rows[1].id } });
    expect(releasedRow!.claimedById).toBeNull();
    expect(releasedRow!.status).toBe("pending");
  });

  it("reports start_of_file and leaves the claim untouched when already on row 0", async () => {
    const file = await createFileWithRecords(2);
    const user = await createUser("user1");
    const row0 = await prisma.record.findFirstOrThrow({
      where: { sourceFileId: file.id, rowIndex: 0 },
    });
    await prisma.record.update({
      where: { id: row0.id },
      data: { claimedById: user.id, claimedAt: new Date() },
    });

    const result = await claimPreviousInFile(row0.id, user.id);
    expect(result.moved).toBe(false);
    expect(result.blockedReason).toBe("start_of_file");
    expect(result.record!.id).toBe(row0.id);
    expect(result.record!.claimedById).toBe(user.id);
  });

  it("refuses to step back into a done row, which stays permanently locked", async () => {
    const file = await createFileWithRecords(2);
    const user = await createUser("user1");
    const rows = await prisma.record.findMany({
      where: { sourceFileId: file.id },
      orderBy: { rowIndex: "asc" },
    });
    await prisma.record.update({ where: { id: rows[0].id }, data: { status: "done" } });
    await prisma.record.update({
      where: { id: rows[1].id },
      data: { claimedById: user.id, claimedAt: new Date() },
    });

    const result = await claimPreviousInFile(rows[1].id, user.id);
    expect(result.moved).toBe(false);
    expect(result.blockedReason).toBe("target_done");
    expect(result.record!.id).toBe(rows[1].id);
    expect(result.record!.claimedById).toBe(user.id);
  });

  it("steals the claim from whoever currently holds the previous row", async () => {
    const file = await createFileWithRecords(2);
    const userA = await createUser("userA");
    const userB = await createUser("userB");
    const rows = await prisma.record.findMany({
      where: { sourceFileId: file.id },
      orderBy: { rowIndex: "asc" },
    });
    await prisma.record.update({
      where: { id: rows[0].id },
      data: { claimedById: userB.id, claimedAt: new Date() },
    });
    await prisma.record.update({
      where: { id: rows[1].id },
      data: { claimedById: userA.id, claimedAt: new Date() },
    });

    const result = await claimPreviousInFile(rows[1].id, userA.id);
    expect(result.moved).toBe(true);
    expect(result.record!.id).toBe(rows[0].id);
    expect(result.record!.claimedById).toBe(userA.id);
  });

  it("rejects a caller who doesn't hold the current claim", async () => {
    const file = await createFileWithRecords(2);
    const userA = await createUser("userA");
    const userB = await createUser("userB");
    const row1 = await prisma.record.findFirstOrThrow({
      where: { sourceFileId: file.id, rowIndex: 1 },
    });
    await prisma.record.update({
      where: { id: row1.id },
      data: { claimedById: userA.id, claimedAt: new Date() },
    });

    await expect(claimPreviousInFile(row1.id, userB.id)).rejects.toThrow(OwnershipError);
  });
});

describe("stale claim release", () => {
  it("returns a claim to the pool once it exceeds the configured timeout", async () => {
    await createFileWithRecords(1);
    const userA = await createUser("userA");
    const userB = await createUser("userB");

    await prisma.systemSetting.create({
      data: { key: "claimTimeoutMinutes", value: "30" },
    });

    const claimed = await claimNextRecordForUser(userA.id);
    await prisma.record.update({
      where: { id: claimed!.id },
      data: { claimedAt: new Date(Date.now() - 31 * 60 * 1000) },
    });

    const reclaimed = await claimNextRecordForUser(userB.id);
    expect(reclaimed!.id).toBe(claimed!.id);
    expect(reclaimed!.claimedById).toBe(userB.id);
  });

  it("does not release a claim still within the timeout", async () => {
    await createFileWithRecords(1);
    const userA = await createUser("userA");
    const userB = await createUser("userB");

    await prisma.systemSetting.create({
      data: { key: "claimTimeoutMinutes", value: "30" },
    });

    const claimed = await claimNextRecordForUser(userA.id);
    await prisma.record.update({
      where: { id: claimed!.id },
      data: { claimedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });

    const result = await claimNextRecordForUser(userB.id);
    expect(result).toBeNull();
  });
});
