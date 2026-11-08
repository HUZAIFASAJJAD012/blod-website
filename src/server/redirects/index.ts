import "server-only";
import { db, type Prisma } from "@/lib/db";

export type RedirectEntry = { to: string; status: number; id: string };

/** Normalise a path for matching: leading slash, no trailing slash (except root), no query. */
export function normalizePath(path: string): string {
  let p = path.split("?")[0]!.split("#")[0]!.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLowerCase().slice(0, 500);
}

/**
 * Follow a candidate redirect through the existing table. Returns an error if the
 * new rule would create a loop, or the final target if it would create a chain
 * (so the caller can point directly to the final destination — one hop only).
 */
export async function analyzeRedirect(fromPath: string, to: string, excludeId?: string, tx: Prisma.TransactionClient | typeof db = db) {
  const from = normalizePath(fromPath);
  if (/^https?:\/\//.test(to)) return { ok: true as const, finalTarget: to, chained: false };
  let current = normalizePath(to);
  if (current === from) return { ok: false as const, error: "A redirect cannot point to itself." };
  const seen = new Set([from]);
  let chained = false;
  for (let i = 0; i < 20; i++) {
    const next = await tx.redirect.findFirst({ where: { fromPath: current, enabled: true, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
    if (!next) break;
    chained = true;
    if (/^https?:\/\//.test(next.toPathOrUrl)) return { ok: true as const, finalTarget: next.toPathOrUrl, chained };
    const n = normalizePath(next.toPathOrUrl);
    if (seen.has(n) || n === from) return { ok: false as const, error: `This would create a redirect loop via ${current}.` };
    seen.add(current);
    current = n;
  }
  return { ok: true as const, finalTarget: current, chained };
}

/**
 * Create/replace a redirect and collapse chains: existing rules that pointed at
 * `from` are re-pointed at the new final destination, so every old URL stays one hop.
 */
export async function upsertRedirect(
  input: { fromPath: string; to: string; status?: 301 | 308; reason: string },
  tx: Prisma.TransactionClient | typeof db = db,
) {
  const from = normalizePath(input.fromPath);
  const analysis = await analyzeRedirect(from, input.to, undefined, tx);
  if (!analysis.ok) throw new Error(analysis.error);
  const target = analysis.finalTarget;
  const status = input.status ?? 301;
  // A path that is redirected must not also be a redirect target that points back.
  await tx.redirect.deleteMany({ where: { fromPath: normalizePath(target) } });
  const row = await tx.redirect.upsert({
    where: { fromPath: from },
    create: { fromPath: from, toPathOrUrl: target, httpStatus: status, reason: input.reason },
    update: { toPathOrUrl: target, httpStatus: status, reason: input.reason, enabled: true },
  });
  await tx.redirect.updateMany({ where: { toPathOrUrl: from }, data: { toPathOrUrl: target } });
  return row;
}

export async function recordNotFound(path: string, referrer: string | null) {
  const p = normalizePath(path);
  if (p.startsWith("/_next") || p.startsWith("/api") || p.length > 400) return;
  try {
    await db.notFoundEvent.upsert({
      where: { path: p },
      create: { path: p, referrer: referrer?.slice(0, 300) ?? null },
      update: { hits: { increment: 1 }, lastSeenAt: new Date(), referrer: referrer?.slice(0, 300) ?? undefined },
    });
  } catch {
    /* non-critical */
  }
}

/**
 * Page-level fallback for the brief window where proxy.ts still holds a cached
 * rule set (e.g. a slug changed seconds ago). Call before notFound().
 */
export async function redirectIfManaged(path: string) {
  const { permanentRedirect } = await import("next/navigation");
  const rule = await db.redirect.findFirst({ where: { fromPath: normalizePath(path), enabled: true }, select: { toPathOrUrl: true } });
  if (rule) permanentRedirect(rule.toPathOrUrl);
}
