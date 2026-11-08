"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guarded } from "@/server/admin/helpers";
import type { FormResult } from "@/components/admin/action-form";
import { runContentChecks, saveContentChecks } from "@/server/articles/checks";

/** Re-run advisory checks for every non-archived article (bounded). */
export async function rerunAllChecksAction(_p: FormResult): Promise<FormResult> {
  return guarded("seo.view", async () => {
    const ids = await db.article.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true }, take: 500, orderBy: { updatedAt: "desc" } });
    for (const { id } of ids) await saveContentChecks(id, await runContentChecks(id));
    revalidatePath("/admin/seo");
    return `Checked ${ids.length} article(s).`;
  });
}

export async function clearNotFoundAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("seo.view", async () => {
    const id = String(fd.get("id") ?? "");
    if (id) await db.notFoundEvent.delete({ where: { id } });
    else await db.notFoundEvent.deleteMany({});
    revalidatePath("/admin/seo");
    return "Cleared.";
  });
}
