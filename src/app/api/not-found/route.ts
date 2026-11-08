import { z } from "zod";
import { recordNotFound } from "@/server/redirects";
import { hashIdentifier } from "@/lib/utils/crypto";
import { ipFromHeaders, isSameOrigin } from "@/lib/utils/request";
import { rateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

/** Beacon from the 404 page (keeps the 404 page static and cacheable). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 204 });
  const rl = await rateLimit(`404:${hashIdentifier(ipFromHeaders(req.headers))}`, 30, 600);
  if (!rl.ok) return new Response(null, { status: 204 });
  const body = z.object({ path: z.string().max(400), referrer: z.string().max(400).optional() }).safeParse(await req.json().catch(() => null));
  if (body.success && body.data.path.startsWith("/")) {
    let ref: string | null = null;
    try {
      ref = body.data.referrer ? new URL(body.data.referrer).origin : null; // origin only — no query strings or personal data
    } catch {
      /* ignore */
    }
    await recordNotFound(body.data.path, ref);
  }
  return new Response(null, { status: 204 });
}
