import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getSettings } from "@/server/settings";
import { AdminPage, Notice, Panel, Stat, StatusBadge } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

/** Scheduled items more than 5 minutes past due mean the cron job is not running. */
function hasOverdue(items: { scheduledAt: Date | null }[]) {
  const cutoff = Date.now() - 5 * 60_000;
  return items.some((s) => s.scheduledAt && s.scheduledAt.getTime() < cutoff);
}

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = can(user, "article.editAny") ? {} : { authorId: user.id };
  const [counts, scheduled, recent, notFound, inquiries, settings, lastCron, owner] = await Promise.all([
    db.article.groupBy({ by: ["status"], where: scope, _count: true }),
    db.article.findMany({ where: { ...scope, status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" }, take: 6, select: { id: true, title: true, scheduledAt: true, scheduleTimezone: true } }),
    db.article.findMany({ where: scope, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, title: true, status: true, updatedAt: true, author: { select: { name: true } } } }),
    can(user, "seo.view") ? db.notFoundEvent.findMany({ orderBy: [{ lastSeenAt: "desc" }], take: 6 }) : Promise.resolve([]),
    can(user, "inbox.view") ? db.contactSubmission.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, subject: true, topic: true, createdAt: true } }) : Promise.resolve([]),
    getSettings(),
    db.jobRun.findFirst({ where: { job: "cron" }, orderBy: { startedAt: "desc" } }),
    db.user.findUnique({ where: { id: user.id }, include: { profile: true } }),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>;
  const n = (s: string) => by[s] ?? 0;
  const overdue = hasOverdue(scheduled);

  return (
    <AdminPage
      title={`Hello, ${user.name.split(" ")[0]}`}
      description={can(user, "article.editAny") ? "Everything below is live data from the database." : "Your articles at a glance."}
      actions={
        <Link href="/admin/articles/new" className="btn btn-primary btn-sm">
          New article
        </Link>
      }
    >
      <div className="space-y-6">
        {sp.denied === "1" ? <Notice tone="danger">You don&apos;t have permission to open that page.</Notice> : null}
        {!owner?.profile?.isPublic || !owner.profile.bio ? (
          <Notice tone="warning">
            Your public author profile isn&apos;t complete. Readers should be able to see who wrote each guide. <Link href="/admin/profile" className="underline">Complete your profile</Link>
          </Notice>
        ) : null}
        {can(user, "settings.manage") && !settings.legal.reviewedByCounsel ? (
          <Notice tone="warning">
            The privacy policy and terms are templates written to match this software. Have them reviewed for your jurisdiction, then record that in <Link href="/admin/settings#legal" className="underline">Settings → Legal</Link>.
          </Notice>
        ) : null}
        {overdue ? (
          <Notice tone="danger">
            A scheduled article is overdue. The cron job may not be running — {lastCron ? `last run ${lastCron.startedAt.toLocaleString("en-GB")}` : "it has never run"}. See docs/DEPLOYMENT.md → Cron.
          </Notice>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Published" value={n("PUBLISHED")} href="/admin/articles?status=PUBLISHED" />
          <Stat label="Drafts" value={n("DRAFT")} href="/admin/articles?status=DRAFT" />
          <Stat label="In review" value={n("IN_REVIEW")} href="/admin/articles?status=IN_REVIEW" />
          <Stat label="Approved" value={n("APPROVED")} href="/admin/articles?status=APPROVED" />
          <Stat label="Scheduled" value={n("SCHEDULED")} href="/admin/articles?status=SCHEDULED" />
          <Stat label="Archived" value={n("ARCHIVED")} href="/admin/articles?status=ARCHIVED" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Recent changes">
            <ul className="divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/articles/${a.id}/edit`} className="block truncate font-medium no-underline hover:text-accent">
                      {a.title}
                    </Link>
                    <p className="text-[13px] text-muted">
                      {a.author.name} · {a.updatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
              {!recent.length ? <li className="py-6 text-center text-muted">No articles yet. Start with your first tested guide.</li> : null}
            </ul>
          </Panel>

          <Panel title="Publishing queue">
            <ul className="divide-y divide-line">
              {scheduled.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/articles/${a.id}/edit`} className="truncate no-underline hover:text-accent">
                    {a.title}
                  </Link>
                  <span className="mono-label shrink-0 text-muted">
                    {a.scheduledAt?.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: a.scheduleTimezone ?? "UTC" })} {a.scheduleTimezone}
                  </span>
                </li>
              ))}
              {!scheduled.length ? <li className="py-6 text-center text-muted">Nothing scheduled.</li> : null}
            </ul>
            <p className="mt-3 text-[13px] text-muted">Cron: {lastCron ? `last run ${lastCron.startedAt.toLocaleString("en-GB")}` : "no runs recorded yet"}.</p>
          </Panel>

          {can(user, "inbox.view") ? (
            <Panel title="New enquiries" actions={<Link href="/admin/inbox" className="text-[13px] text-accent">Open inbox</Link>}>
              <ul className="divide-y divide-line">
                {inquiries.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/admin/inbox/${q.id}`} className="truncate no-underline hover:text-accent">
                      {q.subject}
                    </Link>
                    <span className="badge shrink-0">{q.topic}</span>
                  </li>
                ))}
                {!inquiries.length ? <li className="py-6 text-center text-muted">No unread messages.</li> : null}
              </ul>
            </Panel>
          ) : null}

          {can(user, "seo.view") ? (
            <Panel title="Recent 404s" actions={<Link href="/admin/seo#404s" className="text-[13px] text-accent">All</Link>}>
              <ul className="divide-y divide-line">
                {notFound.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate font-mono text-[13px]">{e.path}</span>
                    <span className="mono-label shrink-0 text-muted">
                      {e.hits}× · {formatDate(e.lastSeenAt)}
                    </span>
                  </li>
                ))}
                {!notFound.length ? <li className="py-6 text-center text-muted">No 404s recorded.</li> : null}
              </ul>
            </Panel>
          ) : null}
        </div>

        <Panel title="Search & traffic analytics">
          <p className="text-[14.5px] text-muted">
            No analytics data source is connected, so no traffic figures are shown here — we never display estimated or sample numbers. Use Google Search Console and GA4 directly; setup steps are in <span className="font-mono">docs/SEARCH-CONSOLE-GA4.md</span>.
            {settings.analytics.ga4MeasurementId ? ` GA4 tag is installed (${settings.analytics.ga4MeasurementId}).` : " GA4 is not configured."}
          </p>
        </Panel>
      </div>
    </AdminPage>
  );
}
