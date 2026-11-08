import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { AdminPage, EmptyRow, td, th } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Audit log" };

const PER = 50;

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  await requireCapability("audit.view");
  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action.slice(0, 60) : "";
  const entity = typeof sp.entity === "string" ? sp.entity.slice(0, 40) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { ...(action ? { action: { startsWith: action } } : {}), ...(entity ? { entityType: entity } : {}) };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { actor: { select: { name: true } } } }),
    db.auditLog.count({ where }),
  ]);
  return (
    <AdminPage title="Audit log" description="Append-only record of privileged actions. IP addresses are stored only as keyed hashes.">
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="a-action" className="sr-only">Action prefix</label>
        <input id="a-action" name="action" defaultValue={action} placeholder="action, e.g. article.publish" className="input min-h-9 w-64 py-1.5" />
        <label htmlFor="a-entity" className="sr-only">Entity</label>
        <select id="a-entity" name="entity" defaultValue={entity} className="select min-h-9 w-48 py-1.5">
          <option value="">All entities</option>
          {["Article", "User", "Media", "Redirect", "Category", "Tag", "Setting", "AdPlacement", "ContactSubmission", "Invitation"].map((e) => <option key={e}>{e}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-line bg-[#FAFAF8]">
            <tr>
              <th className={th}>When</th>
              <th className={th}>Who</th>
              <th className={th}>Action</th>
              <th className={th}>Entity</th>
              <th className={th}>Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap text-muted`}>{r.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className={td}>{r.actor?.name ?? <span className="text-muted">system</span>}</td>
                <td className={`${td} font-mono text-[12.5px]`}>{r.action}</td>
                <td className={td}>
                  {r.entityType === "Article" && r.entityId ? <Link href={`/admin/articles/${r.entityId}/edit`} className="link-underline">{r.entityType}</Link> : r.entityType}
                </td>
                <td className={`${td} max-w-[360px]`}><code className="block truncate font-mono text-[12px] text-muted">{JSON.stringify(r.summaryJson)}</code></td>
              </tr>
            ))}
            {!rows.length ? <EmptyRow colSpan={5}>No entries.</EmptyRow> : null}
          </tbody>
        </table>
      </div>
      <nav className="mt-4 flex justify-between text-[14px]" aria-label="Pagination">
        <span className="text-muted">{total} entries</span>
        <span className="flex gap-2">
          {page > 1 ? <Link className="btn btn-secondary btn-sm" href={`?action=${action}&entity=${entity}&page=${page - 1}`}>Newer</Link> : null}
          {page * PER < total ? <Link className="btn btn-secondary btn-sm" href={`?action=${action}&entity=${entity}&page=${page + 1}`}>Older</Link> : null}
        </span>
      </nav>
    </AdminPage>
  );
}
