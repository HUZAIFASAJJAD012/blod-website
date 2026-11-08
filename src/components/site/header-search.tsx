import { Search } from "lucide-react";

/** Plain GET form: works without JavaScript and is crawl-safe (search pages are noindex). */
export function HeaderSearch() {
  return (
    <form action="/search" method="get" role="search" className="relative">
      <label htmlFor="header-q" className="sr-only">
        Search guides
      </label>
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        id="header-q"
        name="q"
        type="search"
        placeholder="Search fixes"
        maxLength={120}
        className="h-9 w-52 rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm focus:border-accent focus:outline-none xl:w-60"
      />
    </form>
  );
}
