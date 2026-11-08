import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { deleteInquiryAction, setInquiryStatusAction } from "@/server/leads/admin-actions";

export const metadata: Metadata = { title: "Message" };

export default async function InquiryPage({ params }: PageProps<"/admin/inbox/[id]">) {
  await requireCapability("inbox.view");
  const { id } = await params;
  let m = await db.contactSubmission.findUnique({ where: { id } });
  if (!m) notFound();
  if (m.status === "NEW") m = await db.contactSubmission.update({ where: { id }, data: { status: "READ" } });

  return (
    <AdminPage title={m.subject} actions={<Link href="/admin/inbox" className="btn btn-secondary btn-sm">Back to inbox</Link>}>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel>
          <dl className="mb-4 grid grid-cols-[100px_1fr] gap-y-1 text-[14px]">
            <dt className="text-muted">From</dt>
            <dd>{m.name} · <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="link-underline">{m.email}</a></dd>
            <dt className="text-muted">Topic</dt>
            <dd>{m.topic}</dd>
            <dt className="text-muted">Page</dt>
            <dd className="font-mono text-[13px]">{m.pageUrl ? <a href={m.pageUrl} className="link-underline" target="_blank">{m.pageUrl}</a> : "—"}</dd>
            <dt className="text-muted">Received</dt>
            <dd>{m.createdAt.toLocaleString("en-GB")}</dd>
            <dt className="text-muted">Consent</dt>
            <dd>{m.consent ? "Yes — agreed to storage for reply" : "No"}</dd>
          </dl>
          <div className="rounded-md border border-line bg-[#FAFAF8] p-4 text-[15px] whitespace-pre-wrap">{m.message}</div>
          <p className="mt-3 text-[12.5px] text-muted">Message text is shown as plain text; links are not clickable to avoid phishing.</p>
        </Panel>
        <div className="space-y-4">
          <Panel title="Status">
            <ActionForm action={setInquiryStatusAction} submitLabel="Update">
              <input type="hidden" name="id" value={m.id} />
              <label htmlFor="st" className="sr-only">Status</label>
              <select id="st" name="status" defaultValue={m.status} className="select">
                {["NEW", "READ", "REPLIED", "ARCHIVED", "SPAM"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
              </select>
            </ActionForm>
          </Panel>
          <Panel title="Delete permanently">
            <p className="mb-3 text-[13.5px] text-muted">Use for erasure requests. This cannot be undone.</p>
            <ActionForm action={deleteInquiryAction} submitLabel="Delete message" submitClassName="btn btn-danger btn-sm">
              <input type="hidden" name="id" value={m.id} />
            </ActionForm>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
