import type { Metadata } from "next";
import { requireCapability } from "@/lib/auth/session";
import { newEditorProps } from "@/server/articles/editor-data";
import { ArticleEditor } from "@/components/admin/editor/article-editor";

export const metadata: Metadata = { title: "New article" };

/** Full editor in "unsaved" mode — the first save (or autosave) creates the draft. */
export default async function NewArticlePage() {
  const user = await requireCapability("article.create");
  const props = await newEditorProps(user);
  return <ArticleEditor {...props} />;
}
