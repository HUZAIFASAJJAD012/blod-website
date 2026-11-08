import type { Metadata } from "next";
import { requireCapability } from "@/lib/auth/session";
import { getSettings } from "@/server/settings";
import { SETTINGS_FORMS } from "@/server/settings/fields";
import { saveSettingsAction } from "@/server/settings/actions";
import { eraseEmailDataAction } from "@/server/leads/admin-actions";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { SettingsFields } from "@/components/admin/settings-fields";

export const metadata: Metadata = { title: "Settings" };

function envStatus(name: string) {
  return process.env[name] ? "configured" : "not set";
}

export default async function SettingsPage() {
  await requireCapability("settings.manage");
  const s = await getSettings();
  return (
    <AdminPage title="Settings" description="Public, non-secret configuration. Secrets (database, SMTP, storage keys, AdSense publisher ID) live in environment variables only.">
      <div className="space-y-6">
        {SETTINGS_FORMS.map((form) => (
          <section key={form.key} id={form.key} className="scroll-mt-24">
            <Panel title={form.title}>
              {form.description ? <p className="mb-4 text-[14px] text-muted">{form.description}</p> : null}
              <ActionForm action={saveSettingsAction}>
                <input type="hidden" name="_key" value={form.key} />
                <SettingsFields fields={form.fields} values={s[form.key] as Record<string, unknown>} prefix={form.key} />
              </ActionForm>
            </Panel>
          </section>
        ))}

        <Panel title="Environment & integrations (read-only)">
          <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
            {[
              ["SITE_URL", process.env.SITE_URL ?? "not set"],
              ["Database", envStatus("DATABASE_URL")],
              ["Email transport", process.env.EMAIL_TRANSPORT ?? "log"],
              ["Contact inbox", envStatus("CONTACT_INBOX")],
              ["Storage driver", process.env.STORAGE_DRIVER ?? "local"],
              ["Cron secret", envStatus("CRON_SECRET")],
              ["AdSense publisher ID", envStatus("ADSENSE_PUBLISHER_ID")],
              ["CMP script", envStatus("CMP_SCRIPT_URL")],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed border-line pb-1">
                <dt className="text-muted">{k}</dt>
                <dd className="font-mono text-[13px]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13.5px] text-muted">
            Backups: rely on your managed Postgres provider&apos;s automated daily backups with point-in-time recovery, plus a weekly <span className="font-mono">pg_dump</span> to separate storage. See docs/DEPLOYMENT.md → Backups for the restore drill.
          </p>
        </Panel>

        <Panel title="Privacy request: erase a person's data">
          <ActionForm action={eraseEmailDataAction} submitLabel="Erase data" submitClassName="btn btn-danger btn-sm" resetOnSuccess className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <label htmlFor="erase-email" className="field-label">Email address</label>
              <input id="erase-email" name="email" type="email" required className="input" />
              <p className="field-hint">Deletes all contact messages and newsletter records for this address. Audit-logged without the email.</p>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </AdminPage>
  );
}
