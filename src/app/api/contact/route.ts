import { submitContact } from "@/server/leads/actions";
import { isSameOrigin } from "@/lib/utils/request";

export const dynamic = "force-dynamic";

/** JSON/form endpoint for the contact form (same logic as the server action). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false, error: "Cross-origin request blocked." }, { status: 403 });
  const form = req.headers.get("content-type")?.includes("application/json")
    ? Object.entries((await req.json().catch(() => ({}))) as Record<string, unknown>).reduce((f, [k, v]) => (f.append(k, String(v ?? "")), f), new FormData())
    : await req.formData();
  const result = await submitContact({ status: "idle" }, form);
  const status = result.status === "success" ? 200 : (result.status === "error" ? result.message : "").startsWith("You've sent") ? 429 : 422;
  return Response.json(result.status === "success" ? { ok: true, message: result.message } : { ok: false, error: result.status === "error" ? result.message : "Unexpected", fieldErrors: "fieldErrors" in result ? result.fieldErrors : undefined }, { status });
}
