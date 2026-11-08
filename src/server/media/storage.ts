import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Storage drivers:
 *  - local: writes to ./storage/uploads (development and single-server hosting only;
 *    serverless filesystems are ephemeral).
 *  - s3:    any S3-compatible store (AWS S3, Cloudflare R2, Backblaze B2, MinIO).
 *           Browsers upload directly with a short-lived presigned PUT; the server
 *           then verifies the object's real bytes before registering it.
 */
/** Local driver directory (outside /public; served by app/uploads/[...key]/route.ts). */
export const LOCAL_UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads"));

export function storageDriver(): "local" | "s3" {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

let s3: S3Client | null = null;
function client() {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" } : undefined,
    });
  }
  return s3;
}
const bucket = () => {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not configured");
  return b;
};

export function publicUrlFor(key: string): string {
  if (storageDriver() === "local") return `/uploads/${key}`;
  const base = process.env.MEDIA_PUBLIC_BASE_URL;
  if (!base) throw new Error("MEDIA_PUBLIC_BASE_URL is required for the s3 driver");
  return `${base.replace(/\/+$/, "")}/${key}`;
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  if (storageDriver() === "local") {
    const file = path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, key);
    if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) throw new Error("Invalid key");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
}

export async function presignPut(key: string, contentType: string, contentLength: number) {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: contentLength, CacheControl: "public, max-age=31536000, immutable" }), {
    expiresIn: 300,
  });
}

/** Reads the whole (size-capped) object back so we can verify its real bytes. */
export async function readObject(key: string, maxBytes: number): Promise<{ bytes: Uint8Array; size: number } | null> {
  try {
    const head = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    const size = Number(head.ContentLength ?? 0);
    if (size > maxBytes) return { bytes: new Uint8Array(), size };
    const obj = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await obj.Body!.transformToByteArray();
    return { bytes, size };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  if (storageDriver() === "local") {
    const file = path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, key);
    if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return;
    await unlink(file).catch(() => undefined);
    return;
  }
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch(() => undefined);
}
