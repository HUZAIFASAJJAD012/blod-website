import Link from "next/link";

export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (p: number) => string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn-secondary btn-sm" rel="prev">
          ← Newer
        </Link>
      ) : null}
      <ol className="flex items-center gap-1">
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-1">
            {i > 0 && p - pages[i - 1]! > 1 ? <span className="px-1 text-muted">…</span> : null}
            {p === page ? (
              <span aria-current="page" className="grid h-9 min-w-9 place-items-center rounded-md bg-ink px-2 text-sm text-white">
                {p}
              </span>
            ) : (
              <Link href={href(p)} className="grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm no-underline hover:bg-black/5">
                {p}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {page < pageCount ? (
        <Link href={href(page + 1)} className="btn btn-secondary btn-sm" rel="next">
          Older →
        </Link>
      ) : null}
    </nav>
  );
}

/** Parse ?page= strictly; anything invalid returns null so the page can 404. */
export function parsePage(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  if (Array.isArray(raw) || !/^[1-9]\d{0,3}$/.test(raw)) return null;
  return Number(raw);
}
