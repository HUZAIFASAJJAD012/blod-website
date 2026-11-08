"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { listMediaAction, type MediaItem } from "@/server/media/actions";

/** Uploads one image through /api/uploads (server-validated) or the presigned S3 flow. */
export async function uploadFile(file: File, alt: string, opts: { presigned: boolean }): Promise<MediaItem> {
  if (opts.presigned) {
    const pre = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "presign", mime: file.type, size: file.size }) }).then((r) => r.json());
    if (!pre.ok) throw new Error(pre.error);
    const put = await fetch(pre.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!put.ok) throw new Error("Upload to storage failed.");
    const done = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", key: pre.key, mime: file.type, alt }) }).then((r) => r.json());
    if (!done.ok) throw new Error(done.error);
    return done.media;
  }
  const fd = new FormData();
  fd.set("file", file);
  fd.set("alt", alt);
  const res = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json());
  if (!res.ok) throw new Error(res.error);
  return { ...res.media, createdAt: String(res.media.createdAt) };
}

export function MediaPicker({ open, onClose, onSelect, presigned, title = "Choose an image" }: { open: boolean; onClose: () => void; onSelect: (m: MediaItem) => void; presigned: boolean; title?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (query: string) => {
    const res = await listMediaAction(query, 1);
    setItems(res.items);
  }, []);

  useEffect(() => {
    if (!open) {
      ref.current?.close();
      return;
    }
    ref.current?.showModal();
    let live = true;
    listMediaAction("", 1).then((res) => live && setItems(res.items));
    return () => {
      live = false;
    };
  }, [open]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a file first.");
    if (!alt.trim()) return setError("Describe the image in the alt text field (what does it show?).");
    setBusy(true);
    setError(null);
    try {
      const m = await uploadFile(file, alt.trim(), { presigned });
      onSelect(m);
      setAlt("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="mp-title" className="m-auto w-[min(96vw,880px)] rounded-[12px] border border-line bg-surface p-0 backdrop:bg-black/40">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="mp-title" className="text-[17px] font-semibold">
          {title}
        </h2>
        <button type="button" className="btn btn-ghost h-9 w-9 p-0" aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-3 border-b border-line bg-[#FAFAF8] px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="mp-file" className="field-label">
            Upload (PNG, JPEG, WebP, GIF, AVIF · max 8 MB)
          </label>
          <input id="mp-file" ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="block w-full text-[14px]" />
        </div>
        <div>
          <label htmlFor="mp-alt" className="field-label">
            Alt text
          </label>
          <input id="mp-alt" className="input" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Cloudflare SSL/TLS settings set to Full (strict)" />
        </div>
        <button type="button" className="btn btn-primary" onClick={upload} disabled={busy}>
          <Upload size={15} aria-hidden="true" /> {busy ? "Uploading…" : "Upload"}
        </button>
        {error ? (
          <p role="alert" className="field-error sm:col-span-3">
            {error}
          </p>
        ) : null}
      </div>
      <div className="px-5 py-4">
        <label htmlFor="mp-q" className="sr-only">
          Search media
        </label>
        <input
          id="mp-q"
          className="input mb-3"
          placeholder="Search by alt text or caption"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            void load(e.target.value);
          }}
        />
        <ul className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onSelect(m)} className="group block w-full overflow-hidden rounded-[8px] border border-line text-left hover:border-accent focus-visible:border-accent">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                <img src={m.fileUrl} alt={m.alt} className="aspect-[4/3] w-full bg-[#eee] object-cover" loading="lazy" />
                <span className="block truncate px-2 py-1.5 text-[12px] text-muted">{m.alt || <em className="text-warning">no alt text</em>}</span>
              </button>
            </li>
          ))}
          {!items.length ? <li className="col-span-full py-8 text-center text-muted">No images yet.</li> : null}
        </ul>
      </div>
    </dialog>
  );
}
