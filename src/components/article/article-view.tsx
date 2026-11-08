import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, FlaskConical, LifeBuoy, ShieldCheck } from "lucide-react";
import type { PublicArticle } from "@/server/articles/public";
import { effectiveUpdated } from "@/server/articles/public";
import { RichContent } from "./rich-content";
import { TableOfContents } from "./toc";
import { GridArticleCard } from "./article-cards";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { AdSlot } from "@/components/ads/ad-slot";
import { extractToc, docToPlainText, wordCount } from "@/lib/content/extract";
import { sanitizeDoc, type JSONContent } from "@/lib/content/schema";
import type { AdsRuntime } from "@/lib/ads/config";
import { ARTICLE_TYPE_LABEL, formatDate, isoDate } from "@/lib/utils/format";
import { getSiteOrigin } from "@/lib/seo/urls";

type Env = { label: string; value: string };

/**
 * Picks safe in-article ad positions: never directly before/after a code block,
 * step list or callout (no ads next to copy buttons or primary actions), never
 * in the first two blocks, and only for long-enough content.
 */
export function chooseAdPositions(doc: JSONContent, maxSlots: number, words: number, minWords: number): number[] {
  if (maxSlots <= 0 || words < minWords) return [];
  const blocks = doc.content ?? [];
  const unsafe = new Set(["codeBlock", "steps", "callout", "table", "embed", "image"]);
  const ok = (i: number) => blocks[i]?.type === "paragraph" && !unsafe.has(blocks[i + 1]?.type ?? "") && blocks[i + 1] !== undefined;
  const picks: number[] = [];
  const firstH2 = blocks.findIndex((b, i) => i > 1 && b.type === "heading");
  const intro = firstH2 > 0 ? firstH2 - 1 : 3;
  for (let i = Math.max(2, intro); i < blocks.length; i++) if (ok(i)) { picks.push(i); break; }
  if (maxSlots > 1 && words >= minWords * 2 && blocks.length > 16) {
    const mid = Math.floor(blocks.length * 0.6);
    for (let i = mid; i < blocks.length - 3; i++) if (ok(i) && picks.every((p) => Math.abs(p - i) > 8)) { picks.push(i); break; }
  }
  return picks.slice(0, maxSlots);
}

export function ArticleView({ article, ads, preview = false }: { article: PublicArticle; ads: AdsRuntime; preview?: boolean }) {
  const doc = sanitizeDoc(article.bodyJson);
  const toc = extractToc(doc);
  const words = wordCount(docToPlainText(doc));
  const updated = effectiveUpdated(article);
  const showUpdated = updated && article.firstPublishedAt && updated.getTime() > article.firstPublishedAt.getTime();
  const env = (Array.isArray(article.testedEnvironment) ? article.testedEnvironment : []) as Env[];
  const authorProfile = article.author.profile?.isPublic ? article.author.profile : null;
  const reviewerProfile = article.reviewer?.profile?.isPublic ? article.reviewer.profile : null;
  const origin = getSiteOrigin();

  const slots: Record<number, React.ReactNode> = {};
  if (ads.enabled && ads.mode === "manual" && !preview) {
    const inArticle = ads.placements.filter((p) => p.key !== "article_before_related");
    const positions = chooseAdPositions(doc, Math.min(ads.maxInArticleSlots, inArticle.length), words, ads.minWords);
    positions.forEach((pos, i) => {
      const p = inArticle[i]!;
      if (p.minWords && words < p.minWords) return;
      slots[pos] = <AdSlot key={p.key} publisherId={ads.publisherId} adUnitId={p.adUnitId} label={ads.label} minHeightDesktop={p.minHeightDesktop} minHeightMobile={p.minHeightMobile} />;
    });
  }
  const beforeRelated = ads.enabled && ads.mode === "manual" && !preview && words >= ads.minWords ? ads.placements.find((p) => p.key === "article_before_related") : undefined;

  return (
    <article className="container-page pt-8" data-article-id={article.id}>
      <Breadcrumbs
        items={[
          { name: article.primaryCategory.name, path: `/category/${article.primaryCategory.slug}` },
          { name: article.title, path: `/guides/${article.slug}` },
        ]}
      />

      <header className="mt-8 max-w-[860px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/category/${article.primaryCategory.slug}`} className="eyebrow text-accent no-underline">
            {article.primaryCategory.name}
          </Link>
          <span aria-hidden="true" className="text-line-strong">
            /
          </span>
          <span className="eyebrow">{ARTICLE_TYPE_LABEL[article.type]}</span>
        </div>
        <h1 className="h1-display mt-3">{article.title}</h1>
        <p className="mt-4 max-w-[68ch] text-[18px] leading-[1.6] text-muted">{article.excerpt}</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-3 text-[14px]">
          <span>
            By{" "}
            {authorProfile ? (
              <Link href={`/authors/${authorProfile.slug}`} rel="author" className="font-medium no-underline hover:text-accent">
                {article.author.name}
              </Link>
            ) : (
              <span className="font-medium">{article.author.name}</span>
            )}
          </span>
          {article.reviewer && article.reviewedAt ? (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <ShieldCheck size={15} aria-hidden="true" className="text-positive" />
              Reviewed by{" "}
              {reviewerProfile ? (
                <Link href={`/authors/${reviewerProfile.slug}`} className="text-ink no-underline hover:text-accent">
                  {article.reviewer.name}
                </Link>
              ) : (
                <span className="text-ink">{article.reviewer.name}</span>
              )}
            </span>
          ) : null}
          <span className="mono-label text-muted">
            Published <time dateTime={isoDate(article.firstPublishedAt)}>{formatDate(article.firstPublishedAt)}</time>
          </span>
          {showUpdated ? (
            <span className="mono-label text-muted">
              Updated <time dateTime={isoDate(updated)}>{formatDate(updated)}</time>
            </span>
          ) : null}
          {article.lastVerifiedAt ? (
            <span className="inline-flex items-center gap-1.5 text-positive">
              <BadgeCheck size={15} aria-hidden="true" />
              <span className="mono-label">Last tested {formatDate(article.lastVerifiedAt)}</span>
            </span>
          ) : null}
          {article.readingMinutes ? <span className="mono-label text-muted">{article.readingMinutes} min read</span> : null}
        </div>
      </header>

      {article.coverMedia ? (
        <figure className="mt-8 max-w-[1034px]">
          <Image
            src={article.coverMedia.fileUrl}
            alt={article.coverMedia.alt}
            width={article.coverMedia.width}
            height={article.coverMedia.height}
            priority
            sizes="(min-width: 1240px) 1034px, 100vw"
            className="h-auto w-full rounded-[10px] border border-line"
          />
          {article.coverMedia.caption || article.coverMedia.copyrightHolder ? (
            <figcaption className="mt-2 text-[14px] text-muted">
              {article.coverMedia.caption}
              {article.coverMedia.copyrightHolder ? ` · Credit: ${article.coverMedia.copyrightHolder}` : ""}
              {article.coverMedia.license ? ` (${article.coverMedia.license})` : ""}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-[54px] lg:grid-cols-[minmax(0,730px)_250px]">
        <div className="min-w-0">
          <div className="mb-8 space-y-4">
            <TableOfContents items={toc} variant="mobile" />
            {article.affiliateDisclosureFlag ? (
              <aside className="rounded-[8px] border border-line bg-surface px-4 py-3 text-[14.5px] text-muted" aria-label="Affiliate disclosure">
                <strong className="font-medium text-ink">Disclosure: </strong>
                {article.affiliateDisclosureText ||
                  "Some links in this guide are affiliate links. If you buy through them we may earn a commission, at no extra cost to you. It never affects what we recommend."}{" "}
                <Link href="/affiliate-disclosure" className="link-underline">
                  How we handle affiliates
                </Link>
              </aside>
            ) : null}
            {env.length ? (
              <section aria-labelledby="tested-env" className="rounded-[10px] border border-line bg-surface">
                <h2 id="tested-env" className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[14px] font-semibold">
                  <FlaskConical size={16} aria-hidden="true" className="text-positive" /> Tested environment
                </h2>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 px-4 py-3 text-[14px] sm:grid-cols-2">
                  {env.map((e) => (
                    <div key={`${e.label}-${e.value}`} className="flex justify-between gap-3 border-b border-dashed border-line pb-1.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
                      <dt className="text-muted">{e.label}</dt>
                      <dd className="font-mono text-[13px]">{e.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>

          <RichContent doc={doc} siteOrigin={origin} slots={slots} />

          {article.references.length ? (
            <section aria-labelledby="refs" className="mt-14 border-t border-line pt-6">
              <h2 id="refs" className="text-[20px] font-semibold">
                Sources &amp; references
              </h2>
              <ol className="mt-4 space-y-2.5 text-[14.5px]">
                {article.references.map((r, i) => (
                  <li key={r.id} id={`ref-${i + 1}`} className="grid grid-cols-[28px_1fr] gap-1">
                    <span className="mono-label pt-0.5 text-muted">[{i + 1}]</span>
                    <span>
                      <a href={r.url} rel="noopener noreferrer" className="link-underline">
                        {r.title}
                      </a>
                      {r.publisher ? <span className="text-muted"> — {r.publisher}</span> : null}
                      {r.isPrimary ? <span className="badge ml-2">primary source</span> : null}
                      <span className="block text-[13px] text-muted">Accessed {formatDate(r.accessedAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {article.correctionsNote ? (
            <aside className="mt-10 rounded-[8px] border-l-[3px] border-warning bg-warning-soft px-4 py-3 text-[14.5px]" aria-label="Correction">
              <strong className="font-semibold">Correction: </strong>
              {article.correctionsNote}
            </aside>
          ) : null}
          {showUpdated && article.revisionReason ? (
            <p className="mt-6 text-[14px] text-muted">
              <strong className="font-medium text-ink">What changed on {formatDate(updated)}:</strong> {article.revisionReason}
            </p>
          ) : null}

          <section aria-labelledby="author-box" className="mt-12 grid gap-4 rounded-[10px] border border-line bg-surface p-6 sm:grid-cols-[64px_1fr]">
            {article.author.image ? (
              <Image src={article.author.image.fileUrl} alt={article.author.image.alt || article.author.name} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full bg-[#ecebe6] text-[22px] font-semibold">
                {article.author.name.slice(0, 1)}
              </span>
            )}
            <div>
              <h2 id="author-box" className="text-[17px] font-semibold">
                {authorProfile ? (
                  <Link href={`/authors/${authorProfile.slug}`} className="no-underline hover:text-accent">
                    {article.author.name}
                  </Link>
                ) : (
                  article.author.name
                )}
                {authorProfile?.roleTitle ? <span className="ml-2 text-[14px] font-normal text-muted">{authorProfile.roleTitle}</span> : null}
              </h2>
              {authorProfile?.bio ? <p className="mt-1.5 text-[15px] text-muted">{authorProfile.bio}</p> : null}
              <p className="mt-3 text-[13.5px] text-muted">
                Found an error? Read our{" "}
                <Link href="/corrections-policy" className="link-underline">
                  corrections policy
                </Link>{" "}
                or{" "}
                <Link href={`/contact?topic=correction&page=${encodeURIComponent(`/guides/${article.slug}`)}`} className="link-underline">
                  report it
                </Link>
                .
              </p>
            </div>
          </section>

          <section aria-labelledby="help-cta" className="mt-8 flex flex-col gap-4 rounded-[10px] bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <LifeBuoy size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-[#8fb3ff]" />
              <div>
                <h2 id="help-cta" className="text-[17px] font-semibold">
                  Need help fixing this?
                </h2>
                <p className="mt-1 text-[14.5px] text-[#c9cfd8]">If the steps above didn&apos;t solve it, describe your setup and we&apos;ll tell you honestly whether we can help.</p>
              </div>
            </div>
            <Link href={`/contact?topic=hire-help&page=${encodeURIComponent(`/guides/${article.slug}`)}`} className="btn shrink-0 bg-white text-ink hover:bg-[#e9ecf1]">
              Get in touch
            </Link>
          </section>

          {beforeRelated && ads.enabled ? (
            <AdSlot publisherId={ads.publisherId} adUnitId={beforeRelated.adUnitId} label={ads.label} minHeightDesktop={beforeRelated.minHeightDesktop} minHeightMobile={beforeRelated.minHeightMobile} />
          ) : null}

          {article.tags.length ? (
            <ul className="mt-10 flex flex-wrap gap-2" aria-label="Topics">
              {article.tags.map(({ tag }) => (
                <li key={tag.id}>
                  <Link href={`/tag/${tag.slug}`} className="chip">
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside className="hidden lg:block" aria-label="Article navigation">
          <TableOfContents items={toc} variant="desktop" />
        </aside>
      </div>

      {article.related.length ? (
        <section aria-labelledby="related" className="mt-16 border-t border-line pt-10">
          <h2 id="related" className="h2-section">
            Related troubleshooting
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {article.related.map(({ related }) => (
              <GridArticleCard key={related.id} a={related} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
