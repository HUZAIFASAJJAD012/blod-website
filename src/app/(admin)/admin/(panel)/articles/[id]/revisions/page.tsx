import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diffWords } from "diff";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { canViewArticleInAdmin } from "@/lib/permissions";
import { AdminPage, Panel } from "@/components/admin/ui";
import { RestoreRevisionButton } from "@/components/admin/restore-revision-button";
import { docToPlainText } from "@/lib/content/extract";
import { sanitizeDoc } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Revisions" };

type Snap = { title?: string; excerpt?: string; bodyJson?: unknown; metaTitle?: string | null; metaDescription?: string | null; slug?: string };

function snapText(s: Snap) {
  return [`# ${s.title ?? ""}`, s.excerpt ?? "", docToPlainText(sanitizeDoc(s.bodyJson))].join("\n\n");
}

export default async function RevisionsPage({ params, searchParams }: PageProps<"/admin/articles/[id]/revisions">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const article = await db.article.findUnique({ where: { id }, select: { id: true, title: true, authorId: true, status: true } });
  if (!article || !canViewArticleInAdmin(user, article)) notFound();
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const revisions = await db.articleRevision.findMany({
    where: { articleId: id, ...(q ? { summary: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { version: "desc" },
    take: 100,
    include: { author: { select: { name: true } } },
  });
  const selectedId = typeof sp.r === "string" ? sp.r : revisions[0]?.id;
  const idx = revisions.findIndex((r) => r.id === selectedId);
  const selected = revisions[idx];
  const previous = idx >= 0 ? (revisions[idx + 1] ?? null) : null;
  const parts = selected ? diffWords(previous ? snapText(previous.snapshotJson as Snap) : "", snapText(selected.snapshotJson as Snap)) : [];

  return (
    <AdminPage title="Revision history" description={<>For “{article.title}”. Restoring creates a new revision and is recorded in the audit log.</>} actions={<Link href={`/admin/articles/${id}/edit`} className="btn btn-secondary btn-sm">Back to editor</Link>}>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title={`${revisions.length} revisions`}>
          <form method="get" className="mb-3">
            <label htmlFor="rq" className="sr-only">Search revisions</label>
            <input id="rq" name="q" defaultValue={q} className="input" placeholder="Search summaries (e.g. publish)" />
          </form>
          <ol className="max-h-[70vh] space-y-1 overflow-y-auto">
            {revisions.map((r) => (
              <li key={r.id}>
                <Link href={`?r=${r.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={r.id === selectedId ? "true" : undefined} className={`block rounded-md px-3 py-2 text-[13.5px] no-underline ${r.id === selectedId ? "bg-ink text-white" : "hover:bg-black/5"}`}>
                  <span className="font-mono">v{r.version}</span> · {r.summary || "Saved"}
                  <span className={`block text-[12px] ${r.id === selectedId ? "text-white/70" : "text-muted"}`}>
                    {r.author.name} · {r.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={selected ? `v${selected.version} compared with ${previous ? `v${previous.version}` : "empty"}` : "No revision selected"} actions={selected && article.status !== "ARCHIVED" ? <RestoreRevisionButton articleId={id} revisionId={selected.id} version={selected.version} /> : null}>
          {selected ? (
            <div className="prose-article max-h-[70vh] overflow-y-auto text-[15px] whitespace-pre-wrap" aria-label="Diff">
              {parts.map((p, i) =>
                p.added ? (
                  <ins key={i} className="bg-positive-soft text-positive no-underline">{p.value}</ins>
                ) : p.removed ? (
                  <del key={i} className="bg-danger-soft text-danger">{p.value}</del>
                ) : (
                  <span key={i}>{p.value}</span>
                ),
              )}
            </div>
          ) : (
            <p className="text-muted">No revisions yet.</p>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}
