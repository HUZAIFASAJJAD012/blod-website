"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { searchRelatedAction, suggestRelatedAction } from "@/server/articles/actions";

type Opt = { id: string; name: string };

/** Searchable multi-select with duplicate guard and optional creation of new tags. */
export function TagPicker({
  all,
  selectedIds,
  newTags,
  onChange,
  disabled,
}: {
  all: Opt[];
  selectedIds: string[];
  newTags: string[];
  onChange: (ids: string[], newTags: string[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const id = useId();
  const norm = (s: string) => s.trim().toLowerCase();
  const selected = all.filter((t) => selectedIds.includes(t.id));
  const matches = q ? all.filter((t) => !selectedIds.includes(t.id) && norm(t.name).includes(norm(q))).slice(0, 8) : [];
  const exists = all.some((t) => norm(t.name) === norm(q)) || newTags.some((t) => norm(t) === norm(q));
  const total = selectedIds.length + newTags.length;

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Selected tags">
        {selected.map((t) => (
          <li key={t.id} className="chip gap-1 pr-1">
            {t.name}
            <button type="button" disabled={disabled} aria-label={`Remove tag ${t.name}`} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" onClick={() => onChange(selectedIds.filter((x) => x !== t.id), newTags)}>
              <X size={12} />
            </button>
          </li>
        ))}
        {newTags.map((t) => (
          <li key={t} className="chip gap-1 border-dashed pr-1">
            {t} <span className="mono-label text-muted">new</span>
            <button type="button" disabled={disabled} aria-label={`Remove new tag ${t}`} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" onClick={() => onChange(selectedIds, newTags.filter((x) => x !== t))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative">
        <label htmlFor={id} className="sr-only">
          Add tag
        </label>
        <input
          id={id}
          className="input"
          disabled={disabled || total >= 12}
          placeholder={total >= 12 ? "Maximum 12 tags" : "Search or create a tag…"}
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 40))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const m = matches[0];
              if (m && norm(m.name) === norm(q)) onChange([...selectedIds, m.id], newTags);
              else if (q.trim().length >= 2 && !exists && newTags.length < 5) onChange(selectedIds, [...newTags, q.trim()]);
              setQ("");
            }
          }}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
        />
        {q ? (
          <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
            {matches.map((t) => (
              <li key={t.id} role="option" aria-selected="false">
                <button type="button" className="block w-full px-3 py-2 text-left text-[14px] hover:bg-black/5" onClick={() => (onChange([...selectedIds, t.id], newTags), setQ(""))}>
                  {t.name}
                </button>
              </li>
            ))}
            {!exists && q.trim().length >= 2 ? (
              <li role="option" aria-selected="false">
                <button type="button" className="block w-full px-3 py-2 text-left text-[14px] text-accent hover:bg-black/5" onClick={() => (newTags.length < 5 && onChange(selectedIds, [...newTags, q.trim()]), setQ(""))}>
                  Create tag “{q.trim()}”
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <p className="field-hint">Use a few precise tags. Tag pages with fewer than 3 guides are noindex to avoid thin pages.</p>
    </div>
  );
}

export type RelatedItem = { id: string; title: string; slug: string };

/** Curated related guides: published only, max 5, suggestions require explicit approval. */
export function RelatedPicker({ articleId, value, onChange, disabled }: { articleId: string | null; value: RelatedItem[]; onChange: (v: RelatedItem[]) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RelatedItem[]>([]);
  const [suggestions, setSuggestions] = useState<(RelatedItem & { reason: string })[] | null>(null);
  const id = useId();

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(async () => setResults(await searchRelatedAction(q, articleId ?? "")), 250);
    return () => clearTimeout(t);
  }, [q, articleId]);

  const add = (r: RelatedItem) => value.length < 5 && !value.some((v) => v.id === r.id) && onChange([...value, r]);
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };

  return (
    <div>
      <ol className="mb-2 space-y-1.5">
        {value.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 rounded-md border border-line bg-[#FAFAF8] px-3 py-1.5 text-[14px]">
            <span className="mono-label text-muted">{i + 1}</span>
            <span className="flex-1 truncate">{r.title}</span>
            <button type="button" disabled={disabled || i === 0} className="px-1 text-muted disabled:opacity-30" aria-label="Move up" onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" disabled={disabled || i === value.length - 1} className="px-1 text-muted disabled:opacity-30" aria-label="Move down" onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" disabled={disabled} aria-label={`Remove ${r.title}`} onClick={() => onChange(value.filter((v) => v.id !== r.id))}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>
      {value.length < 5 ? (
        <div className="relative">
          <label htmlFor={id} className="sr-only">
            Search published guides
          </label>
          <input id={id} className="input" disabled={disabled} placeholder="Search published guides…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && results.length ? (
            <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-lg">
              {results
                .filter((r) => !value.some((v) => v.id === r.id))
                .map((r) => (
                  <li key={r.id}>
                    <button type="button" className="block w-full px-3 py-2 text-left text-[14px] hover:bg-black/5" onClick={() => (add(r), setQ(""))}>
                      {r.title}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="field-hint">Maximum of 5 related guides.</p>
      )}
      {articleId ? (
        <div className="mt-2">
          <button type="button" className="text-[13px] text-accent" disabled={disabled} onClick={async () => setSuggestions(await suggestRelatedAction(articleId))}>
            Suggest related guides
          </button>
          {suggestions ? (
            <ul className="mt-2 space-y-1">
              {suggestions.filter((s) => !value.some((v) => v.id === s.id)).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                  <span className="truncate">
                    {s.title} <span className="text-muted">· {s.reason}</span>
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => add(s)}>
                    Add
                  </button>
                </li>
              ))}
              {!suggestions.length ? <li className="text-[13px] text-muted">No suggestions — publish more guides in this topic first.</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
