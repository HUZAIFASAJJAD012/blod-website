import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/urls";

/**
 * robots.txt controls crawling, not indexing. Private areas are ALSO protected by
 * authentication and noindex headers/meta — never by robots.txt alone.
 * Non-production deployments disallow everything to keep staging out of search.
 */
export default function robots(): MetadataRoute.Robots {
  const isProductionSite = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";
  if (!isProductionSite || process.env.DISALLOW_ALL_CRAWLERS === "1") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/preview", "/search", "/newsletter/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
