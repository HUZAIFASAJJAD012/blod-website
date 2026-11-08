import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { AdminPage, EmptyRow, Panel, td, th } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { createRedirectAction, deleteRedirectAction, toggleRedirectAction } from "@/server/redirects/actions";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Redirects" };

export default async function RedirectsPage({ searchParams }: PageProps<"/admin/redirects">) {
  await requireCapability("redirects.manage");
  const sp = await searchParams;
  const prefill = typeof sp.from === "string" ? sp.from : "";
  const rows = await db.redirect.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  // Health: targets that are themselves redirected (chains) — should be zero thanks to collapsing.
  const froms = new Set(rows.filter((r) => r.enabled).map((r) => r.fromPath));
  const chains = rows.filter((r) => r.enabled && froms.has(r.toPathOrUrl));

  return (
    <AdminPage title="Redirects" description="Permanent redirects are applied before pages render. New rules are checked for loops, and chains are collapsed so every old URL is a single hop.">
      <div className="space-y-6">
        <Panel title="Add redirect">
          <ActionForm action={createRedirectAction} submitLabel="Add redirect" resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_110px] md:items-end">
            <div>
              <label className="field-label" htmlFor="r-from">From path</label>
              <input id="r-from" name="fromPath" defaultValue={prefill} required placeholder="/old-path" className="input font-mono text-[13px]" />
            </div>
            <div>
              <label className="field-label" htmlFor="r-to">To (path or https URL)</label>
              <input id="r-to" name="to" required placeholder="/guides/new-slug" className="input font-mono text-[13px]" />
            </div>
            <div>
              <label className="field-label" htmlFor="r-status">Status</label>
              <select id="r-status" name="status" className="select">
                <option value="301">301</option>
                <option value="308">308</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="field-label" htmlFor="r-reason">Reason</label>
              <input id="r-reason" name="reason" className="input" placeholder="e.g. merged into the newer guide" />
            </div>
          </ActionForm>
        </Panel>
        {chains.length ? <p className="text-[14px] text-warning">{chains.length} redirect chain(s) detected — re-save those rules to collapse them.</p> : null}
        <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-line bg-[#FAFAF8]">
              <tr>
                <th className={th}>From</th>
                <th className={th}>To</th>
                <th className={th}>Code</th>
                <th className={th}>Hits</th>
                <th className={th}>Reason</th>
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className={r.enabled ? "" : "opacity-60"}>
                  <td className={`${td} font-mono text-[13px]`}>{r.fromPath}</td>
                  <td className={`${td} font-mono text-[13px]`}>{r.toPathOrUrl}</td>
                  <td className={td}>{r.httpStatus}</td>
                  <td className={td}>
                    {r.hits}
                    {r.lastHitAt ? <span className="block text-[12px] text-muted">last {formatDate(r.lastHitAt)}</span> : null}
                  </td>
                  <td className={`${td} text-muted`}>{r.reason}</td>
                  <td className={td}>
                    <div className="flex gap-1">
                      <ActionForm action={toggleRedirectAction} submitLabel={r.enabled ? "Disable" : "Enable"} submitClassName="btn btn-ghost btn-sm" className="">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="enabled" value={r.enabled ? "0" : "1"} />
                      </ActionForm>
                      <ActionForm action={deleteRedirectAction} submitLabel="Delete" submitClassName="btn btn-ghost btn-sm text-danger" className="">
                        <input type="hidden" name="id" value={r.id} />
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? <EmptyRow colSpan={6}>No redirects yet. Changing a published slug creates one automatically.</EmptyRow> : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
