"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, fdBool, fdStr } from "@/server/admin/helpers";
import type { FormResult } from "@/components/admin/action-form";
import { audit } from "@/server/security/audit";
import { canGrantRole, ForbiddenError } from "@/lib/permissions";
import { randomToken, sha256 } from "@/lib/utils/crypto";
import { sendNow } from "@/server/email";
import { getSiteOrigin } from "@/lib/seo/urls";
import { revokeUserSessions } from "@/lib/auth/session";
import { isValidSlug } from "@/lib/utils/slug";

const ROLES = ["OWNER", "ADMIN", "EDITOR", "AUTHOR"] as const;

export async function inviteUserAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("users.manage", async (actor) => {
    const data = z
      .object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(2).max(80), role: z.enum(ROLES) })
      .parse({ email: fdStr(fd, "email"), name: fdStr(fd, "name"), role: fdStr(fd, "role") });
    if (!canGrantRole(actor, data.role)) throw new ForbiddenError("Only owners can invite admins or owners.");
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing?.status === "ACTIVE") throw Object.assign(new Error("That person already has an active account."), { status: 409 });
    await db.invitation.updateMany({ where: { email: data.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const token = randomToken(32);
    const inv = await db.invitation.create({ data: { ...data, tokenHash: sha256(token), invitedById: actor.id, expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    await sendNow({
      to: data.email,
      kind: "invitation",
      subject: `You've been invited to the FixLayer CMS`,
      text: `${actor.name} invited you to join FixLayer as ${data.role.toLowerCase()}.\n\nAccept within 7 days:\n${getSiteOrigin()}/admin/accept-invite?token=${token}\n\nIf you weren't expecting this, ignore this email.`,
    });
    await audit({ actorId: actor.id, action: "user.invite", entityType: "Invitation", entityId: inv.id, summary: { role: data.role } });
    revalidatePath("/admin/authors");
    return `Invitation sent to ${data.email}. It expires in 7 days.`;
  });
}

export async function revokeInvitationAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("users.manage", async (actor) => {
    const id = fdStr(fd, "id");
    await db.invitation.update({ where: { id }, data: { revokedAt: new Date() } });
    await audit({ actorId: actor.id, action: "user.invite_revoke", entityType: "Invitation", entityId: id });
    revalidatePath("/admin/authors");
    return "Invitation revoked.";
  });
}

export async function updateUserAccessAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("users.manage", async (actor) => {
    const data = z.object({ id: z.string(), role: z.enum(ROLES), status: z.enum(["ACTIVE", "SUSPENDED"]) }).parse({ id: fdStr(fd, "id"), role: fdStr(fd, "role"), status: fdStr(fd, "status") });
    if (data.id === actor.id) throw Object.assign(new Error("You can't change your own role or status."), { status: 422 });
    const target = await db.user.findUniqueOrThrow({ where: { id: data.id } });
    // Admins can't touch owners/admins; only owners manage those.
    if ((target.role === "OWNER" || target.role === "ADMIN") && actor.role !== "OWNER") throw new ForbiddenError("Only owners can change admins or owners.");
    if (!canGrantRole(actor, data.role)) throw new ForbiddenError("You can't grant that role.");
    if (target.role === "OWNER" && data.role !== "OWNER") {
      const owners = await db.user.count({ where: { role: "OWNER", status: "ACTIVE" } });
      if (owners <= 1) throw Object.assign(new Error("There must always be at least one active owner."), { status: 422 });
    }
    await db.user.update({ where: { id: data.id }, data: { role: data.role, status: data.status } });
    if (data.status === "SUSPENDED") await revokeUserSessions(data.id);
    await audit({ actorId: actor.id, action: "user.access_update", entityType: "User", entityId: data.id, summary: { from: { role: target.role, status: target.status }, to: data } });
    revalidatePath("/admin/authors");
    return data.status === "SUSPENDED" ? "Access revoked and all sessions signed out." : "Access updated.";
  });
}

const socialSchema = z.array(z.object({ label: z.string().min(1).max(40), url: z.string().url().refine((u) => u.startsWith("https://"), "Use https links") })).max(8);

/** Each user edits their own profile; admins may edit anyone's. */
export async function saveProfileAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("article.create", async (actor) => {
    const userId = fdStr(fd, "userId") || actor.id;
    if (userId !== actor.id && actor.role !== "OWNER" && actor.role !== "ADMIN") throw new ForbiddenError();
    const social = fdStr(fd, "social")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, ...rest] = l.split("|");
        return { label: label!.trim(), url: rest.join("|").trim() };
      });
    const data = z
      .object({
        name: z.string().min(2).max(80),
        slug: z.string().refine(isValidSlug, "Profile URL must be lower-case kebab-case"),
        roleTitle: z.string().max(120),
        bio: z.string().max(2000),
        qualificationsText: z.string().max(3000),
        isPublic: z.boolean(),
        social: socialSchema,
        imageId: z.string().optional(),
      })
      .parse({
        name: fdStr(fd, "name"),
        slug: fdStr(fd, "slug"),
        roleTitle: fdStr(fd, "roleTitle"),
        bio: fdStr(fd, "bio"),
        qualificationsText: fdStr(fd, "qualificationsText"),
        isPublic: fdBool(fd, "isPublic"),
        social,
        imageId: fdStr(fd, "imageId") || undefined,
      });
    if (data.isPublic && data.bio.length < 40) throw Object.assign(new Error("Write a real bio (at least a couple of sentences) before making the profile public."), { status: 422 });
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { name: data.name, imageId: data.imageId ?? undefined } }),
      db.authorProfile.upsert({
        where: { userId },
        create: { userId, slug: data.slug, roleTitle: data.roleTitle, bio: data.bio, qualificationsText: data.qualificationsText, isPublic: data.isPublic, socialLinks: data.social },
        update: { slug: data.slug, roleTitle: data.roleTitle, bio: data.bio, qualificationsText: data.qualificationsText, isPublic: data.isPublic, socialLinks: data.social },
      }),
    ]);
    await audit({ actorId: actor.id, action: "profile.update", entityType: "User", entityId: userId, summary: { isPublic: data.isPublic } });
    revalidatePath(`/authors/${data.slug}`);
    revalidatePath("/about");
    return "Profile saved.";
  });
}
