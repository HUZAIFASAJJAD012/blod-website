import type { Metadata } from "next";
import { absoluteUrl } from "./urls";

type BuildMetaInput = {
  title: string;
  description: string;
  path: string;
  canonical?: string | null;
  index?: boolean;
  follow?: boolean;
  ogType?: "website" | "article" | "profile";
  image?: { url: string; width?: number; height?: number; alt?: string } | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
  authors?: string[];
  section?: string;
  tags?: string[];
  siteName: string;
};

/** One place to build page metadata so canonical, robots and OG never diverge. */
export function buildMetadata(i: BuildMetaInput): Metadata {
  const canonical = i.canonical ?? absoluteUrl(i.path);
  const index = i.index ?? true;
  const follow = i.follow ?? true;
  const images = i.image ? [{ url: absoluteUrl(i.image.url), width: i.image.width, height: i.image.height, alt: i.image.alt }] : undefined;
  return {
    title: { absolute: i.title },
    description: i.description,
    alternates: { canonical },
    robots: {
      index,
      follow,
      googleBot: { index, follow, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      type: i.ogType ?? "website",
      url: canonical,
      title: i.ogTitle ?? i.title,
      description: i.ogDescription ?? i.description,
      siteName: i.siteName,
      locale: "en_US",
      images,
      ...(i.ogType === "article"
        ? {
            publishedTime: i.publishedTime?.toISOString(),
            modifiedTime: i.modifiedTime?.toISOString(),
            authors: i.authors,
            section: i.section,
            tags: i.tags,
          }
        : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: i.ogTitle ?? i.title,
      description: i.ogDescription ?? i.description,
      images: images?.map((im) => im.url),
    },
  };
}

/** Metadata for pages that must never be indexed (admin, preview, search, utility). */
export const NOINDEX: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
};

export function titleWithSuffix(title: string, suffix: string): string {
  if (!suffix || title.toLowerCase().includes(suffix.toLowerCase())) return title;
  return `${title} | ${suffix}`;
}
