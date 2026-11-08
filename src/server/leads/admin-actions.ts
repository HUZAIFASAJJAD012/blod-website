"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { guarded, fdStr } from "@/server/admin/helpers";
import type { FormResult } from "@/components/admin/action-form";
import { audit } from "@/server/security/audit";

export async function setInquiryStatusAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("inbox.view", async (user) => {
    const { id, status } = z.object({ id: z.string(), status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED", "SPAM"]) }).parse({ id: fdStr(fd, "id"), status: fdStr(fd, "status") });
    await db.contactSubmission.update({ where: { id }, data: { status } });
    await audit({ actorId: user.id, action: "inbox.status", entityType: "ContactSubmission", entityId: id, summary: { status } });
    revalidatePath("/admin/inbox");
    return `Marked as ${status.toLowerCase()}.`;
  });
}

/** Erasure on request (GDPR art. 17) — permanently removes the message. */
export async function deleteInquiryAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  const res = await guarded("inbox.view", async (user) => {
    const id = fdStr(fd, "id");
    await db.contactSubmission.delete({ where: { id } });
    await audit({ actorId: user.id, action: "inbox.delete", entityType: "ContactSubmission", entityId: id });
    return "Deleted.";
  });
  if (res?.ok) redirect("/admin/inbox");
  return res;
}

/** Erase every contact message and newsletter record for an email address. */
export async function eraseEmailDataAction(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("settings.manage", async (user) => {
    const email = z.string().trim().toLowerCase().email().parse(fdStr(fd, "email"));
    const [c, n] = await Promise.all([db.contactSubmission.deleteMany({ where: { email } }), db.newsletterSubscription.deleteMany({ where: { email } })]);
    await audit({ actorId: user.id, action: "privacy.erase", entityType: "Person", summary: { contacts: c.count, newsletter: n.count } });
    return `Erased ${c.count} message(s) and ${n.count} newsletter record(s).`;
  });
}
