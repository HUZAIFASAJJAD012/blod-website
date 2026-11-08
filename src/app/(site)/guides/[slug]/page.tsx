import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirectIfManaged } from "@/server/redirects";
import { getPublishedArticle, effectiveUpdated } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { getAdsRuntime } from "@/lib/ads/config";
import { ArticleView } from "@/components/article/article-view";
import { AdsenseScript } from "@/components/ads/adsense-script";
import { JsonLd } from "@/components/seo/json-ld";
import { articleLd } from "@/lib/seo/jsonld";
import { buildMetadata, titleWithSuffix } from "@/lib/seo/metadata";
import { docToPlainText, wordCount } from "@/lib/content/extract";
import { sanitizeDoc } from "@/lib/content/schema";

// ISR: cached HTML, regenerated hourly and immediately on publish/update via revalidatePath.
export const revalidate = 3600;

export function generateStaticParams() {
  return []; // rendered on first request, then cached; keeps builds independent of content volume
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticle(slug);
  if (!a) return {};
  const s = await getSettings();
  const image = a.ogImage ?? a.coverMedia;
  return buildMetadata({
    title: titleWithSuffix(a.metaTitle || a.title, s.seo.defaultTitleSuffix),
    description: a.metaDescription || a.excerpt,
    path: `/guides/${a.slug}`,
    canonical: a.canonicalOverride,
    index: a.robotsIndex,
    follow: a.robotsFollow,
    ogType: "article",
    ogTitle: a.ogTitle,
    ogDescription: a.ogDescription,
    image: image ? { url: image.fileUrl, width: image.width, height: image.height, alt: image.alt } : null,
    publishedTime: a.firstPublishedAt,
    modifiedTime: effectiveUpdated(a),
    authors: [a.author.name],
    section: a.primaryCategory.name,
    tags: a.tags.map((t) => t.tag.name),
    siteName: s.brand.name,
  });
}

export default async function ArticlePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  // Old slugs are normally redirected in proxy.ts; this covers its short cache window.
  if (!article) {
    await redirectIfManaged(`/guides/${slug}`);
    notFound();
  }

  const [s, ads] = await Promise.all([getSettings(), getAdsRuntime()]);
  const words = wordCount(docToPlainText(sanitizeDoc(article.bodyJson)));
  const authorPath = article.author.profile?.isPublic ? `/authors/${article.author.profile.slug}` : null;
  const images = [article.ogImage, article.coverMedia].filter(Boolean).map((m) => m!.fileUrl);
  const adsEligible = ads.enabled && article.robotsIndex && words >= ads.minWords;

  return (
    <>
      <ArticleView article={article} ads={adsEligible ? ads : { enabled: false, reason: "Not eligible" }} />
      <JsonLd
        data={articleLd({
          schemaType: article.schemaType,
          headline: article.title,
          description: article.metaDescription || article.excerpt,
          path: `/guides/${article.slug}`,
          images: [...new Set(images)],
          datePublished: article.firstPublishedAt!,
          dateModified: effectiveUpdated(article)!,
          author: { name: article.author.name, path: authorPath },
          section: article.primaryCategory.name,
          keywords: article.tags.map((t) => t.tag.name),
          publisherName: s.brand.name,
          wordCount: words,
        })}
      />
      {adsEligible && ads.enabled ? <AdsenseScript publisherId={ads.publisherId} /> : null}
    </>
  );
}
