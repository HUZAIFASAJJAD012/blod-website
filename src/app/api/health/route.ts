import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + DB readiness for uptime monitors. Exposes no configuration details. */
export async function GET() {
  const started = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok", latencyMs: Math.round(performance.now() - started) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
