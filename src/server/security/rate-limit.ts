import "server-only";
import { db } from "@/lib/db";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window rate limiter backed by Postgres, so it works across serverless
 * instances without an always-on process. A single upsert keeps it atomic.
 * Put coarse edge/WAF rate limiting in front of this in production.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = new Date();
  const expires = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expires})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
      "windowStart" = CASE WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN ${now} ELSE "rate_limit_buckets"."windowStart" END,
      "expiresAt" = CASE WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN ${expires} ELSE "rate_limit_buckets"."expiresAt" END
    RETURNING "count", "windowStart"`;
  const { count, windowStart } = rows[0]!;
  const retryAfterSeconds = Math.max(0, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000));
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

export async function resetRateLimit(key: string) {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}
