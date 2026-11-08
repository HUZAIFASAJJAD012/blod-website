"use client";

import { useMemo, useState } from "react";
import { STATUS_CODES } from "./http-status-data";

const CLASS_LABEL: Record<string, string> = {
  "2": "2xx · Success",
  "3": "3xx · Redirection",
  "4": "4xx · Client error",
  "5": "5xx · Server error",
};

export function HttpStatusExplainer() {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return STATUS_CODES;
    return STATUS_CODES.filter((s) => String(s.code).startsWith(t) || s.name.toLowerCase().includes(t));
  }, [q]);
  const exact = STATUS_CODES.find((s) => String(s.code) === q.trim());

  return (
    <div>
      <label htmlFor="status-q" className="field-label">
        Status code or name
      </label>
      <input
        id="status-q"
        className="input max-w-sm font-mono"
        inputMode="numeric"
        placeholder="e.g. 502"
        value={q}
        onChange={(e) => setQ(e.target.value.slice(0, 40))}
        aria-describedby="status-count"
      />
      <p id="status-count" className="field-hint" aria-live="polite">
        {q && !matches.length ? "No match in our reference. Codes outside this list are rarely seen on websites." : `${matches.length} codes shown`}
      </p>

      {exact ? <StatusCard s={exact} highlight /> : null}

      <div className="mt-8 space-y-4">
        {(exact ? matches.filter((m) => m.code !== exact.code) : matches).map((s) => (
          <StatusCard key={s.code} s={s} />
        ))}
      </div>
    </div>
  );
}

function StatusCard({ s, highlight = false }: { s: (typeof STATUS_CODES)[number]; highlight?: boolean }) {
  const cls = String(s.code)[0]!;
  const tone = cls === "5" ? "text-danger" : cls === "4" ? "text-warning" : cls === "3" ? "text-accent" : "text-positive";
  return (
    <article className={`rounded-[10px] border bg-surface p-5 ${highlight ? "mt-6 border-ink" : "border-line"}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`font-mono text-[22px] font-semibold ${tone}`}>{s.code}</span>
        <h3 className="text-[17px] font-semibold">{s.name}</h3>
        <span className="badge ml-auto">{CLASS_LABEL[cls]}</span>
      </div>
      <p className="mt-2 text-[15px]">{s.meaning}</p>
      <p className="mt-2 text-[14px] text-muted">
        Usually caused at: <strong className="font-medium text-ink">{s.usualCause}</strong>
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[14.5px]">
        {s.checks.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </article>
  );
}
