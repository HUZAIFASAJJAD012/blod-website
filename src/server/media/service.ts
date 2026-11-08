import "server-only";
import { db } from "@/lib/db";
import { can, ForbiddenError, type Actor } from "@/lib/permissions";
import { randomToken } from "@/lib/utils/crypto";
import { audit } from "@/server/security/audit";
import { deleteObject, publicUrlFor, putObject, readObject } from "./storage";
import { MAX_UPLOAD_BYTES, validateImage } from "./validate";

export function newObjectKey(ext: string) {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomToken(12).replace(/[^A-Za-z0-9]/g, "").toLowerCase()}.${ext}`;
}

type Meta = { alt?: string; caption?: string; title?: string; copyrightHolder?: string; license?: string; sourceUrl?: string };

function cleanMeta(m: Meta) {
  const t = (v: string | undefined, n: number) => (v ? v.trim().slice(0, n) || null : null);
  return { alt: m.alt?.trim().slice(0, 300) ?? "", caption: t(m.caption, 400), title: t(m.title, 200), copyrightHolder: t(m.copyrightHolder, 200), license: t(m.license, 120), sourceUrl: t(m.sourceUrl, 1000) };
}

/** Server-proxied upload (local driver, or small files). Bytes are validated before storing. */
export async function uploadImage(actor: Actor, bytes: Uint8Array, declaredMime: string | undefined, meta: Meta) {
  const v = validateImage(bytes, declaredMime);
  if (!v.ok) throw Object.assign(new Error(v.error), { status: 422 });
  const key = newObjectKey(v.image.ext);
  await putObject(key, bytes, v.image.mime);
  const media = await db.media.create({
    data: { providerKey: key, fileUrl: publicUrlFor(key), width: v.image.width, height: v.image.height, mime: v.image.mime, size: v.image.size, uploadedById: actor.id, ...cleanMeta(meta) },
  });
  await audit({ actorId: actor.id, action: "media.upload", entityType: "Media", entityId: media.id, summary: { mime: media.mime, size: media.size } });
  return media;
}

/** S3 flow step 2: verify what was actually uploaded under the presigned key, then register it. */
export async function completePresignedUpload(actor: Actor, key: string, declaredMime: string, meta: Meta) {
  if (!/^\d{4}\/\d{2}\/[a-z0-9]{8,32}\.(png|jpg|webp|gif|avif)$/.test(key)) throw Object.assign(new Error("Invalid upload key."), { status: 422 });
  if (await db.media.findUnique({ where: { providerKey: key } })) throw Object.assign(new Error("Already registered."), { status: 409 });
  const obj = await readObject(key, MAX_UPLOAD_BYTES);
  if (!obj) throw Object.assign(new Error("Upload not found. Please retry."), { status: 422 });
  if (obj.size > MAX_UPLOAD_BYTES) {
    await deleteObject(key);
    throw Object.assign(new Error("Images must be under 8 MB."), { status: 422 });
  }
  const v = validateImage(obj.bytes, declaredMime);
  if (!v.ok) {
    await deleteObject(key);
    throw Object.assign(new Error(v.error), { status: 422 });
  }
  if (!key.endsWith(`.${v.image.ext}`)) {
    await deleteObject(key);
    throw Object.assign(new Error("File type doesn't match its extension."), { status: 422 });
  }
  const media = await db.media.create({
    data: { providerKey: key, fileUrl: publicUrlFor(key), width: v.image.width, height: v.image.height, mime: v.image.mime, size: v.image.size, uploadedById: actor.id, ...cleanMeta(meta) },
  });
  await audit({ actorId: actor.id, action: "media.upload", entityType: "Media", entityId: media.id, summary: { mime: media.mime, size: media.size, presigned: true } });
  return media;
}

export async function updateMediaMeta(actor: Actor, id: string, meta: Meta & { focalX?: number | null; focalY?: number | null }) {
  const m = await db.media.findUnique({ where: { id } });
  if (!m) throw new ForbiddenError("Not found");
  if (m.uploadedById !== actor.id && !can(actor, "media.manageAny")) throw new ForbiddenError();
  const clamp = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.min(1, Math.max(0, n)));
  const updated = await db.media.update({ where: { id }, data: { ...cleanMeta(meta), focalX: clamp(meta.focalX), focalY: clamp(meta.focalY) } });
  await audit({ actorId: actor.id, action: "media.update", entityType: "Media", entityId: id });
  return updated;
}

/** Where a media item is used — body images are found by scanning article JSON. */
export async function mediaUsage(id: string) {
  const m = await db.media.findUnique({ where: { id }, select: { fileUrl: true } });
  if (!m) return { covers: 0, ogImages: 0, inBody: 0, users: 0, categories: 0, total: 0 };
  const [covers, ogImages, users, categories, inBodyRows] = await Promise.all([
    db.article.count({ where: { coverMediaId: id } }),
    db.article.count({ where: { ogImageId: id } }),
    db.user.count({ where: { imageId: id } }),
    db.category.count({ where: { featuredMediaId: id } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "articles" WHERE "bodyJson"::text LIKE ${"%" + m.fileUrl.replace(/[%_]/g, "") + "%"}`,
  ]);
  const inBody = Number(inBodyRows[0]?.n ?? 0);
  return { covers, ogImages, inBody, users, categories, total: covers + ogImages + inBody + users + categories };
}

export async function deleteMedia(actor: Actor, id: string, opts: { force?: boolean } = {}) {
  const m = await db.media.findUnique({ where: { id } });
  if (!m) return;
  if (m.uploadedById !== actor.id && !can(actor, "media.manageAny")) throw new ForbiddenError();
  const usage = await mediaUsage(id);
  if (usage.total > 0 && !opts.force) throw Object.assign(new Error(`This image is used in ${usage.total} place(s). Remove it there first.`), { status: 409 });
  await db.media.delete({ where: { id } });
  await deleteObject(m.providerKey);
  await audit({ actorId: actor.id, action: "media.delete", entityType: "Media", entityId: id, summary: { key: m.providerKey } });
}

/** Orphans: uploaded > 24h ago and referenced nowhere. Used by the media cleanup tool. */
export async function findOrphans(limit = 200) {
  const candidates = await db.media.findMany({
    where: { createdAt: { lt: new Date(Date.now() - 86400_000) }, covers: { none: {} }, ogImages: { none: {} }, userImages: { none: {} }, categoryImages: { none: {} } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  const out = [];
  for (const c of candidates) if ((await mediaUsage(c.id)).inBody === 0) out.push(c);
  return out;
}
