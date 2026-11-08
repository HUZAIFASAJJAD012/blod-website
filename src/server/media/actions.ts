"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth/session";
import { can, ForbiddenError } from "@/lib/permissions";
import { toResult, type ActionResult } from "@/lib/utils/result";
import { deleteMedia, findOrphans, mediaUsage, updateMediaMeta } from "./service";

export type MediaItem = { id: string; fileUrl: string; width: number; height: number; alt: string; caption: string | null; copyrightHolder: string | null; license: string | null; mime: string; size: number; createdAt: string };

export async function listMediaAction(q = "", page = 1): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const user = await requireUserOrThrow();
  const where = {
    ...(can(user, "media.manageAny") ? {} : { uploadedById: user.id }),
    ...(q ? { OR: [{ alt: { contains: q, mode: "insensitive" as const } }, { caption: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const take = 24;
  const rows = await db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (Math.max(1, page) - 1) * take, take: take + 1 });
  return {
    hasMore: rows.length > take,
    items: rows.slice(0, take).map((m) => ({ id: m.id, fileUrl: m.fileUrl, width: m.width, height: m.height, alt: m.alt, caption: m.caption, copyrightHolder: m.copyrightHolder, license: m.license, mime: m.mime, size: m.size, createdAt: m.createdAt.toISOString() })),
  };
}

const metaSchema = z.object({
  alt: z.string().max(300).default(""),
  caption: z.string().max(400).optional(),
  title: z.string().max(200).optional(),
  copyrightHolder: z.string().max(200).optional(),
  license: z.string().max(120).optional(),
  sourceUrl: z.string().max(1000).optional(),
  focalX: z.number().min(0).max(1).nullable().optional(),
  focalY: z.number().min(0).max(1).nullable().optional(),
});

export async function updateMediaAction(id: string, meta: unknown): Promise<ActionResult<null>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    await updateMediaMeta(user, z.string().parse(id), metaSchema.parse(meta));
    revalidatePath("/admin/media");
    return null;
  });
}

export async function deleteMediaAction(id: string): Promise<ActionResult<null>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    await deleteMedia(user, z.string().parse(id));
    revalidatePath("/admin/media");
    return null;
  });
}

export async function mediaUsageAction(id: string) {
  await requireUserOrThrow();
  return mediaUsage(z.string().parse(id));
}

export async function cleanupOrphansAction(): Promise<ActionResult<{ deleted: number }>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    if (!can(user, "media.manageAny")) throw new ForbiddenError();
    const orphans = await findOrphans(100);
    for (const o of orphans) await deleteMedia(user, o.id);
    revalidatePath("/admin/media");
    return { deleted: orphans.length };
  });
}
