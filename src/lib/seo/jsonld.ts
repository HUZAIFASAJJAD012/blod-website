import { absoluteUrl, getSiteOrigin } from "./urls";

/**
 * JSON-LD builders. Every property must correspond to something visible on the
 * page. No FAQPage, Review, Product or HowTo markup is emitted.
 */

export type Crumb = { name: string; path: string };

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function websiteLd(name: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${getSiteOrigin()}/#website`,
    url: `${getSiteOrigin()}/`,
    name,
    description,
    inLanguage: "en",
    publisher: { "@id": `${getSiteOrigin()}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${getSiteOrigin()}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Only emitted when the owner has configured a real organisation/legal name. */
export function organizationLd(o: { name: string; legalName?: string; email?: string; sameAs: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${getSiteOrigin()}/#organization`,
    name: o.name,
    ...(o.legalName ? { legalName: o.legalName } : {}),
    url: `${getSiteOrigin()}/`,
    logo: absoluteUrl("/brand-assets/logo-512.png"),
    ...(o.email ? { email: o.email } : {}),
    ...(o.sameAs.length ? { sameAs: o.sameAs } : {}),
  };
}

export type ArticleLdInput = {
  schemaType: "BLOG_POSTING" | "ARTICLE" | "NEWS_ARTICLE";
  headline: string;
  description: string;
  path: string;
  images: string[];
  datePublished: Date;
  dateModified: Date;
  author: { name: string; path?: string | null };
  reviewer?: { name: string; path?: string | null } | null;
  section: string;
  keywords?: string[];
  publisherName: string;
  wordCount?: number;
};

const LD_TYPE = { BLOG_POSTING: "BlogPosting", ARTICLE: "Article", NEWS_ARTICLE: "NewsArticle" } as const;

export function articleLd(a: ArticleLdInput) {
  const url = absoluteUrl(a.path);
  return {
    "@context": "https://schema.org",
    "@type": LD_TYPE[a.schemaType],
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: a.headline.slice(0, 110),
    description: a.description,
    ...(a.images.length ? { image: a.images.map(absoluteUrl) } : {}),
    datePublished: a.datePublished.toISOString(),
    dateModified: a.dateModified.toISOString(),
    author: {
      "@type": "Person",
      name: a.author.name,
      ...(a.author.path ? { url: absoluteUrl(a.author.path) } : {}),
    },
    publisher: { "@type": "Organization", "@id": `${getSiteOrigin()}/#organization`, name: a.publisherName },
    articleSection: a.section,
    ...(a.keywords?.length ? { keywords: a.keywords.join(", ") } : {}),
    ...(a.wordCount ? { wordCount: a.wordCount } : {}),
    inLanguage: "en",
  };
}

export function personLd(p: { name: string; path: string; jobTitle?: string; sameAs: string[]; description?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: p.name,
      url: absoluteUrl(p.path),
      ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
      ...(p.description ? { description: p.description } : {}),
      ...(p.sameAs.length ? { sameAs: p.sameAs } : {}),
    },
  };
}

/** Serialize safely for a <script type="application/ld+json"> tag (blocks </script> breakout). */
export function serializeLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
