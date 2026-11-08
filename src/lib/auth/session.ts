import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { randomToken, sha256 } from "@/lib/utils/crypto";
import { can, type Capability, ForbiddenError } from "@/lib/permissions";
import { cookieIsSecure, sessionCookieName } from "./cookie";

const SESSION_DAYS = 14;
const IDLE_REFRESH_MS = 1000 * 60 * 60; // refresh lastSeen at most hourly

export { sessionCookieName };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mfaEnabled: boolean;
};

export async function createSession(userId: string, opts: { mfaPending: boolean; ipHash?: string; userAgent?: string | null }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      mfaPending: opts.mfaPending,
      ipHash: opts.ipHash,
      userAgent: opts.userAgent ?? undefined,
    },
  });
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: cookieIsSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(sessionCookieName());
}

type SessionState = { user: SessionUser; sessionId: string; mfaPending: boolean } | null;

/** Request-memoized session lookup. Validates expiry and account status every time. */
export const getSession = cache(async (): Promise<SessionState> => {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token || token.length > 128) return null;
  const id = sha256(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true, status: true, mfaEnabled: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  if (Date.now() - session.lastSeenAt.getTime() > IDLE_REFRESH_MS) {
    await db.session.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  const { status: _status, ...user } = session.user;
  void _status;
  return { user, sessionId: id, mfaPending: session.mfaPending };
});

/** Use in admin Server Components / actions. Redirects to login when absent. */
export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (s.mfaPending) redirect("/admin/login/mfa");
  return s.user;
}

/** Same as requireUser but throws instead of redirecting (route handlers, actions returning JSON). */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const s = await getSession();
  if (!s || s.mfaPending) throw new ForbiddenError("Authentication required.");
  return s.user;
}

export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, capability)) redirect("/admin?denied=1");
  return user;
}

export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) } });
}
