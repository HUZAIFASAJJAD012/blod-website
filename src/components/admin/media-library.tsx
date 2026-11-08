"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { cleanupOrphansAction, deleteMediaAction, mediaUsageAction, updateMediaAction } from "@/server/media/actions";
import { MediaPicker } from "@/components/editor/media-picker";
import { ConfirmButton } from "./confirm-button";

type Item = {
  id: string;
  fileUrl: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  copyrightHolder: string;
  license: string;
  sourceUrl: string;
  focalX: number | null;
  focalY: number | null;
  mime: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
};

function Editor({ item, onDone }: { item: Item; onDone: () => void }) {
  const [m, setM] = useState(item);
  const [msg, setMsg] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const imgRef = useRef<HTMLImageElement>(null);
  const field = (k: keyof Item, label: string, ph = "") => (
    <div>
      <label htmlFor={`${k}-${m.id}`} className="field-label">{label}</label>
      <input id={`${k}-${m.id}`} className="input" value={String(m[k] ?? "")} placeholder={ph} onChange={(e) => setM({ ...m, [k]: e.target.value })} />
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <p className="mb-1 text-[12.5px] text-muted">Click the image to set the focal point used when it&apos;s cropped.</p>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
          <img
            ref={imgRef}
            src={m.fileUrl}
            alt={m.alt}
            className="w-full cursor-crosshair rounded-md border border-line"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setM({ ...m, focalX: Math.round(((e.clientX - r.left) / r.width) * 100) / 100, focalY: Math.round(((e.clientY - r.top) / r.height) * 100) / 100 });
            }}
          />
          {m.focalX !== null && m.focalY !== null ? <span aria-hidden="true" className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 shadow" style={{ left: `${m.focalX * 100}%`, top: `${m.focalY * 100}%` }} /> : null}
        </div>
        <p className="mono-label mt-1 text-muted">
          {m.width}×{m.height} · {m.mime} · {(m.size / 1024).toFixed(0)} KB · by {m.uploadedBy}
        </p>
      </div>
      <div className="space-y-3">
        {field("alt", "Alt text", "What the image shows")}
        {field("caption", "Caption")}
        {field("copyrightHolder", "Credit / copyright holder")}
        {field("license", "Licence", "e.g. Own work, CC BY 4.0")}
        {field("sourceUrl", "Source URL")}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateMediaAction(m.id, { alt: m.alt, caption: m.caption, copyrightHolder: m.copyrightHolder, license: m.license, sourceUrl: m.sourceUrl, focalX: m.focalX, focalY: m.focalY });
                setMsg(r.ok ? "Saved." : r.error);
              })
            }
          >
            Save
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { const u = await mediaUsageAction(m.id); setUsage(`Used: ${u.covers} cover(s), ${u.ogImages} social image(s), ${u.inBody} article body(ies), ${u.users} avatar(s), ${u.categories} categor(ies).`); }}>
            Where is it used?
          </button>
          <ConfirmButton
            label="Delete"
            className="btn btn-ghost btn-sm text-danger"
            title="Delete this image?"
            body="Deletion is permanent and removes the file from storage. Images that are still in use are protected."
            tone="danger"
            confirmLabel="Delete"
            onConfirm={async () => {
              const r = await deleteMediaAction(m.id);
              if (!r.ok) return r.error;
              onDone();
            }}
          />
        </div>
        {msg ? <p role="status" className="text-[13.5px]">{msg}</p> : null}
        {usage ? <p className="text-[13px] text-muted">{usage}</p> : null}
      </div>
    </div>
  );
}

export function MediaLibrary({ items, q, missingAlt, canCleanup, presigned }: { items: Item[]; q: string; missingAlt: boolean; canCleanup: boolean; presigned: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex gap-2">
          <label htmlFor="mq" className="sr-only">Search</label>
          <input id="mq" name="q" defaultValue={q} className="input min-h-9 w-64 py-1.5" placeholder="Search alt text or caption" />
          <button className="btn btn-secondary btn-sm">Search</button>
        </form>
        <a href={missingAlt ? "/admin/media" : "/admin/media?filter=missing-alt"} className="chip">{missingAlt ? "Show all" : "Missing alt text"}</a>
        <span className="ml-auto flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setUpload(true)}>Upload</button>
          {canCleanup ? (
            <ConfirmButton
              label="Clean up unused"
              title="Delete unused images?"
              body="Deletes images uploaded more than 24 hours ago that aren't used as a cover, social image, avatar, category image or inside any article body."
              tone="danger"
              confirmLabel="Delete unused"
              onConfirm={async () => {
                const r = await cleanupOrphansAction();
                if (!r.ok) return r.error;
                setNote(`${r.data.deleted} unused image(s) deleted.`);
                router.refresh();
              }}
            />
          ) : null}
        </span>
      </div>
      {note ? <p role="status" className="mb-3 text-[14px] text-positive">{note}</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((m) => (
          <li key={m.id} className={open === m.id ? "col-span-full rounded-[10px] border border-ink bg-surface p-4" : ""}>
            {open === m.id ? (
              <>
                <div className="mb-3 flex justify-end">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Close</button>
                </div>
                <Editor item={m} onDone={() => (setOpen(null), router.refresh())} />
              </>
            ) : (
              <button type="button" onClick={() => setOpen(m.id)} className="block w-full overflow-hidden rounded-[8px] border border-line bg-surface text-left hover:border-ink">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                <img src={m.fileUrl} alt={m.alt} className="aspect-[4/3] w-full bg-[#eee] object-cover" loading="lazy" />
                <span className={`block truncate px-2 py-1.5 text-[12.5px] ${m.alt ? "text-muted" : "text-warning"}`}>{m.alt || "Missing alt text"}</span>
              </button>
            )}
          </li>
        ))}
        {!items.length ? <li className="col-span-full py-10 text-center text-muted">No images.</li> : null}
      </ul>
      <MediaPicker open={upload} presigned={presigned} title="Upload an image" onClose={() => setUpload(false)} onSelect={() => (setUpload(false), router.refresh())} />
    </div>
  );
}
