"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSession, requireUserOrThrow, revokeUserSessions } from "@/lib/auth/session";
import { verifyTotp, generateTotpSecret, totpUri } from "@/lib/auth/totp";
import { decrypt, encrypt, randomToken, sha256 } from "@/lib/utils/crypto";
import { requestIpHash, requestUserAgent } from "@/lib/utils/request";
import { rateLimit, resetRateLimit } from "@/server/security/rate-limit";
import { audit } from "@/server/security/audit";
import { sendNow } from "@/server/email";
import { getSiteOrigin } from "@/lib/seo/urls";
import { slugify } from "@/lib/utils/slug";

export type AuthState = { error?: string; message?: string };

const GENERIC = "Email or password is incorrect.";

function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/admin") && !n.startsWith("//") && !n.includes("\\") ? n : "/admin";
}

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: GENERIC };
  const { email, password } = parsed.data;
  const ipHash = await requestIpHash();

  // Two limits: per IP (credential stuffing) and per account (targeted brute force).
  const [ipRl, acctRl] = await Promise.all([rateLimit(`login:ip:${ipHash}`, 20, 900), rateLimit(`login:acct:${sha256(email)}`, 8, 900)]);
  if (!ipRl.ok || !acctRl.ok) {
    await audit({ actorId: null, action: "auth.login_throttled", entityType: "User", summary: { emailHash: sha256(email).slice(0, 12) }, ipHash });
    return { error: `Too many sign-in attempts. Try again in ${Math.ceil(Math.max(ipRl.retryAfterSeconds, acctRl.retryAfterSeconds) / 60)} minutes.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok || user.status !== "ACTIVE") {
    await audit({ actorId: user?.id ?? null, action: "auth.login_failed", entityType: "User", entityId: user?.id, ipHash });
    return { error: GENERIC };
  }
  await resetRateLimit(`login:acct:${sha256(email)}`);
  await createSession(user.id, { mfaPending: user.mfaEnabled, ipHash, userAgent: await requestUserAgent() });
  if (!user.mfaEnabled) {
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ipHash });
    redirect(safeNext(form.get("next")));
  }
  redirect(`/admin/login/mfa?next=${encodeURIComponent(safeNext(form.get("next")))}`);
}

export async function mfaVerifyAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  const ipHash = await requestIpHash();
  const rl = await rateLimit(`mfa:${s.user.id}`, 6, 900);
  if (!rl.ok) return { error: "Too many attempts. Sign in again later." };
  const user = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!user.mfaSecret || !verifyTotp(decrypt(user.mfaSecret), code)) {
    await audit({ actorId: user.id, action: "auth.mfa_failed", entityType: "User", entityId: user.id, ipHash });
    return { error: "That code didn't work. Check your authenticator app's time and try again." };
  }
  await db.session.update({ where: { id: s.sessionId }, data: { mfaPending: false } });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, summary: { mfa: true }, ipHash });
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  const s = await getSession();
  if (s) await audit({ actorId: s.user.id, action: "auth.logout", entityType: "User", entityId: s.user.id });
  await destroySession();
  redirect("/admin/login");
}

export async function forgotPasswordAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const ipHash = await requestIpHash();
  const rl = await rateLimit(`reset:${ipHash}`, 5, 3600);
  const done = { message: "If an account exists for that address, we've emailed a reset link. It expires in 30 minutes." };
  if (!rl.ok || !z.string().email().safeParse(email).success) return done;
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") {
    const token = randomToken(32);
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });
    await sendNow({
      to: user.email,
      kind: "password_reset",
      subject: "Reset your FixLayer admin password",
      text: `Someone (hopefully you) asked to reset your password.\n\n${getSiteOrigin()}/admin/reset-password?token=${token}\n\nThe link expires in 30 minutes. If you didn't ask for this, ignore this email.`,
    });
    await audit({ actorId: user.id, action: "auth.reset_requested", entityType: "User", entityId: user.id, ipHash });
  }
  return done;
}

export async function resetPasswordAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "Passwords don't match." };
  const problem = passwordProblems(password);
  if (problem) return { error: problem };
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: "This reset link is invalid or has expired. Request a new one." };
  await db.$transaction([
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
  ]);
  await revokeUserSessions(row.userId);
  await audit({ actorId: row.userId, action: "auth.password_reset", entityType: "User", entityId: row.userId });
  redirect("/admin/login?reset=1");
}

export async function acceptInviteAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "Passwords don't match." };
  const problem = passwordProblems(password);
  if (problem) return { error: problem };
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) return { error: "This invitation is invalid or has expired." };
  const existing = await db.user.findUnique({ where: { email: inv.email } });
  if (existing && existing.status === "ACTIVE") return { error: "An account already exists for this email. Sign in instead." };

  const passwordHash = await hashPassword(password);
  const user = await db.$transaction(async (tx) => {
    const u = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { passwordHash, role: inv.role, status: "ACTIVE", name: inv.name } })
      : await tx.user.create({ data: { email: inv.email, name: inv.name, role: inv.role, passwordHash, status: "ACTIVE" } });
    let slug = slugify(inv.name) || `author-${u.id.slice(-6)}`;
    if (await tx.authorProfile.findUnique({ where: { slug } })) slug = `${slug}-${u.id.slice(-4)}`;
    await tx.authorProfile.upsert({ where: { userId: u.id }, create: { userId: u.id, slug }, update: {} });
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    return u;
  });
  await audit({ actorId: user.id, action: "user.invite_accepted", entityType: "User", entityId: user.id, summary: { role: inv.role } });
  await createSession(user.id, { mfaPending: false, ipHash: await requestIpHash(), userAgent: await requestUserAgent() });
  redirect("/admin/profile?welcome=1");
}

// ── MFA enrolment (from the profile page) ──

export async function startMfaEnrollment(): Promise<{ secret: string; uri: string }> {
  const user = await requireUserOrThrow();
  if (user.mfaEnabled) throw new Error("Two-factor authentication is already on. Turn it off first to re-enrol.");
  const secret = generateTotpSecret();
  // Store the pending secret encrypted but not enabled until confirmed with a valid code.
  await db.user.update({ where: { id: user.id }, data: { mfaSecret: encrypt(secret), mfaEnabled: false } });
  return { secret, uri: totpUri(secret, user.email) };
}

export async function confirmMfaEnrollment(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await requireUserOrThrow();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!row.mfaSecret || !verifyTotp(decrypt(row.mfaSecret), code)) return { error: "That code didn't match. Try the next one from your app." };
  await db.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  await audit({ actorId: user.id, action: "auth.mfa_enabled", entityType: "User", entityId: user.id });
  return { message: "Two-factor authentication is on. You'll be asked for a code at each sign-in." };
}

export async function disableMfa(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await requireUserOrThrow();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(String(form.get("password") ?? ""), row.passwordHash))) return { error: "Password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });
  await audit({ actorId: user.id, action: "auth.mfa_disabled", entityType: "User", entityId: user.id });
  return { message: "Two-factor authentication is off." };
}

export async function changePasswordAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await requireUserOrThrow();
  const s = await getSession();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(String(form.get("current") ?? ""), row.passwordHash))) return { error: "Current password is incorrect." };
  const next = String(form.get("password") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "New passwords don't match." };
  const problem = passwordProblems(next);
  if (problem) return { error: problem };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeUserSessions(user.id, s?.sessionId);
  await audit({ actorId: user.id, action: "auth.password_changed", entityType: "User", entityId: user.id });
  return { message: "Password changed. Other sessions were signed out." };
}
