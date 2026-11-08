import { subscribeNewsletter } from "@/server/leads/actions";
import { isSameOrigin } from "@/lib/utils/request";

export const dynamic = "force-dynamic";

/** Double opt-in subscribe: always returns the same neutral response (no enumeration). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Cross-origin request blocked." }, { status: 403 });
  const form = req.headers.get("content-type")?.includes("application/json")
    ? Object.entries((await req.json().catch(() => ({}))) as Record<string, unknown>).reduce((f, [k, v]) => (f.append(k, String(v ?? "")), f), new FormData())
    : await req.formData();
  const result = await subscribeNewsletter({ status: "idle" }, form);
  return Response.json(result.status === "success" ? { ok: true, message: result.message } : { ok: false, error: result.status === "error" ? result.message : "Unexpected" }, { status: result.status === "success" ? 200 : (result.status === "error" ? result.message : "").startsWith("Too many") ? 429 : 422 });
}
