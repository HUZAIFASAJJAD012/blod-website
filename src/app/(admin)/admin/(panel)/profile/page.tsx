import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { AdminPage, Notice, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveProfileAction } from "@/server/users/actions";
import { MfaPanel, PasswordPanel } from "@/components/admin/security-panels";
import { slugify } from "@/lib/utils/slug";

export const metadata: Metadata = { title: "Profile" };

type Social = { label: string; url: string };

export default async function ProfilePage({ searchParams }: PageProps<"/admin/profile">) {
  const actor = await requireUser();
  const sp = await searchParams;
  const targetId = typeof sp.user === "string" && (actor.role === "OWNER" || actor.role === "ADMIN") ? sp.user : actor.id;
  const u = await db.user.findUnique({ where: { id: targetId }, include: { profile: true } });
  if (!u) notFound();
  const self = u.id === actor.id;
  const p = u.profile;

  return (
    <AdminPage title={self ? "Your profile" : `Profile: ${u.name}`} description="Author profiles are public pages. Only real people, real experience — no invented credentials.">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {sp.welcome === "1" ? <Notice tone="success">Welcome! Fill in your profile before you publish your first guide.</Notice> : null}
          <Panel title="Public author profile">
            <ActionForm action={saveProfileAction}>
              <input type="hidden" name="userId" value={u.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="p-name">Name</label>
                  <input id="p-name" name="name" defaultValue={u.name} required className="input" />
                </div>
                <div>
                  <label className="field-label" htmlFor="p-slug">Profile URL</label>
                  <input id="p-slug" name="slug" defaultValue={p?.slug ?? slugify(u.name)} required className="input font-mono text-[13px]" />
                  <p className="field-hint">/authors/{p?.slug ?? slugify(u.name)}</p>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="p-role">Role / title</label>
                <input id="p-role" name="roleTitle" defaultValue={p?.roleTitle} className="input" placeholder="e.g. WordPress developer, 9 years running agency hosting" />
              </div>
              <div>
                <label className="field-label" htmlFor="p-bio">Bio</label>
                <textarea id="p-bio" name="bio" defaultValue={p?.bio} className="textarea min-h-[140px]" maxLength={2000} />
              </div>
              <div>
                <label className="field-label" htmlFor="p-q">Experience &amp; qualifications (optional)</label>
                <textarea id="p-q" name="qualificationsText" defaultValue={p?.qualificationsText} className="textarea" maxLength={3000} />
                <p className="field-hint">Only verifiable facts. Leave empty rather than inflate.</p>
              </div>
              <div>
                <label className="field-label" htmlFor="p-social">Links (one per line: Label | https://…)</label>
                <textarea id="p-social" name="social" defaultValue={((Array.isArray(p?.socialLinks) ? p.socialLinks : []) as Social[]).map((s) => `${s.label} | ${s.url}`).join("\n")} className="textarea min-h-[80px] font-mono text-[13px]" />
              </div>
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" name="isPublic" defaultChecked={p?.isPublic} className="checkbox" /> Publish this profile
              </label>
            </ActionForm>
          </Panel>
        </div>
        {self ? (
          <div className="space-y-4">
            <MfaPanel enabled={u.mfaEnabled} />
            <PasswordPanel />
          </div>
        ) : null}
      </div>
    </AdminPage>
  );
}
