import Image from "next/image";
import Link from "next/link";
import type { ArticleCard } from "@/server/articles/public";
import { effectiveUpdated } from "@/server/articles/public";
import { ARTICLE_TYPE_LABEL, formatDate, isoDate } from "@/lib/utils/format";

function DateLine({ a }: { a: ArticleCard }) {
  const updated = effectiveUpdated(a);
  const isUpdate = updated && a.firstPublishedAt && updated.getTime() !== a.firstPublishedAt.getTime();
  return (
    <span className="mono-label text-muted">
      {isUpdate ? "Updated " : ""}
      <time dateTime={isoDate(updated)}>{formatDate(updated)}</time>
      {a.readingMinutes ? ` · ${a.readingMinutes} min read` : ""}
    </span>
  );
}

function Meta({ a }: { a: ArticleCard }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link href={`/category/${a.primaryCategory.slug}`} className="eyebrow text-accent no-underline hover:text-accent-hover">
        {a.primaryCategory.name}
      </Link>
      <span className="text-line-strong" aria-hidden="true">
        /
      </span>
      <span className="eyebrow">{ARTICLE_TYPE_LABEL[a.type]}</span>
    </div>
  );
}

/** Large lead story: optional real cover image, otherwise a typographic block. */
export function FeaturedArticleCard({ a }: { a: ArticleCard }) {
  return (
    <article className="group flex h-full flex-col rounded-[12px] border border-line bg-surface">
      {a.coverMedia ? (
        <Link href={`/guides/${a.slug}`} tabIndex={-1} aria-hidden="true" className="block overflow-hidden rounded-t-[12px] border-b border-line">
          <Image
            src={a.coverMedia.fileUrl}
            alt=""
            width={a.coverMedia.width}
            height={a.coverMedia.height}
            sizes="(min-width: 1024px) 640px, 100vw"
            className="aspect-[16/9] w-full object-cover"
            priority
          />
        </Link>
      ) : null}
      <div className="flex flex-1 flex-col p-6 md:p-8">
        <Meta a={a} />
        <h3 className="mt-3 text-[26px] leading-[1.2] font-semibold tracking-[-0.5px] md:text-[30px]">
          <Link href={`/guides/${a.slug}`} className="title-link">
            {a.title}
          </Link>
        </h3>
        <p className="mt-3 max-w-[60ch] text-[16px] text-muted">{a.excerpt}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-6 text-sm">
          <span className="font-medium">{a.author.name}</span>
          <DateLine a={a} />
        </div>
      </div>
    </article>
  );
}

/** Compact supporting story: no image, rule on top, used in the 2×2 grid. */
export function CompactArticleCard({ a }: { a: ArticleCard }) {
  return (
    <article className="flex flex-col border-t-2 border-ink pt-4">
      <Meta a={a} />
      <h3 className="mt-2 text-[18px] leading-[1.35] font-semibold tracking-[-0.2px]">
        <Link href={`/guides/${a.slug}`} className="title-link">
          {a.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 text-[15px] leading-[1.6] text-muted">{a.excerpt}</p>
      <div className="mt-3">
        <DateLine a={a} />
      </div>
    </article>
  );
}

/** Grid card for "Most useful" and listing pages. */
export function GridArticleCard({ a, index }: { a: ArticleCard; index?: number }) {
  return (
    <article className="flex h-full flex-col rounded-[10px] border border-line bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <Meta a={a} />
        {index !== undefined ? <span className="mono-label text-line-strong">{String(index + 1).padStart(2, "0")}</span> : null}
      </div>
      <h3 className="mt-3 text-[19px] leading-[1.32] font-semibold tracking-[-0.2px]">
        <Link href={`/guides/${a.slug}`} className="title-link">
          {a.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-[15px] leading-[1.6] text-muted">{a.excerpt}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="truncate font-medium">{a.author.name}</span>
        <DateLine a={a} />
      </div>
    </article>
  );
}

/** Dense list row for feeds (category, author, tag, all guides). */
export function ListArticleRow({ a }: { a: ArticleCard }) {
  return (
    <article className="grid gap-2 border-b border-line py-6 md:grid-cols-[180px_1fr] md:gap-8">
      <div className="flex flex-col gap-1">
        <Link href={`/category/${a.primaryCategory.slug}`} className="eyebrow text-accent no-underline">
          {a.primaryCategory.name}
        </Link>
        <DateLine a={a} />
      </div>
      <div>
        <h3 className="text-[19px] leading-[1.35] font-semibold tracking-[-0.2px] md:text-[21px]">
          <Link href={`/guides/${a.slug}`} className="title-link">
            {a.title}
          </Link>
        </h3>
        <p className="mt-1.5 max-w-[70ch] text-[15px] leading-[1.6] text-muted">{a.excerpt}</p>
        <p className="mt-2 text-sm">
          <span className="badge">{ARTICLE_TYPE_LABEL[a.type]}</span> <span className="ml-1 text-muted">by {a.author.name}</span>
        </p>
      </div>
    </article>
  );
}
