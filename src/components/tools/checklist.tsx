"use client";

import { useEffect, useState } from "react";

export type ChecklistSection = { title: string; items: { id: string; text: string; detail?: string }[] };

/** Interactive checklist. Progress is a per-browser convenience only (localStorage). */
export function Checklist({ storageKey, sections }: { storageKey: string; sections: ChecklistSection[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const count = Object.values(done).filter(Boolean).length;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser storage after mount
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div>
      <div className="sticky top-[84px] z-10 mb-6 flex items-center gap-4 rounded-[10px] border border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ecebe6]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count} aria-label="Checklist progress">
          <div className="h-full bg-positive transition-[width]" style={{ width: `${(count / total) * 100}%` }} />
        </div>
        <span className="mono-label shrink-0">
          {count}/{total}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setDone({});
            try {
              window.localStorage.removeItem(storageKey);
            } catch {
              /* ignore */
            }
          }}
        >
          Reset
        </button>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="mb-10" aria-labelledby={`sec-${section.title}`}>
          <h2 id={`sec-${section.title}`} className="mb-3 text-[21px] font-semibold">
            {section.title}
          </h2>
          <ul className="divide-y divide-line rounded-[10px] border border-line bg-surface">
            {section.items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
                  <input type="checkbox" className="checkbox mt-1" checked={Boolean(done[item.id])} onChange={() => toggle(item.id)} />
                  <span>
                    <span className={done[item.id] ? "text-muted line-through" : ""}>{item.text}</span>
                    {item.detail ? <span className="mt-0.5 block text-[14px] leading-[1.55] text-muted">{item.detail}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
