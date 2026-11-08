import Link from "next/link";

/**
 * Hero illustration: a composed "diagnostic console" built from real, documented
 * failure signatures and the order we'd investigate them. Not a fake app screenshot.
 */
const ROWS = [
  {
    signal: "HTTP/2 500",
    name: "Internal Server Error",
    path: ["debug.log", "plugins off", ".htaccess", "memory_limit"],
    href: "/search?q=500+internal+server+error",
    tone: "err",
  },
  {
    signal: "ERR_TOO_MANY_REDIRECTS",
    name: "Redirect loop behind a proxy",
    path: ["SSL/TLS mode", "origin redirect", "X-Forwarded-Proto"],
    href: "/search?q=redirect+loop",
    tone: "err",
  },
  {
    signal: "502 Bad Gateway",
    name: "Upstream not answering",
    path: ["upstream logs", "socket/port", "timeouts"],
    href: "/search?q=502+bad+gateway",
    tone: "warn",
  },
  {
    signal: "535 5.7.8",
    name: "SMTP authentication failed",
    path: ["credentials", "port 587", "SPF / DKIM"],
    href: "/search?q=smtp",
    tone: "warn",
  },
] as const;

export function DiagnosticPanel() {
  return (
    <figure className="overflow-hidden rounded-[12px] border border-[#1f2a36] bg-code text-code-ink shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_-24px_rgba(17,24,32,0.55)]">
      <figcaption className="flex items-center justify-between border-b border-[#222c37] px-4 py-2.5">
        <span className="mono-label text-code-muted">triage.log</span>
        <span className="mono-label text-code-muted">symptom → likely cause → check order</span>
      </figcaption>
      <div className="terminal px-4 pt-3 pb-1">
        <p>
          <span className="prompt">$ </span>curl -sI https://example.com | head -1
        </p>
        <p className="err">HTTP/2 500</p>
      </div>
      <ul className="divide-y divide-[#1f2934]">
        {ROWS.map((r) => (
          <li key={r.signal}>
            <Link href={r.href} className="group block px-4 py-3 no-underline transition-colors hover:bg-[#16202a] focus-visible:bg-[#16202a]">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`font-mono text-[13px] ${r.tone === "err" ? "text-[#f08a80]" : "text-[#f1b66e]"}`}>{r.signal}</span>
                <span className="truncate text-[13px] text-code-muted group-hover:text-code-ink">{r.name}</span>
              </div>
              <ol className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[12px] text-[#b9c4d0]">
                {r.path.map((p, i) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span className="rounded-[4px] bg-[#1c2733] px-1.5 py-0.5">
                      {i + 1}. {p}
                    </span>
                    {i < r.path.length - 1 ? (
                      <span aria-hidden="true" className="text-code-muted">
                        →
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Link>
          </li>
        ))}
      </ul>
      <p className="terminal border-t border-[#222c37] px-4 py-2.5 text-[12.5px]">
        <span className="ok">✓</span> <span className="dim">Fix the cause, then verify — not just the symptom.</span>
      </p>
    </figure>
  );
}
