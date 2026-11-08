import type { Metadata } from "next";
import Link from "next/link";
import { db, type Prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AdminPage, EmptyRow, StatusBadge, td, th } from "@/components/admin/ui";
import { ArticleBulkBar } from "@/components/admin/article-bulk-bar";
import { ARTICLE_TYPE_LABEL } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Articles" };

const STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
const SORTS = { updated: { updatedAt: "desc" }, published: { firstPublishedAt: { sort: "desc", nulls: "last" } }, title: { title: "asc" } } as const;
const PER_PAGE = 25;

export default async function ArticlesPage({ searchParams }: PageProps<"/admin/articles">) {
  const user = await requireUser();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q").slice(0, 100);
  const status = (STATUSES as readonly string[]).includes(str("status")) ? (str("status") as (typeof STATUSES)[number]) : undefined;
  const categoryId = str("category") || undefined;
  const authorId = can(user, "article.editAny") ? str("author") || undefined : user.id;
  const sort = (str("sort") in SORTS ? str("sort") : "updated") as keyof typeof SORTS;
  const page = Math.max(1, Math.min(1000, Number(str("page")) || 1));
  const from = str("from") ? new Date(str("from")) : undefined;
  const to = str("to") ? new Date(str("to")) : undefined;

  const where: Prisma.ArticleWhereInput = {
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }] } : {}),
    ...(status ? { status } : {}),
    ...(categoryId ? { primaryCategoryId: categoryId } : {}),
    ...(authorId ? { authorId } : {}),
    ...(from && !Number.isNaN(from.getTime()) ? { updatedAt: { gte: from, ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) } } : {}),
  };

  const [rows, total, categories, authors] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: SORTS[sort] as Prisma.ArticleOrderByWithRelationInput,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { id: true, title: true, slug: true, status: true, type: true, robotsIndex: true, updatedAt: true, firstPublishedAt: true, scheduledAt: true, author: { select: { name: true } }, primaryCategory: { select: { name: true } } },
    }),
    db.article.count({ where }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    can(user, "article.editAny") ? db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, status, category: categoryId, author: can(user, "article.editAny") ? authorId : undefined, sort, from: str("from"), to: str("to"), page, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && v === 1) && !(k === "sort" && v === "updated")) p.set(k, String(v));
    const s = p.toString();
    return `/admin/articles${s ? `?${s}` : ""}`;
  };

  return (
    <AdminPage
      title="Articles"
      description={`${total} ${total === 1 ? "article" : "articles"}${status ? ` · ${status.toLowerCase().replace("_", " ")}` : ""}`}
      actions={
        <Link href="/admin/articles/new" className="btn btn-primary btn-sm">
          New article
        </Link>
      }
    >
      <form method="get" className="mb-4 grid gap-2 rounded-[10px] border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[1fr_150px_170px_160px_140px_140px_auto]">
        <label className="sr-only" htmlFor="f-q">Search</label>
        <input id="f-q" name="q" defaultValue={q} placeholder="Search title or slug" className="input" />
        <label className="sr-only" htmlFor="f-status">Status</label>
        <select id="f-status" name="status" defaultValue={status ?? ""} className="select">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase().replace("_", " ")}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-cat">Category</label>
        <select id="f-cat" name="category" defaultValue={categoryId ?? ""} className="select">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {can(user, "article.editAny") ? (
          <>
            <label className="sr-only" htmlFor="f-author">Author</label>
            <select id="f-author" name="author" defaultValue={authorId ?? ""} className="select">
              <option value="">All authors</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span />
        )}
        <label className="sr-only" htmlFor="f-from">Updated from</label>
        <input id="f-from" type="date" name="from" defaultValue={str("from")} className="input" title="Updated from" />
        <label className="sr-only" htmlFor="f-sort">Sort</label>
        <select id="f-sort" name="sort" defaultValue={sort} className="select">
          <option value="updated">Last updated</option>
          <option value="published">Published date</option>
          <option value="title">Title A–Z</option>
        </select>
        <button type="submit" className="btn btn-secondary">
          Apply
        </button>
      </form>

      <ArticleBulkBar enabled={can(user, "article.bulk")}>
        <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-line bg-[#FAFAF8]">
              <tr>
                {can(user, "article.bulk") ? <th className={`${th} w-10`}><span className="sr-only">Select</span></th> : null}
                <th className={th}>Title</th>
                <th className={th}>Status</th>
                <th className={th}>Category</th>
                <th className={th}>Author</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-[#FBFBF9]">
                  {can(user, "article.bulk") ? (
                    <td className={td}>
                      <input type="checkbox" name="bulk" value={a.id} className="checkbox" aria-label={`Select ${a.title}`} />
                    </td>
                  ) : null}
                  <td className={td}>
                    <Link href={`/admin/articles/${a.id}/edit`} className="font-medium no-underline hover:text-accent">
                      {a.title}
                    </Link>
                    <p className="font-mono text-[12px] text-muted">
                      /guides/{a.slug} · {ARTICLE_TYPE_LABEL[a.type]}
                      {!a.robotsIndex ? " · noindex" : ""}
                    </p>
                  </td>
                  <td className={td}>
                    <StatusBadge status={a.status} />
                    {a.scheduledAt ? <p className="mono-label mt-1 text-muted">{a.scheduledAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</p> : null}
                  </td>
                  <td className={td}>{a.primaryCategory.name}</td>
                  <td className={td}>{a.author.name}</td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{a.updatedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</td>
                </tr>
              ))}
              {!rows.length ? <EmptyRow colSpan={6}>No articles match these filters.</EmptyRow> : null}
            </tbody>
          </table>
        </div>
      </ArticleBulkBar>

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-[14px]">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="btn btn-secondary btn-sm" href={qs({ page: page - 1 })}>Previous</Link> : null}
            {page < pages ? <Link className="btn btn-secondary btn-sm" href={qs({ page: page + 1 })}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </AdminPage>
  );
}
