import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { loadForEditor } from "@/server/articles/admin";
import { editEditorProps } from "@/server/articles/editor-data";
import { ArticleEditor } from "@/components/admin/editor/article-editor";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: PageProps<"/admin/articles/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  // IDOR guard: authors only see their own articles; returns null otherwise.
  const article = await loadForEditor(user, id);
  if (!article) notFound();
  const props = await editEditorProps(user, article);
  // key forces a fresh editor when switching between articles.
  return <ArticleEditor key={`${article.id}`} {...props} />;
}
