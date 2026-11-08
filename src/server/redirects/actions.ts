"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, fdBool, fdStr } from "@/server/admin/helpers";
import type { FormResult } from "@/components/admin/action-form";
import { audit } from "@/server/security/audit";
import { analyzeRedirect, normalizePath, upsertRedirect } from "./index";

const target = z
  .string()
  .min(1)
  .max(2048)
  .refine((v) => v.startsWith("/") ? !v.startsWith("//") : /^https:\/\//.test(v), "Target must be a root-relative path (/…) or an https:// URL");

export async function createRedirectAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("redirects.manage", async (user) => {
    const data = z
      .object({ fromPath: z.string().min(2).max(500).startsWith("/"), to: target, status: z.enum(["301", "308"]), reason: z.string().max(300) })
      .parse({ fromPath: fdStr(fd, "fromPath"), to: fdStr(fd, "to"), status: fdStr(fd, "status") || "301", reason: fdStr(fd, "reason") });
    const from = normalizePath(data.fromPath);
    if (from.startsWith("/admin") || from.startsWith("/api") || from === "/") throw Object.assign(new Error("That path can't be redirected."), { status: 422 });
    const live = await db.article.findFirst({ where: { slug: from.replace(/^\/guides\//, ""), status: "PUBLISHED" }, select: { id: true } });
    if (from.startsWith("/guides/") && live) throw Object.assign(new Error("A published article lives at that path. Unpublish or change its slug first."), { status: 409 });
    const analysis = await analyzeRedirect(from, data.to);
    if (!analysis.ok) throw Object.assign(new Error(analysis.error), { status: 422 });
    const row = await upsertRedirect({ fromPath: from, to: data.to, status: Number(data.status) as 301 | 308, reason: data.reason });
    await audit({ actorId: user.id, action: "redirect.upsert", entityType: "Redirect", entityId: row.id, summary: { from, to: row.toPathOrUrl, chainCollapsed: analysis.chained } });
    revalidatePath("/admin/redirects");
    return analysis.chained ? `Saved. The target was itself redirected, so this now points straight to ${row.toPathOrUrl} (one hop).` : "Redirect saved. It takes effect within a minute.";
  });
}

export async function toggleRedirectAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("redirects.manage", async (user) => {
    const id = fdStr(fd, "id");
    const enabled = fdBool(fd, "enabled");
    await db.redirect.update({ where: { id }, data: { enabled } });
    await audit({ actorId: user.id, action: enabled ? "redirect.enable" : "redirect.disable", entityType: "Redirect", entityId: id });
    revalidatePath("/admin/redirects");
    return enabled ? "Enabled." : "Disabled.";
  });
}

export async function deleteRedirectAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("redirects.manage", async (user) => {
    const id = fdStr(fd, "id");
    const r = await db.redirect.delete({ where: { id } });
    await audit({ actorId: user.id, action: "redirect.delete", entityType: "Redirect", entityId: id, summary: { from: r.fromPath } });
    revalidatePath("/admin/redirects");
    return "Deleted.";
  });
}
