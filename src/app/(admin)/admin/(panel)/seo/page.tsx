import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { getSettings } from "@/server/settings";
import { AdminPage, Panel, Stat } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { clearNotFoundAction, rerunAllChecksAction } from "@/server/seo/actions";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "SEO issues" };

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400_000);
}

export default async function SeoPage() {
  await requireCapability("seo.view");
  const s = await getSettings();
  const staleBefore = daysAgo(s.seo.staleAfterDays);
  const pub = { status: "PUBLISHED" as const };

  const [checks, excluded, dupCanon, stale, notFound, lastRun] = await Promise.all([
    db.contentCheck.findMany({
      where: { severity: { in: ["ERROR", "WARNING"] }, article: { status: { not: "ARCHIVED" } } },
      include: { article: { select: { id: true, title: true, status: true } } },
      orderBy: [{ severity: "asc" }, { checkType: "asc" }],
      take: 400,
    }),
    db.article.findMany({ where: { ...pub, OR: [{ robotsIndex: false }, { canonicalOverride: { not: null } }, { visibility: "PRIVATE" }] }, select: { id: true, title: true, robotsIndex: true, canonicalOverride: true, visibility: true } }),
    db.$queryRaw<{ canonical: string; n: bigint }[]>`SELECT "canonicalOverride" AS canonical, COUNT(*) AS n FROM "articles" WHERE "canonicalOverride" IS NOT NULL AND "status" <> 'ARCHIVED' GROUP BY "canonicalOverride" HAVING COUNT(*) > 1`,
    db.article.findMany({
      where: { ...pub, AND: [{ OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: staleBefore } }] }, { OR: [{ materiallyUpdatedAt: null }, { materiallyUpdatedAt: { lt: staleBefore } }] }, { firstPublishedAt: { lt: staleBefore } }] },
      select: { id: true, title: true, lastVerifiedAt: true, firstPublishedAt: true },
      orderBy: { firstPublishedAt: "asc" },
      take: 50,
    }),
    db.notFoundEvent.findMany({ orderBy: [{ hits: "desc" }], take: 50 }),
    db.contentCheck.findFirst({ orderBy: { checkedAt: "desc" }, select: { checkedAt: true } }),
  ]);

  const byType = new Map<string, typeof checks>();
  for (const c of checks) byType.set(c.checkType, [...(byType.get(c.checkType) ?? []), c]);
  const groups = [...byType.entries()].sort((a, b) => (a[1][0]!.severity === "ERROR" ? -1 : 1) - (b[1][0]!.severity === "ERROR" ? -1 : 1));

  return (
    <AdminPage
      title="SEO issues"
      description="Technical and editorial issues found by the site's own checks. These are advisory, not a ranking score. Search Console remains the source of truth for indexing."
      actions={
        <ActionForm action={rerunAllChecksAction} submitLabel="Re-run all checks" submitClassName="btn btn-secondary btn-sm" className="">
          <></>
        </ActionForm>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Errors" value={checks.filter((c) => c.severity === "ERROR").length} />
          <Stat label="Warnings" value={checks.filter((c) => c.severity === "WARNING").length} />
          <Stat label="Excluded from sitemap" value={excluded.length} />
          <Stat label="404 paths" value={notFound.length} />
        </div>
        <p className="text-[13px] text-muted">Last check run: {lastRun ? lastRun.checkedAt.toLocaleString("en-GB") : "never"}.</p>

        <Panel title="Content & link issues">
          {groups.length ? (
            <div className="space-y-4">
              {groups.map(([type, list]) => (
                <details key={type} open={list[0]!.severity === "ERROR"}>
                  <summary className="cursor-pointer text-[14.5px] font-medium">
                    <span className={`mr-2 font-mono text-[11px] uppercase ${list[0]!.severity === "ERROR" ? "text-danger" : "text-warning"}`}>{list[0]!.severity.toLowerCase()}</span>
                    {type.replace(/_/g, " ")} ({list.length})
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4 text-[14px]">
                    {list.map((c) => (
                      <li key={c.id}>
                        <Link href={`/admin/articles/${c.article.id}/edit`} className="link-underline">{c.article.title}</Link>
                        <span className="text-muted"> — {String((c.resultJson as { message?: string }).message ?? "")}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-muted">No errors or warnings on the last run.</p>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Published but excluded from sitemap">
            <ul className="space-y-1 text-[14px]">
              {excluded.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/articles/${a.id}/edit`} className="link-underline">{a.title}</Link>
                  <span className="text-muted"> — {[!a.robotsIndex && "noindex", a.canonicalOverride && "canonical elsewhere", a.visibility === "PRIVATE" && "private"].filter(Boolean).join(", ")}</span>
                </li>
              ))}
              {!excluded.length ? <li className="text-muted">None.</li> : null}
            </ul>
            {dupCanon.length ? (
              <div className="mt-4">
                <p className="text-[14px] font-medium text-danger">Duplicate canonical targets</p>
                <ul className="text-[13px]">{dupCanon.map((d) => <li key={d.canonical} className="font-mono">{d.canonical} ×{Number(d.n)}</li>)}</ul>
              </div>
            ) : null}
          </Panel>

          <Panel title={`Stale guides (not verified or updated in ${s.seo.staleAfterDays} days)`}>
            <ul className="space-y-1 text-[14px]">
              {stale.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/articles/${a.id}/edit`} className="link-underline">{a.title}</Link>
                  <span className="text-muted"> — last tested {a.lastVerifiedAt ? formatDate(a.lastVerifiedAt) : "never"}</span>
                </li>
              ))}
              {!stale.length ? <li className="text-muted">Nothing stale.</li> : null}
            </ul>
          </Panel>
        </div>

        <section id="404s" className="scroll-mt-24">
          <Panel title="404s (most hit)" actions={notFound.length ? <ActionForm action={clearNotFoundAction} submitLabel="Clear all" submitClassName="text-[13px] text-accent" className=""><></></ActionForm> : null}>
            <ul className="divide-y divide-line text-[14px]">
              {notFound.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono text-[13px]">{e.path}</span>
                  <span className="flex items-center gap-3">
                    <span className="mono-label text-muted">{e.hits}× · last {formatDate(e.lastSeenAt)}{e.referrer ? ` · from ${e.referrer.slice(0, 40)}` : ""}</span>
                    <Link href={`/admin/redirects?from=${encodeURIComponent(e.path)}`} className="btn btn-secondary btn-sm">Redirect…</Link>
                  </span>
                </li>
              ))}
              {!notFound.length ? <li className="py-4 text-muted">No 404s recorded.</li> : null}
            </ul>
          </Panel>
        </section>

        <Panel title="Search Console & external checks">
          <ul className="list-disc space-y-1 pl-5 text-[14px]">
            <li>Indexing status, impressions and queries come only from Google Search Console — this CMS does not estimate them.</li>
            <li>Validate structured data with the Rich Results Test; check pages with URL Inspection and PageSpeed Insights.</li>
            <li>Sitemap to submit: <span className="font-mono">{process.env.SITE_URL}/sitemap.xml</span></li>
          </ul>
        </Panel>
      </div>
    </AdminPage>
  );
}
