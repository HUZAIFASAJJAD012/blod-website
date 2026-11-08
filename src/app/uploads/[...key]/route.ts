import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { LOCAL_UPLOAD_DIR } from "@/server/media/storage";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif" };

/**
 * Serves files written by the local storage driver. (Next.js only serves files
 * that were in /public at build time, so runtime uploads need a handler.)
 * Keys are generated server-side; anything else is a 404. With the s3 driver,
 * media is served from MEDIA_PUBLIC_BASE_URL and this route is unused.
 */
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...key]">) {
  const { key } = await ctx.params;
  const rel = key.join("/");
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  if (!/^\d{4}\/\d{2}\/[a-z0-9]{8,32}\.(png|jpg|webp|gif|avif)$/.test(rel) || !TYPES[ext]) return new Response("Not found", { status: 404 });
  const file = path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, rel);
  if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const [buf, st] = await Promise.all([readFile(file), stat(file)]);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[ext]!,
        "Content-Length": String(st.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
