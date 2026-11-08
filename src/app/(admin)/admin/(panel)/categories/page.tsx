import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/auth/session";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { deleteCategory, deleteTag, mergeTags, saveCategory, saveTag } from "@/server/taxonomy/actions";
import { CATEGORY_ICON_KEYS } from "@/components/site/category-icon";

export const metadata: Metadata = { title: "Categories & tags" };

type Faq = { question: string; answer: string };

type Cat = Awaited<ReturnType<typeof loadCategories>>[number];

function loadCategories() {
  return db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { primaryArticles: true } } } });
}

function CategoryFields({ c, categories }: { c?: Cat; categories: Cat[] }) {
  return (
    <>
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="field-label" htmlFor={`n-${c?.id ?? "new"}`}>Name</label>
          <input id={`n-${c?.id ?? "new"}`} name="name" defaultValue={c?.name} required className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor={`s-${c?.id ?? "new"}`}>Slug</label>
          <input id={`s-${c?.id ?? "new"}`} name="slug" defaultValue={c?.slug} className="input font-mono text-[13px]" placeholder="auto from name" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label" htmlFor={`o-${c?.id ?? "new"}`}>Order</label>
            <input id={`o-${c?.id ?? "new"}`} name="sortOrder" type="number" min={0} defaultValue={c?.sortOrder ?? 0} className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor={`i-${c?.id ?? "new"}`}>Icon</label>
            <select id={`i-${c?.id ?? "new"}`} name="icon" defaultValue={c?.icon ?? ""} className="select">
              <option value="">default</option>
              {CATEGORY_ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor={`d-${c?.id ?? "new"}`}>Short description (cards, meta fallback)</label>
        <textarea id={`d-${c?.id ?? "new"}`} name="description" defaultValue={c?.description} className="textarea min-h-[64px]" maxLength={400} />
      </div>
      <div>
        <label className="field-label" htmlFor={`in-${c?.id ?? "new"}`}>Editorial introduction (category page)</label>
        <textarea id={`in-${c?.id ?? "new"}`} name="intro" defaultValue={c?.intro} className="textarea" maxLength={4000} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`st-${c?.id ?? "new"}`}>SEO title</label>
          <input id={`st-${c?.id ?? "new"}`} name="seoTitle" defaultValue={c?.seoTitle ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor={`sd-${c?.id ?? "new"}`}>SEO description</label>
          <input id={`sd-${c?.id ?? "new"}`} name="seoDescription" defaultValue={c?.seoDescription ?? ""} className="input" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`p-${c?.id ?? "new"}`}>Parent (optional)</label>
          <select id={`p-${c?.id ?? "new"}`} name="parentId" defaultValue={c?.parentId ?? ""} className="select">
            <option value="">— top level —</option>
            {categories.filter((x) => x.id !== c?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 pt-7 text-[14px]">
          <input type="checkbox" name="visible" defaultChecked={c?.visible ?? true} className="checkbox" /> Visible on site
        </label>
      </div>
      <div>
        <label className="field-label" htmlFor={`f-${c?.id ?? "new"}`}>FAQ content (shown as plain content; no FAQ rich-result markup)</label>
        <textarea
          id={`f-${c?.id ?? "new"}`}
          name="faq"
          className="textarea font-mono text-[13px]"
          placeholder={"Q: Question?\nA: Answer.\n\nQ: Next question?\nA: Answer."}
          defaultValue={((Array.isArray(c?.faq) ? c.faq : []) as Faq[]).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}
        />
      </div>
    </>
  );
}

export default async function CategoriesPage() {
  await requireCapability("taxonomy.manage");
  const [categories, tags] = await Promise.all([
    loadCategories(),
    db.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true } } } }),
  ]);

  return (
    <AdminPage title="Categories & tags" description="Categories are the editorial silos. Empty categories are kept out of the index automatically.">
      <div className="space-y-6">
        <Panel title="Add category">
          <ActionForm action={saveCategory} submitLabel="Create category" resetOnSuccess>
            <CategoryFields categories={categories} />
          </ActionForm>
        </Panel>

        {categories.map((c) => (
          <details key={c.id} className="rounded-[10px] border border-line bg-surface">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3">
              <span className="font-medium">
                {c.name} <span className="font-mono text-[12px] text-muted">/category/{c.slug}</span>
              </span>
              <span className="mono-label text-muted">
                {c._count.primaryArticles} articles{c.visible ? "" : " · hidden"}
              </span>
            </summary>
            <div className="space-y-4 border-t border-line p-5">
              <ActionForm action={saveCategory}>
                <CategoryFields c={c} categories={categories} />
              </ActionForm>
              <ActionForm action={deleteCategory} submitLabel="Delete category" submitClassName="btn btn-ghost btn-sm text-danger">
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
            </div>
          </details>
        ))}

        <Panel title={`Tags (${tags.length})`}>
          <ActionForm action={saveTag} submitLabel="Add tag" resetOnSuccess className="mb-6 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label className="field-label" htmlFor="tag-name">Name</label>
              <input id="tag-name" name="name" required className="input" />
            </div>
            <div>
              <label className="field-label" htmlFor="tag-desc">Description (optional)</label>
              <input id="tag-desc" name="description" className="input" />
            </div>
          </ActionForm>
          {tags.length > 1 ? (
            <ActionForm action={mergeTags} submitLabel="Merge" className="mb-6 grid gap-3 rounded-md border border-line p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div>
                <label className="field-label" htmlFor="m-from">Merge duplicate tag…</label>
                <select id="m-from" name="from" className="select">{tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
              <div>
                <label className="field-label" htmlFor="m-into">…into</label>
                <select id="m-into" name="into" className="select">{tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
            </ActionForm>
          ) : null}
          <ul className="divide-y divide-line">
            {tags.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                <ActionForm action={saveTag} submitLabel="Save" className="flex flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <label className="sr-only" htmlFor={`tn-${t.id}`}>Name</label>
                  <input id={`tn-${t.id}`} name="name" defaultValue={t.name} className="input min-h-9 w-48 py-1" />
                  <label className="sr-only" htmlFor={`ts-${t.id}`}>Slug</label>
                  <input id={`ts-${t.id}`} name="slug" defaultValue={t.slug} className="input min-h-9 w-48 py-1 font-mono text-[12.5px]" />
                  <span className="mono-label text-muted">{t._count.articles} articles</span>
                </ActionForm>
                <ActionForm action={deleteTag} submitLabel="Delete" submitClassName="btn btn-ghost btn-sm text-danger" className="">
                  <input type="hidden" name="id" value={t.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AdminPage>
  );
}
