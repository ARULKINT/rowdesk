import "server-only";
import { prisma } from "@/lib/prisma";
import type { Record as RecordModel, SourceFile } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";

export interface RecordWithPosition extends RecordModel {
  sourceFile: SourceFile;
  totalInFile: number;
}

export async function attachPosition(
  record: (RecordModel & { sourceFile: SourceFile }) | null
): Promise<RecordWithPosition | null> {
  if (!record) return null;
  const totalInFile = await prisma.record.count({
    where: { sourceFileId: record.sourceFileId },
  });
  return { ...record, totalInFile };
}

/**
 * "Available" records are pending OR previously-skipped, and unclaimed.
 * Skipped stays a visible, audited status (matches the Phase 1 rail + the
 * Statistics "Skipped" stat) while still re-entering the shared pool, per
 * crm-PLAN's SKIPPED -> PENDING re-queue behavior.
 */
const AVAILABLE_STATUSES = ["pending", "skipped"];

/** Ordered outreach stages; a record advances one slot at a time. */
export const OUTREACH_STAGES = ["initial", "followup1", "followup2"] as const;
export type OutreachStage = (typeof OUTREACH_STAGES)[number];

const STAGE_WAIT_DAYS = 3;

/** Records whose stageDueAt is unset or already past are eligible now. */
function dueNow() {
  return { OR: [{ stageDueAt: null }, { stageDueAt: { lte: new Date() } }] };
}

async function releaseStaleClaims(): Promise<void> {
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.claimTimeoutMinutes * 60 * 1000);

  const stale = await prisma.record.findMany({
    where: {
      status: { in: AVAILABLE_STATUSES },
      claimedById: { not: null },
      claimedAt: { lt: cutoff },
    },
    select: { id: true, claimedById: true },
  });
  if (stale.length === 0) return;

  await prisma.record.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { claimedById: null, claimedAt: null },
  });

  await Promise.all(
    stale.map((s) =>
      logAudit({
        userId: null,
        action: "record_released",
        entityType: "Record",
        entityId: s.id,
        metadata: { reason: "stale_claim_timeout", previousUserId: s.claimedById },
      })
    )
  );
}

/**
 * Finds the best unclaimed candidate: fresh `pending` records take priority
 * over previously-`skipped` ones, so a user working through the queue makes
 * forward progress instead of immediately cycling back to what they just
 * skipped. Falls back to skipped records once pending ones run out.
 *
 * The skipped fallback orders by `updatedAt` (oldest-skipped-first), not by
 * file/row position — with a fixed row-position order, once every row is
 * skipped, the single most-recently-excluded id isn't enough to stop
 * candidate selection from bouncing back and forth between just the lowest
 * one or two row positions forever. Oldest-skipped-first instead rotates
 * through the entire skipped pool in FIFO order, so every skipped row is
 * eventually reachable again.
 */
async function findCandidate(excludeIds: string[]) {
  const notIn = excludeIds.length ? { notIn: excludeIds } : undefined;
  const pending = await prisma.record.findFirst({
    where: {
      status: "pending",
      claimedById: null,
      ...dueNow(),
      ...(notIn ? { id: notIn } : {}),
    },
    orderBy: [{ sourceFileId: "asc" }, { rowIndex: "asc" }],
  });
  if (pending) return pending;

  return prisma.record.findFirst({
    where: {
      status: "skipped",
      claimedById: null,
      ...dueNow(),
      ...(notIn ? { id: notIn } : {}),
    },
    orderBy: [{ updatedAt: "asc" }, { rowIndex: "asc" }],
  });
}

/**
 * Resumes the caller's existing claim if they have one, otherwise atomically
 * claims the next available record. Uses a conditional updateMany
 * (compare-and-swap on claimedById) with a small retry loop instead of
 * SELECT-FOR-UPDATE so the same code works on SQLite and Postgres.
 *
 * `excludeRecordId` keeps a record a user just skipped/released from being
 * immediately handed straight back to them in the same action.
 */
export async function claimNextRecordForUser(
  userId: string,
  options: { excludeRecordId?: string } = {}
): Promise<RecordWithPosition | null> {
  const existing = await prisma.record.findFirst({
    where: {
      status: { in: AVAILABLE_STATUSES },
      claimedById: userId,
      ...(options.excludeRecordId ? { id: { not: options.excludeRecordId } } : {}),
    },
    include: { sourceFile: true },
    orderBy: [{ sourceFileId: "asc" }, { rowIndex: "asc" }],
  });
  if (existing) return attachPosition(existing);

  await releaseStaleClaims();

  const excludeIds: string[] = options.excludeRecordId ? [options.excludeRecordId] : [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await findCandidate(excludeIds);
    if (!candidate) return null;

    const result = await prisma.record.updateMany({
      where: { id: candidate.id, claimedById: null },
      data: { claimedById: userId, claimedAt: new Date() },
    });

    if (result.count === 1) {
      await logAudit({
        userId,
        action: "record_claimed",
        entityType: "Record",
        entityId: candidate.id,
      });
      const claimed = await prisma.record.findUnique({
        where: { id: candidate.id },
        include: { sourceFile: true },
      });
      return attachPosition(claimed);
    }

    excludeIds.push(candidate.id);
  }
  return null;
}

class OwnershipError extends Error {
  constructor() {
    super("This record is no longer assigned to you.");
  }
}
export { OwnershipError };

async function assertOwnership(recordId: string, userId: string) {
  const record = await prisma.record.findUnique({ where: { id: recordId } });
  if (!record || record.claimedById !== userId) throw new OwnershipError();
  return record;
}

export async function releaseRecord(recordId: string, userId: string) {
  await assertOwnership(recordId, userId);
  const updated = await prisma.record.update({
    where: { id: recordId },
    data: { claimedById: null, claimedAt: null },
  });
  await logAudit({
    userId,
    action: "record_released",
    entityType: "Record",
    entityId: recordId,
  });
  return updated;
}

export async function skipRecord(recordId: string, userId: string) {
  await assertOwnership(recordId, userId);
  const updated = await prisma.record.update({
    where: { id: recordId },
    data: { status: "skipped", claimedById: null, claimedAt: null },
  });
  await logAudit({
    userId,
    action: "record_skipped",
    entityType: "Record",
    entityId: recordId,
  });
  return updated;
}

export async function completeRecord(recordId: string, userId: string) {
  await assertOwnership(recordId, userId);
  const updated = await prisma.record.update({
    where: { id: recordId },
    data: { status: "done", doneById: userId, doneAt: new Date() },
  });
  await logAudit({
    userId,
    action: "record_completed",
    entityType: "Record",
    entityId: recordId,
  });
  return updated;
}

/**
 * Marks the current outreach stage's message as sent. Before the final
 * stage (followup2), this schedules the next stage 3 days out and returns
 * the record to the shared pool (not claimable again until due). Sending
 * followup2 finishes the sequence — same end state as completeRecord.
 */
export async function advanceStage(recordId: string, userId: string) {
  const record = await assertOwnership(recordId, userId);
  const idx = OUTREACH_STAGES.indexOf(record.outreachStage as OutreachStage);
  const isFinalStage = idx === -1 || idx === OUTREACH_STAGES.length - 1;

  if (isFinalStage) {
    const updated = await prisma.record.update({
      where: { id: recordId },
      data: { status: "done", outreachStage: "finished", doneById: userId, doneAt: new Date() },
    });
    await logAudit({
      userId,
      action: "record_completed",
      entityType: "Record",
      entityId: recordId,
      metadata: { via: "stage_advance", stage: record.outreachStage },
    });
    return updated;
  }

  const nextStage = OUTREACH_STAGES[idx + 1];
  const dueAt = new Date(Date.now() + STAGE_WAIT_DAYS * 24 * 60 * 60 * 1000);
  const updated = await prisma.record.update({
    where: { id: recordId },
    data: {
      outreachStage: nextStage,
      stageDueAt: dueAt,
      claimedById: null,
      claimedAt: null,
    },
  });
  await logAudit({
    userId,
    action: "record_stage_advanced",
    entityType: "Record",
    entityId: recordId,
    metadata: { fromStage: record.outreachStage, toStage: nextStage, dueAt: dueAt.toISOString() },
  });
  return updated;
}

export type PreviousBlockedReason = "start_of_file" | "target_done";

/**
 * Steps back to the previous row (by rowIndex) in the same source file and
 * claims it for the caller, releasing their current claim without changing
 * its status — a deliberate exception to the normal "claim only what's
 * available" rule, for quickly correcting the last record or two. Steals
 * the claim from whoever currently holds the target row, if anyone; a
 * `done` row is still immutable and can't be stepped back into.
 */
export async function claimPreviousInFile(
  currentRecordId: string,
  userId: string
): Promise<{ record: RecordWithPosition | null; moved: boolean; blockedReason?: PreviousBlockedReason }> {
  const current = await prisma.record.findUnique({
    where: { id: currentRecordId },
    include: { sourceFile: true },
  });
  if (!current || current.claimedById !== userId) throw new OwnershipError();

  const target = await prisma.record.findFirst({
    where: { sourceFileId: current.sourceFileId, rowIndex: current.rowIndex - 1 },
    include: { sourceFile: true },
  });

  if (!target) {
    return { record: await attachPosition(current), moved: false, blockedReason: "start_of_file" };
  }
  if (target.status === "done") {
    return { record: await attachPosition(current), moved: false, blockedReason: "target_done" };
  }

  const previousOwnerId = target.claimedById;

  await prisma.record.update({
    where: { id: current.id },
    data: { claimedById: null, claimedAt: null },
  });
  await logAudit({
    userId,
    action: "record_released",
    entityType: "Record",
    entityId: current.id,
  });

  const claimedTarget = await prisma.record.update({
    where: { id: target.id },
    data: { claimedById: userId, claimedAt: new Date() },
    include: { sourceFile: true },
  });
  await logAudit({
    userId,
    action: "record_claimed",
    entityType: "Record",
    entityId: target.id,
    metadata: { via: "previous", previousOwnerId },
  });

  return { record: await attachPosition(claimedTarget), moved: true };
}
