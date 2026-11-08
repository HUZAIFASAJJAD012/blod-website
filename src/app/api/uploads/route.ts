import { z } from "zod";
import { requireUserOrThrow } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/utils/request";
import { rateLimit } from "@/server/security/rate-limit";
import { completePresignedUpload, newObjectKey, uploadImage } from "@/server/media/service";
import { presignPut, storageDriver } from "@/server/media/storage";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/server/media/validate";

export const dynamic = "force-dynamic";

function err(status: number, message: string) {
  return Response.json({ ok: false, error: message }, { status });
}

/**
 * POST multipart (field "file")      → validate + store + register (local driver)
 * POST JSON {action:"presign", ...}  → short-lived presigned PUT URL (s3 driver)
 * POST JSON {action:"complete", ...} → verify uploaded bytes, register media
 * Cookie-authenticated, so every call is Origin-checked (CSRF) and rate-limited.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return err(403, "Cross-origin request blocked.");
  let user;
  try {
    user = await requireUserOrThrow();
  } catch {
    return err(401, "Sign in required.");
  }
  const rl = await rateLimit(`upload:${user.id}`, 60, 3600);
  if (!rl.ok) return err(429, "Upload limit reached. Try again later.");

  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.startsWith("multipart/form-data")) {
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > MAX_UPLOAD_BYTES + 64 * 1024) return err(413, "Images must be under 8 MB.");
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return err(422, "No file received.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const media = await uploadImage(user, bytes, file.type, {
        alt: String(form.get("alt") ?? ""),
        caption: String(form.get("caption") ?? ""),
        copyrightHolder: String(form.get("copyrightHolder") ?? ""),
        license: String(form.get("license") ?? ""),
      });
      return Response.json({ ok: true, media });
    }

    const body = await req.json();
    if (body?.action === "presign") {
      if (storageDriver() !== "s3") return err(400, "Presigned uploads require the s3 storage driver.");
      const p = z
        .object({ mime: z.enum(Object.keys(ALLOWED_IMAGE_TYPES) as [keyof typeof ALLOWED_IMAGE_TYPES]), size: z.number().int().positive().max(MAX_UPLOAD_BYTES) })
        .parse(body);
      const key = newObjectKey(ALLOWED_IMAGE_TYPES[p.mime]);
      return Response.json({ ok: true, key, url: await presignPut(key, p.mime, p.size) });
    }
    if (body?.action === "complete") {
      const p = z.object({ key: z.string().max(80), mime: z.string().max(40), alt: z.string().max(300).optional() }).parse(body);
      const media = await completePresignedUpload(user, p.key, p.mime, { alt: p.alt });
      return Response.json({ ok: true, media });
    }
    return err(400, "Unknown action.");
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (e instanceof z.ZodError) return err(422, e.issues[0]?.message ?? "Invalid request.");
    if (status && status < 500) return err(status, (e as Error).message);
    console.error("[uploads]", e);
    return err(500, "Upload failed. Please retry.");
  }
}
