import { db } from "@/lib/db";
import { safeEqual } from "@/lib/utils/crypto";
import { publishDueArticles } from "@/server/articles/admin";
import { dispatchOutbox } from "@/server/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called every minute by the platform scheduler (Vercel Cron / Railway cron /
 * any external pinger) with `Authorization: Bearer $CRON_SECRET`.
 * Every job is idempotent, so overlapping or retried invocations are harmless.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return Response.json({ ok: false }, { status: 401 });

  const run = await db.jobRun.create({ data: { job: "cron" } });
  const published = await publishDueArticles();
  const email = await dispatchOutbox(50);
  const now = new Date();
  // Housekeeping: expired sessions, tokens and rate-limit buckets; contact retention (24 months).
  const [sessions, buckets, previews] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.previewToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  const contacts = await db.contactSubmission.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 730 * 86400_000) } } });
  const result = { published, email, cleaned: { sessions: sessions.count, buckets: buckets.count, previews: previews.count, contacts: contacts.count } };
  await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), resultJson: result } });
  return Response.json({ ok: true, ...result });
}

export const GET = run; // Vercel Cron issues GET
export const POST = run;
