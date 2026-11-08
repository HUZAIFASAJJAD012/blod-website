import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { AdminPage, Panel, td, th } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { inviteUserAction, revokeInvitationAction, updateUserAccessAction } from "@/server/users/actions";

export const metadata: Metadata = { title: "Authors & users" };

export default async function AuthorsPage() {
  const actor = await requireCapability("users.manage");
  const [users, invites] = await Promise.all([
    db.user.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], include: { profile: true, _count: { select: { articles: true } } } }),
    db.invitation.findMany({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const roles = actor.role === "OWNER" ? ["AUTHOR", "EDITOR", "ADMIN", "OWNER"] : ["AUTHOR", "EDITOR"];

  return (
    <AdminPage title="Authors & users" description="Everyone with CMS access. Authors write drafts; editors review and publish; admins configure the site; owners manage everything.">
      <div className="space-y-6">
        <Panel title="Invite someone">
          <ActionForm action={inviteUserAction} submitLabel="Send invitation" resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_160px] md:items-end">
            <div>
              <label className="field-label" htmlFor="inv-name">Full name (as published)</label>
              <input id="inv-name" name="name" required className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="inv-email">Email</label>
              <input id="inv-email" name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="inv-role">Role</label>
              <select id="inv-role" name="role" className="select" defaultValue="AUTHOR">
                {roles.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}
              </select>
            </div>
          </ActionForm>
          {invites.length ? (
            <ul className="mt-4 divide-y divide-line border-t border-line text-[14px]">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {i.name} · <span className="font-mono">{i.email}</span> · {i.role.toLowerCase()} · expires {i.expiresAt.toLocaleDateString("en-GB")}
                  </span>
                  <ActionForm action={revokeInvitationAction} submitLabel="Revoke" submitClassName="btn btn-ghost btn-sm text-danger" className="">
                    <input type="hidden" name="id" value={i.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full min-w-[880px]">
            <thead className="border-b border-line bg-[#FAFAF8]">
              <tr>
                <th className={th}>Person</th>
                <th className={th}>Public profile</th>
                <th className={th}>Articles</th>
                <th className={th}>Last sign-in</th>
                <th className={th}>Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <span className="font-medium">{u.name}</span>
                    <span className="block font-mono text-[12px] text-muted">{u.email}</span>
                    {u.mfaEnabled ? <span className="badge mt-1">2FA on</span> : null}
                  </td>
                  <td className={td}>
                    {u.profile?.isPublic ? (
                      <Link href={`/authors/${u.profile.slug}`} className="link-underline" target="_blank">/authors/{u.profile.slug}</Link>
                    ) : (
                      <span className="text-muted">private</span>
                    )}
                    <Link href={`/admin/profile?user=${u.id}`} className="block text-[12.5px] text-accent">Edit profile</Link>
                  </td>
                  <td className={td}>{u._count.articles}</td>
                  <td className={`${td} text-muted`}>{u.lastLoginAt ? u.lastLoginAt.toLocaleDateString("en-GB") : "never"}</td>
                  <td className={td}>
                    {u.id === actor.id ? (
                      <span className="text-muted">{u.role.toLowerCase()} (you)</span>
                    ) : (
                      <ActionForm action={updateUserAccessAction} submitLabel="Update" submitClassName="btn btn-secondary btn-sm" className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>Role</label>
                        <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="select min-h-9 w-28 py-1">
                          {(roles.includes(u.role) ? roles : [u.role, ...roles]).map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}
                        </select>
                        <label className="sr-only" htmlFor={`st-${u.id}`}>Status</label>
                        <select id={`st-${u.id}`} name="status" defaultValue={u.status === "INVITED" ? "ACTIVE" : u.status} className="select min-h-9 w-32 py-1">
                          <option value="ACTIVE">active</option>
                          <option value="SUSPENDED">revoked</option>
                        </select>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
