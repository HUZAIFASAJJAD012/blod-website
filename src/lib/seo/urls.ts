/** Canonical URL helpers. All public paths are built here so routes stay consistent. */

export function getSiteOrigin(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export const paths = {
  home: () => "/",
  guides: (page?: number) => (page && page > 1 ? `/guides?page=${page}` : "/guides"),
  article: (slug: string) => `/guides/${slug}`,
  category: (slug: string, page?: number) => (page && page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`),
  tag: (slug: string) => `/tag/${slug}`,
  author: (slug: string) => `/authors/${slug}`,
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : "/search"),
  tool: (slug: string) => `/tools/${slug}`,
};

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${getSiteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Canonical override must be an absolute https URL. Same-origin overrides must
 * point at a published path; cross-domain overrides are allowed only for
 * syndicated content and require ADMIN (enforced in the action).
 */
export function validateCanonicalOverride(value: string): { ok: true; url: string; sameOrigin: boolean } | { ok: false; error: string } {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && !u.hostname.endsWith("localhost")) return { ok: false, error: "Canonical URL must use https." };
    if (u.hash) return { ok: false, error: "Canonical URL must not contain a #fragment." };
    const origin = new URL(getSiteOrigin());
    return { ok: true, url: u.toString(), sameOrigin: u.host === origin.host };
  } catch {
    return { ok: false, error: "Canonical URL must be an absolute URL." };
  }
}
