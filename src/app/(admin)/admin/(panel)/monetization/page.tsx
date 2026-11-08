import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { getSettings } from "@/server/settings";
import { getAdsRuntime } from "@/lib/ads/config";
import { MONETIZATION_FIELDS } from "@/server/settings/fields";
import { saveMonetizationAction, savePlacementAction } from "@/server/settings/actions";
import { AdminPage, Notice, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { SettingsFields } from "@/components/admin/settings-fields";

export const metadata: Metadata = { title: "Monetization" };

export default async function MonetizationPage() {
  await requireCapability("monetization.manage");
  const [s, placements, runtime, published] = await Promise.all([
    getSettings(),
    db.adPlacement.findMany({ orderBy: { key: "asc" } }),
    getAdsRuntime(),
    db.article.count({ where: { status: "PUBLISHED", visibility: "PUBLIC" } }),
  ]);
  const pub = process.env.ADSENSE_PUBLISHER_ID;
  const m = s.monetization;

  const steps = [
    { done: published > 0, text: `Publish original, useful guides with clear navigation (currently ${published} published). Google publishes no minimum article count.` },
    { done: s.legal.reviewedByCounsel, text: "Privacy policy, terms and contact pages are live and reviewed." },
    { done: Boolean(pub), text: "Apply at adsense.google.com, add the site, then set ADSENSE_PUBLISHER_ID (ca-pub-…) in the environment and redeploy." },
    { done: Boolean(pub), text: "/ads.txt is generated from that ID automatically." },
    { done: m.ownerConfirmedApproval, text: "Wait for Google's review. Only after the approval email, tick the confirmation below." },
    { done: m.cmpConfirmed, text: "Publish a Google-certified CMP message for EEA/UK/Switzerland (AdSense → Privacy & messaging), then confirm below." },
    { done: m.adsEnabled, text: "Choose Auto ads or manual placements, add ad unit IDs, and enable." },
  ];

  return (
    <AdminPage title="Monetization" description="Ads stay off until every condition is met. Nothing here claims or verifies Google approval — that only happens in your AdSense account.">
      <div className="space-y-6">
        <Notice tone={runtime.enabled ? "success" : "info"}>
          {runtime.enabled ? `Ads are live in ${runtime.mode} mode on eligible article pages.` : `Ads are off: ${runtime.reason}`}
        </Notice>

        <Panel title="Readiness checklist">
          <ol className="space-y-2 text-[14.5px]">
            {steps.map((st, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className={st.done ? "text-positive" : "text-muted"}>{st.done ? "✓" : "○"}</span>
                <span className={st.done ? "" : "text-ink/80"}>{st.text}</span>
              </li>
            ))}
          </ol>
          <dl className="mt-4 grid gap-2 text-[14px] sm:grid-cols-2">
            <div className="rounded-md bg-[#FAFAF8] p-3">
              <dt className="mono-label text-muted">Publisher ID (env)</dt>
              <dd className="font-mono">{pub ?? "not configured"}</dd>
            </div>
            <div className="rounded-md bg-[#FAFAF8] p-3">
              <dt className="mono-label text-muted">/ads.txt</dt>
              <dd className="font-mono text-[13px]">{pub ? `google.com, ${pub.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0` : "returns 404 until an ID is set"}</dd>
            </div>
          </dl>
          {m.ownerConfirmedApprovalAt ? <p className="mt-2 text-[13px] text-muted">Approval recorded by an admin on {new Date(m.ownerConfirmedApprovalAt).toLocaleDateString("en-GB")} (editorial record, not a Google API check).</p> : null}
        </Panel>

        <Panel title="Ad settings">
          <ActionForm action={saveMonetizationAction}>
            <SettingsFields fields={MONETIZATION_FIELDS} values={m as unknown as Record<string, unknown>} prefix="mon" />
          </ActionForm>
          <p className="mt-4 text-[13px] text-muted">
            Ads never render on admin, login, preview, search, 404, policy pages, empty categories or short articles, and never next to code-copy buttons or primary calls to action. Labels are limited to Google-permitted wording.
          </p>
        </Panel>

        <Panel title="Manual placements">
          <div className="space-y-4">
            {placements.map((p) => {
              const pos = (p.positions ?? {}) as { minHeightDesktop?: number; minHeightMobile?: number };
              return (
                <ActionForm key={p.id} action={savePlacementAction} className="space-y-3 rounded-md border border-line p-4">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {p.label} <span className="font-mono text-[12px] text-muted">{p.key}</span>
                    </p>
                    <label className="flex items-center gap-2 text-[14px]">
                      <input type="checkbox" name="enabled" defaultChecked={p.enabled} className="checkbox" /> Enabled
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="field-label" htmlFor={`u-${p.id}`}>Ad unit ID (data-ad-slot)</label>
                      <input id={`u-${p.id}`} name="adUnitId" defaultValue={p.adUnitId ?? ""} inputMode="numeric" className="input font-mono" />
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`hd-${p.id}`}>Reserved height desktop (px)</label>
                      <input id={`hd-${p.id}`} name="minHeightDesktop" type="number" defaultValue={pos.minHeightDesktop ?? 280} className="input" />
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`hm-${p.id}`}>Reserved height mobile (px)</label>
                      <input id={`hm-${p.id}`} name="minHeightMobile" type="number" defaultValue={pos.minHeightMobile ?? 250} className="input" />
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`w-${p.id}`}>Min words</label>
                      <input id={`w-${p.id}`} name="minContentThreshold" type="number" defaultValue={p.minContentThreshold ?? 700} className="input" />
                    </div>
                  </div>
                  <div aria-hidden="true" className="ad-slot my-0" title="Preview placeholder">
                    <p className="ad-slot-label">{m.adsLabel} · preview placeholder</p>
                    <div className="grid place-items-center rounded border border-dashed border-line-strong bg-[#FAFAF8] text-[12px] text-muted" style={{ height: Math.min(pos.minHeightDesktop ?? 280, 160) }}>
                      reserved {pos.minHeightDesktop ?? 280}px (desktop) / {pos.minHeightMobile ?? 250}px (mobile)
                    </div>
                  </div>
                </ActionForm>
              );
            })}
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}
