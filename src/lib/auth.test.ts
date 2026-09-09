import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { hashPassword, resolveSessionUser, verifyPassword } from "./auth";

// Needs a real (disposable) database — see vitest.setup.ts. Never runs
// against production: these tests delete every User and Session row.
describe.skipIf(!process.env.VITEST_DB_AVAILABLE)("auth (database-backed)", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("hashPassword / verifyPassword", () => {
    it("round-trips a password", async () => {
      const hash = await hashPassword("correct horse battery staple");
      expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    });

    it("rejects the wrong password", async () => {
      const hash = await hashPassword("correct horse battery staple");
      expect(await verifyPassword("wrong password", hash)).toBe(false);
    });

    it("never stores the password in plaintext", async () => {
      const hash = await hashPassword("correct horse battery staple");
      expect(hash).not.toBe("correct horse battery staple");
      expect(hash.length).toBeGreaterThan(20);
    });
  });

  describe("resolveSessionUser", () => {
    async function createActiveUser() {
      return prisma.user.create({
        data: {
          name: "Test User",
          username: "testuser",
          passwordHash: await hashPassword("irrelevant"),
          role: "DATA_PROCESSOR",
          status: "ACTIVE",
        },
      });
    }

    it("returns null for no token", async () => {
      expect(await resolveSessionUser(undefined)).toBeNull();
    });

    it("returns null for an unknown token", async () => {
      expect(await resolveSessionUser("does-not-exist")).toBeNull();
    });

    it("returns the user for a valid, unexpired session", async () => {
      const user = await createActiveUser();
      const session = await prisma.session.create({
        data: { userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
      });

      const resolved = await resolveSessionUser(session.id);
      expect(resolved?.id).toBe(user.id);
      expect(resolved?.username).toBe("testuser");
    });

    it("returns null and deletes an expired session", async () => {
      const user = await createActiveUser();
      const session = await prisma.session.create({
        data: { userId: user.id, expiresAt: new Date(Date.now() - 60_000) },
      });

      expect(await resolveSessionUser(session.id)).toBeNull();
      expect(await prisma.session.findUnique({ where: { id: session.id } })).toBeNull();
    });

    it("returns null for a disabled user even with a valid session", async () => {
      const user = await prisma.user.create({
        data: {
          name: "Disabled User",
          username: "disableduser",
          passwordHash: await hashPassword("irrelevant"),
          role: "DATA_PROCESSOR",
          status: "DISABLED",
        },
      });
      const session = await prisma.session.create({
        data: { userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
      });

      expect(await resolveSessionUser(session.id)).toBeNull();
    });
  });
});
