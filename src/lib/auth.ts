import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "rowdesk_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type Role = "ADMIN" | "DATA_PROCESSOR";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  status: UserStatus;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const session = await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_MS),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

/** The actual validity/expiry/disabled-user logic, separated from cookie
 * reading so it's testable without a Next.js request context. */
export async function resolveSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }

  if (session.user.status !== "ACTIVE") return null;

  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    role: session.user.role as Role,
    status: session.user.status as UserStatus,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return resolveSessionUser(store.get(SESSION_COOKIE)?.value);
}

/** Server Component / Server Action guard: redirects to /login if unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Server Component / Server Action guard: redirects non-admins to /dashboard. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Route Handler guard: returns null (caller should respond 401) instead of redirecting. */
export async function getApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}
