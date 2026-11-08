import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { AdminPage, EmptyRow, td, th } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Inbox" };

const FILTERS = ["NEW", "READ", "REPLIED", "ARCHIVED", "SPAM"] as const;

export default async function InboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  await requireCapability("inbox.view");
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(String(sp.status)) ? (sp.status as (typeof FILTERS)[number]) : undefined;
  const [rows, counts] = await Promise.all([
    db.contactSubmission.findMany({ where: status ? { status } : { status: { notIn: ["SPAM", "ARCHIVED"] } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.contactSubmission.groupBy({ by: ["status"], _count: true }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));
  return (
    <AdminPage title="Inbox" description="Contact form messages. Retained for up to 24 months, then deleted automatically by the cron job.">
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/inbox" className={`chip ${!status ? "border-ink" : ""}`}>Open</Link>
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/inbox?status=${f}`} className={`chip ${status === f ? "border-ink" : ""}`}>
            {f.toLowerCase()} ({c[f] ?? 0})
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-line bg-[#FAFAF8]">
            <tr>
              <th className={th}>Subject</th>
              <th className={th}>From</th>
              <th className={th}>Topic</th>
              <th className={th}>Received</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "NEW" ? "font-medium" : ""}>
                <td className={td}><Link href={`/admin/inbox/${r.id}`} className="no-underline hover:text-accent">{r.subject}</Link></td>
                <td className={td}>{r.name}</td>
                <td className={td}><span className="badge">{r.topic}</span></td>
                <td className={`${td} text-muted`}>{r.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className={td}>{r.status.toLowerCase()}</td>
              </tr>
            ))}
            {!rows.length ? <EmptyRow colSpan={5}>No messages.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
