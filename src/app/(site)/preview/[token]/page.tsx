import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/utils/crypto";
import { NOINDEX } from "@/lib/seo/metadata";
import { articleViewInclude } from "@/server/articles/public";
import { ArticleView } from "@/components/article/article-view";
import { getSession } from "@/lib/auth/session";
import { canViewArticleInAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: NOINDEX };

/**
 * Editorial preview. Access requires either an unexpired preview token, or the
 * path form /preview/a-<articleId> plus a signed-in user allowed to view it.
 * Always noindex (meta + X-Robots-Tag header from proxy) and never cached.
 */
export default async function PreviewPage({ params }: PageProps<"/preview/[token]">) {
  const { token } = await params;
  let articleId: string | null = null;

  if (token.startsWith("a-")) {
    const s = await getSession();
    const candidate = await db.article.findUnique({ where: { id: token.slice(2) }, select: { id: true, authorId: true } });
    if (s && !s.mfaPending && candidate && canViewArticleInAdmin(s.user, candidate)) articleId = candidate.id;
  } else if (token.length >= 20 && token.length <= 100) {
    const row = await db.previewToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (row && row.expiresAt > new Date()) articleId = row.articleId;
  }
  if (!articleId) notFound();

  const article = await db.article.findUnique({ where: { id: articleId }, include: articleViewInclude() });
  if (!article) notFound();
  const display = { ...article, firstPublishedAt: article.firstPublishedAt ?? new Date(article.updatedAt) };

  return (
    <>
      <div role="status" className="sticky top-0 z-50 border-b border-warning/40 bg-warning-soft">
        <p className="container-page py-2 text-[14px]">
          <strong>Preview</strong> · status <span className="font-mono">{article.status}</span> · not visible to the public or search engines. Dates shown are provisional.
        </p>
      </div>
      <ArticleView article={display} ads={{ enabled: false, reason: "preview" }} preview />
    </>
  );
}
