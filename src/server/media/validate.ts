import { imageSize } from "image-size";

export const ALLOWED_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;
export type AllowedMime = keyof typeof ALLOWED_IMAGE_TYPES;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_DIMENSION = 10_000;

/** Detects the real type from magic bytes — the client-declared MIME is never trusted. SVG is rejected (script risk). */
export function sniffImageType(buf: Uint8Array): AllowedMime | null {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 6 && /^GIF8[79]a$/.test(String.fromCharCode(...b.slice(0, 6)))) return "image/gif";
  if (b.length >= 12 && String.fromCharCode(...b.slice(4, 8)) === "ftyp" && /^avi[fs]$/.test(String.fromCharCode(...b.slice(8, 12)))) return "image/avif";
  return null;
}

export type ValidatedImage = { mime: AllowedMime; ext: string; width: number; height: number; size: number };

export function validateImage(buf: Uint8Array, declaredMime?: string): { ok: true; image: ValidatedImage } | { ok: false; error: string } {
  if (buf.byteLength === 0) return { ok: false, error: "The file is empty." };
  if (buf.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: `Images must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const mime = sniffImageType(buf);
  if (!mime) return { ok: false, error: "Only PNG, JPEG, WebP, GIF or AVIF images are accepted." };
  if (declaredMime && declaredMime !== mime && !(declaredMime === "image/jpg" && mime === "image/jpeg")) {
    return { ok: false, error: "The file's contents don't match its type. Re-export the image and try again." };
  }
  let dims: { width?: number; height?: number };
  try {
    dims = imageSize(buf);
  } catch {
    return { ok: false, error: "The image could not be read. It may be corrupted." };
  }
  if (!dims.width || !dims.height) return { ok: false, error: "Could not determine the image size." };
  if (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) return { ok: false, error: `Images must be at most ${MAX_DIMENSION}px on each side.` };
  return { ok: true, image: { mime, ext: ALLOWED_IMAGE_TYPES[mime], width: dims.width, height: dims.height, size: buf.byteLength } };
}
