import { z } from "zod";
import { requireUserOrThrow } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/utils/request";
import { createPreviewToken } from "@/server/articles/admin";
import { getSiteOrigin } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";

/** POST {articleId, hours?} → expiring, tokenised preview URL (shareable with reviewers). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const user = await requireUserOrThrow();
    const body = z.object({ articleId: z.string().min(1).max(40), hours: z.number().int().min(1).max(168).optional() }).parse(await req.json());
    const token = await createPreviewToken(user, body.articleId, body.hours ?? 48);
    return Response.json({ ok: true, url: `${getSiteOrigin()}/preview/${token}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = (e as { status?: number }).status ?? (e instanceof z.ZodError ? 422 : 500);
    return Response.json({ ok: false, error: status === 500 ? "Could not create preview." : (e as Error).message }, { status });
  }
}
