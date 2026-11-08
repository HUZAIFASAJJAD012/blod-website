"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, History, ImageIcon, Plus, Trash2 } from "lucide-react";
import { RichEditor } from "@/components/editor/rich-editor";
import { MediaPicker } from "@/components/editor/media-picker";
import type { MediaItem } from "@/server/media/actions";
import { TagPicker, RelatedPicker, type RelatedItem } from "./pickers";
import { JsonLdPreview, SerpPreview, SocialPreview } from "./seo-previews";
import {
  checkReferencesAction,
  createArticleWithContentAction,
  duplicateArticleAction,
  previewTokenAction,
  runChecksAction,
  saveArticleAction,
  transitionArticleAction,
} from "@/server/articles/actions";
import type { CheckResult } from "@/server/articles/checks";
import type { JSONContent } from "@/lib/content/schema";
import { docToPlainText, extractLinks, extractToc, wordCount } from "@/lib/content/extract";
import { slugify, isValidSlug } from "@/lib/utils/slug";
import { ARTICLE_TYPES, REFERENCE_TYPES, type WorkflowAction } from "@/lib/schemas/article";

export type EditorMedia = Pick<MediaItem, "id" | "fileUrl" | "alt" | "width" | "height">;

export type EditorForm = {
  title: string;
  slug: string;
  excerpt: string;
  primaryCategoryId: string;
  secondaryCategoryIds: string[];
  tagIds: string[];
  newTags: string[];
  cover: EditorMedia | null;
  ogImage: EditorMedia | null;
  bodyJson: JSONContent;
  type: (typeof ARTICLE_TYPES)[number];
  schemaType: "BLOG_POSTING" | "ARTICLE" | "NEWS_ARTICLE";
  visibility: "PUBLIC" | "PRIVATE";
  related: RelatedItem[];
  authorId: string;
  reviewerId: string;
  testedEnvironment: { label: string; value: string }[];
  verification: { stepsVerified: boolean; originalScreenshots: boolean; claimsSourced: boolean };
  references: { title: string; url: string; publisher: string; accessedAt: string; referenceType: (typeof REFERENCE_TYPES)[number]; isPrimary: boolean }[];
  lastVerifiedAt: string;
  markMaterialUpdate: boolean;
  correctionsNote: string;
  revisionReason: string;
  affiliateDisclosureFlag: boolean;
  affiliateDisclosureText: string;
  metaTitle: string;
  metaDescription: string;
  searchIntent: string;
  secondaryQueries: string[];
  canonicalOverride: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  featuredOnHome: boolean;
  featuredRank: string;
  pinnedUntil: string;
  brief: { queryIntent: string; competitorNotes: string; unmetNeeds: string; experiment: string; difficulty: string };
  createRedirectOnSlugChange: boolean;
};

export type EditorProps = {
  mode: "new" | "edit";
  articleId: string | null;
  version: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  publishedSlug: string | null;
  firstPublishedAt: string | null;
  scheduledAt: string | null;
  initial: EditorForm;
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  users: { id: string; name: string; role: string; publicProfile: boolean }[];
  checks: CheckResult[];
  actions: WorkflowAction[];
  perms: { editAny: boolean; review: boolean; canonical: boolean; readOnly: boolean };
  siteOrigin: string;
  titleSuffix: string;
  brandName: string;
  presignedUploads: boolean;
  lastSavedAt: string | null;
  revisionCount: number;
};

type SaveState = { kind: "idle" | "dirty" | "saving" | "saved" | "error" | "conflict"; at?: string; message?: string };

const ACTION_LABEL: Record<WorkflowAction, string> = {
  submit: "Submit for review",
  approve: "Approve",
  requestChanges: "Request changes",
  publish: "Publish now",
  schedule: "Schedule",
  unpublish: "Unpublish",
  archive: "Archive",
  restoreDraft: "Restore to draft",
};

function toPayload(f: EditorForm) {
  const nul = (s: string) => (s.trim() ? s.trim() : null);
  return {
    title: f.title,
    slug: f.slug,
    excerpt: f.excerpt,
    primaryCategoryId: f.primaryCategoryId,
    secondaryCategoryIds: f.secondaryCategoryIds,
    tagIds: f.tagIds,
    newTags: f.newTags,
    coverMediaId: f.cover?.id ?? null,
    ogImageId: f.ogImage?.id ?? null,
    // ProseMirror builds attrs with Object.create(null); React's action serializer only
    // accepts plain objects, so round-trip through JSON to get plain prototypes.
    bodyJson: JSON.parse(JSON.stringify(f.bodyJson)),
    type: f.type,
    schemaType: f.schemaType,
    visibility: f.visibility,
    relatedIds: f.related.map((r) => r.id),
    authorId: f.authorId,
    reviewerId: nul(f.reviewerId),
    testedEnvironment: f.testedEnvironment.filter((e) => e.label.trim() && e.value.trim()),
    verification: f.verification,
    references: f.references.filter((r) => r.url.trim()).map((r) => ({ ...r, publisher: nul(r.publisher) })),
    lastVerifiedAt: nul(f.lastVerifiedAt),
    markMaterialUpdate: f.markMaterialUpdate,
    correctionsNote: nul(f.correctionsNote),
    revisionReason: nul(f.revisionReason),
    affiliateDisclosureFlag: f.affiliateDisclosureFlag,
    affiliateDisclosureText: nul(f.affiliateDisclosureText),
    metaTitle: nul(f.metaTitle),
    metaDescription: nul(f.metaDescription),
    searchIntent: nul(f.searchIntent),
    secondaryQueries: f.secondaryQueries.filter(Boolean),
    canonicalOverride: nul(f.canonicalOverride),
    robotsIndex: f.robotsIndex,
    robotsFollow: f.robotsFollow,
    ogTitle: nul(f.ogTitle),
    ogDescription: nul(f.ogDescription),
    featuredOnHome: f.featuredOnHome,
    featuredRank: f.featuredRank ? Number(f.featuredRank) : null,
    pinnedUntil: nul(f.pinnedUntil),
    brief: f.brief,
    createRedirectOnSlugChange: f.createRedirectOnSlugChange,
  };
}

function Field({ label, htmlFor, hint, error, children, counter }: { label: string; htmlFor: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; counter?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="field-label">
          {label}
        </label>
        {counter ? <span className="mono-label text-muted">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-2.5 text-[14px]">
      <input type="checkbox" className="checkbox mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint ? <span className="block text-[12.5px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

const TABS = ["Publish", "Evidence", "SEO", "Brief"] as const;

export function ArticleEditor(props: EditorProps) {
  const router = useRouter();
  const [f, setF] = useState<EditorForm>(props.initial);
  const [articleId, setArticleId] = useState(props.articleId);
  const version = useRef(props.version);
  const [save, setSave] = useState<SaveState>({ kind: props.lastSavedAt ? "saved" : "idle", at: props.lastSavedAt ?? undefined });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<(typeof TABS)[number]>("Publish");
  const [checks, setChecks] = useState<CheckResult[]>(props.checks);
  const [picker, setPicker] = useState<null | "cover" | "og">(null);
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");
  const [busy, startBusy] = useTransition();
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [schedule, setSchedule] = useState({ at: props.scheduledAt ? props.scheduledAt.slice(0, 16) : "", tz: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC" });
  const [refHealth, setRefHealth] = useState<Record<string, string>>({});
  const dirty = save.kind === "dirty" || save.kind === "error";
  const ro = props.perms.readOnly;
  const savingRef = useRef(false);
  const formRef = useRef(f);
  useEffect(() => {
    formRef.current = f;
  }, [f]);

  const slugTouchedRef = useRef(slugTouched);
  useEffect(() => {
    slugTouchedRef.current = slugTouched;
  }, [slugTouched]);

  const update = useCallback(<K extends keyof EditorForm>(key: K, value: EditorForm[K]) => {
    // Auto-suggest the slug from the title until the editor edits the slug by hand.
    setF((prev) => ({ ...prev, [key]: value, ...(key === "title" && !slugTouchedRef.current ? { slug: slugify(String(value)) } : {}) }));
    setSave((s) => (s.kind === "conflict" ? s : { kind: "dirty", at: s.at }));
  }, []);

  const doSave = useCallback(
    async (autosave: boolean): Promise<boolean> => {
      if (ro || savingRef.current) return false;
      savingRef.current = true;
      setSave((s) => ({ kind: "saving", at: s.at }));
      const payload = toPayload(formRef.current);
      const res = articleId ? await saveArticleAction(articleId, version.current, payload, autosave) : await createArticleWithContentAction(payload);
      savingRef.current = false;
      if (!res.ok) {
        setFieldErrors(res.fieldErrors ?? {});
        setSave({ kind: res.code === 409 ? "conflict" : "error", message: res.error });
        return false;
      }
      version.current = res.data.version;
      setFieldErrors({});
      setSave({ kind: "saved", at: res.data.savedAt });
      if (res.data.redirectCreated) setFlash({ tone: "ok", text: `Slug changed — ${res.data.redirectCreated} now permanently redirects to the new URL.` });
      if (!articleId) {
        setArticleId(res.data.id);
        router.replace(`/admin/articles/${res.data.id}/edit`);
      } else if (!autosave) router.refresh();
      return true;
    },
    [articleId, ro, router],
  );

  // Debounced autosave (server-confirmed; the indicator only says "Saved" after the response).
  useEffect(() => {
    if (save.kind !== "dirty" || ro) return;
    if (!articleId && (!f.title.trim() || !f.primaryCategoryId)) return;
    const t = setTimeout(() => void doSave(true), 4000);
    return () => clearTimeout(t);
  }, [f, save.kind, doSave, articleId, ro]);

  // Warn about unsaved changes when leaving.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty || save.kind === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, save.kind]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doSave]);

  const toc = useMemo(() => extractToc(f.bodyJson), [f.bodyJson]);
  const words = useMemo(() => wordCount(docToPlainText(f.bodyJson)), [f.bodyJson]);
  const links = useMemo(() => extractLinks(f.bodyJson, props.siteOrigin), [f.bodyJson, props.siteOrigin]);
  const published = props.status === "PUBLISHED";
  const slugChanged = Boolean(props.publishedSlug && f.slug !== props.publishedSlug);
  const effectiveTitle = f.metaTitle || f.title;
  const fullTitle = effectiveTitle.toLowerCase().includes(props.titleSuffix.toLowerCase()) ? effectiveTitle : `${effectiveTitle} | ${props.titleSuffix}`;
  const url = `${props.siteOrigin}/guides/${f.slug}`;
  const author = props.users.find((u) => u.id === f.authorId);

  const ld = {
    "@context": "https://schema.org",
    "@type": { BLOG_POSTING: "BlogPosting", ARTICLE: "Article", NEWS_ARTICLE: "NewsArticle" }[f.type === "NEWS" ? "NEWS_ARTICLE" : f.schemaType],
    headline: f.title.slice(0, 110),
    description: f.metaDescription || f.excerpt,
    ...(f.cover || f.ogImage ? { image: [(f.ogImage ?? f.cover)!.fileUrl] } : {}),
    datePublished: props.firstPublishedAt ?? "(set on publish)",
    dateModified: "(set from material updates)",
    author: { "@type": "Person", name: author?.name ?? "" },
    publisher: { "@type": "Organization", name: props.brandName },
    mainEntityOfPage: url,
  };
  const ldProblems = [
    !f.title.trim() && "Headline is empty.",
    f.title.length > 110 && "Headline longer than 110 characters will be truncated.",
    !f.cover && !f.ogImage && "No image — Google recommends at least one image for Article results.",
    author && !author.publicProfile && "Author has no public profile page to link to.",
  ].filter(Boolean) as string[];

  async function runTransition(action: WorkflowAction) {
    setFlash(null);
    if (!articleId) return;
    if (dirty && !(await doSave(false))) return setFlash({ tone: "err", text: "Fix the save error before changing status." });
    if (action === "archive" && !window.confirm("Archive this article? It will be removed from the public site.")) return;
    if (action === "unpublish" && !window.confirm("Unpublish this article? Its URL will return 404 until it's published again.")) return;
    startBusy(async () => {
      const res = await transitionArticleAction(articleId, action, action === "schedule" ? { scheduledAt: schedule.at ? new Date(schedule.at).toISOString() : undefined, timezone: schedule.tz } : {});
      if (!res.ok) setFlash({ tone: "err", text: res.error });
      else {
        setFlash({ tone: "ok", text: `Done — status is now ${res.data.status.toLowerCase().replace("_", " ")}.` });
        router.refresh();
      }
    });
  }

  const err = (k: string) => fieldErrors[k];

  return (
    <div className="pb-28">
      {/* Sticky status bar */}
      <div className="sticky top-[72px] z-30 border-b border-line bg-[#F3F2EE]/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 lg:px-8">
          <Link href="/admin/articles" className="text-[13px] text-muted no-underline hover:text-ink">
            ← Articles
          </Link>
          <span className="badge">{props.status.replace("_", " ").toLowerCase()}</span>
          <span role="status" aria-live="polite" className="mono-label flex items-center gap-1.5">
            {save.kind === "saving" ? (
              <span className="text-muted">Saving…</span>
            ) : save.kind === "saved" ? (
              <span className="flex items-center gap-1 text-positive">
                <CheckCircle2 size={13} aria-hidden="true" /> Saved {save.at ? new Date(save.at).toLocaleTimeString() : ""}
              </span>
            ) : save.kind === "dirty" ? (
              <span className="text-warning">Unsaved changes</span>
            ) : save.kind === "conflict" ? (
              <span className="flex items-center gap-2 text-danger">
                <AlertTriangle size={13} aria-hidden="true" /> {save.message}
                <button type="button" className="underline" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </span>
            ) : save.kind === "error" ? (
              <span className="flex items-center gap-2 text-danger">
                <AlertTriangle size={13} aria-hidden="true" /> {save.message}
                <button type="button" className="underline" onClick={() => void doSave(false)}>
                  Retry
                </button>
              </span>
            ) : (
              <span className="text-muted">Not saved yet</span>
            )}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {articleId ? (
              <>
                <Link href={`/admin/articles/${articleId}/revisions`} className="btn btn-ghost btn-sm">
                  <History size={14} aria-hidden="true" /> Revisions ({props.revisionCount})
                </Link>
                <a href={`/preview/a-${articleId}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                  <Eye size={14} aria-hidden="true" /> Preview
                </a>
              </>
            ) : null}
            {published && props.publishedSlug ? (
              <a href={`/guides/${props.publishedSlug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                View live <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : null}
          </span>
        </div>
        {flash ? (
          <p role={flash.tone === "err" ? "alert" : "status"} className={`border-t px-4 py-2 text-[14px] lg:px-8 ${flash.tone === "err" ? "border-danger/30 bg-danger-soft text-danger" : "border-positive/30 bg-positive-soft text-positive"}`}>
            {flash.text}
          </p>
        ) : null}
        {ro ? <p className="border-t border-warning/30 bg-warning-soft px-4 py-2 text-[14px] text-[#6f4512] lg:px-8">Read-only: you can&apos;t edit this article in its current status. Ask an editor to move it back to draft.</p> : null}
      </div>

      <div className="flex flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:px-8">
        {/* ── A. Main column ── */}
        <div className="min-w-0 flex-1 space-y-5 lg:max-w-[900px]">
          <fieldset disabled={ro} className="space-y-5 rounded-[10px] border border-line bg-surface p-5">
            <legend className="sr-only">Basic details</legend>
            <Field label="Title" htmlFor="title" error={err("title")} counter={`${f.title.length} chars`} hint="Describe the problem the way a reader would search for it. No hard length limit.">
              <input id="title" className="input text-[18px] font-medium" value={f.title} onChange={(e) => update("title", e.target.value)} aria-invalid={Boolean(err("title"))} maxLength={200} />
            </Field>
            <Field
              label="Slug"
              htmlFor="slug"
              error={err("slug") ?? (!isValidSlug(f.slug) && f.slug ? "Use lower-case letters, numbers and single hyphens." : undefined)}
              hint={<span className="font-mono">/guides/{f.slug || "…"}</span>}
            >
              <div className="flex gap-2">
                <input
                  id="slug"
                  className="input font-mono text-[14px]"
                  value={f.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").slice(0, 90));
                  }}
                />
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => (setSlugTouched(true), update("slug", slugify(f.title)))}>
                  From title
                </button>
              </div>
            </Field>
            {slugChanged ? (
              <div className="rounded-md border border-warning/40 bg-warning-soft p-3 text-[14px]">
                <p className="font-medium text-[#6f4512]">You&apos;re changing the URL of a published article.</p>
                <p className="mt-1 text-[13.5px] text-[#6f4512]">
                  Old: <span className="font-mono">/guides/{props.publishedSlug}</span> → new: <span className="font-mono">/guides/{f.slug}</span>
                </p>
                <div className="mt-2">
                  <Toggle checked={f.createRedirectOnSlugChange} onChange={(v) => update("createRedirectOnSlugChange", v)} label="Create a permanent 301 redirect from the old URL (strongly recommended)" />
                </div>
              </div>
            ) : null}
            <Field label="Excerpt / deck" htmlFor="excerpt" error={err("excerpt")} counter={`${f.excerpt.length}/500`} hint="1–3 sentences shown under the title and on cards. Separate from the meta description.">
              <textarea id="excerpt" className="textarea min-h-[84px]" value={f.excerpt} onChange={(e) => update("excerpt", e.target.value)} maxLength={500} />
            </Field>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Primary category" htmlFor="cat" error={err("primaryCategoryId")}>
                <select id="cat" className="select" value={f.primaryCategoryId} onChange={(e) => update("primaryCategoryId", e.target.value)}>
                  <option value="">Choose…</option>
                  {props.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Article type" htmlFor="atype" hint={f.type === "NEWS" ? "News needs a primary source and is marked up as NewsArticle." : undefined}>
                <select id="atype" className="select" value={f.type} onChange={(e) => update("type", e.target.value as EditorForm["type"])}>
                  {ARTICLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <details className="rounded-md border border-line px-3 py-2">
              <summary className="cursor-pointer text-[14px] font-medium">Secondary categories ({f.secondaryCategoryIds.length}) — only if editorially justified</summary>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {props.categories
                  .filter((c) => c.id !== f.primaryCategoryId)
                  .map((c) => (
                    <Toggle
                      key={c.id}
                      label={c.name}
                      checked={f.secondaryCategoryIds.includes(c.id)}
                      disabled={!f.secondaryCategoryIds.includes(c.id) && f.secondaryCategoryIds.length >= 3}
                      onChange={(v) => update("secondaryCategoryIds", v ? [...f.secondaryCategoryIds, c.id] : f.secondaryCategoryIds.filter((x) => x !== c.id))}
                    />
                  ))}
              </div>
            </details>
            <div>
              <p className="field-label">Tags</p>
              <TagPicker all={props.tags} selectedIds={f.tagIds} newTags={f.newTags} disabled={ro} onChange={(ids, nt) => (update("tagIds", ids), update("newTags", nt))} />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="field-label">Cover image</p>
                {f.cover ? (
                  <div className="rounded-md border border-line p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                    <img src={f.cover.fileUrl} alt={f.cover.alt} className="aspect-video w-full rounded object-cover" />
                    <p className={`mt-1 truncate text-[12.5px] ${f.cover.alt ? "text-muted" : "text-warning"}`}>Alt: {f.cover.alt || "missing — edit in Media"}</p>
                    <div className="mt-1 flex gap-2">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicker("cover")}>
                        Replace
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => update("cover", null)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-secondary w-full" onClick={() => setPicker("cover")}>
                    <ImageIcon size={15} aria-hidden="true" /> Add cover (only if meaningful)
                  </button>
                )}
              </div>
              <div>
                <p className="field-label">Social share image (optional)</p>
                {f.ogImage ? (
                  <div className="rounded-md border border-line p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                    <img src={f.ogImage.fileUrl} alt={f.ogImage.alt} className="aspect-[1.91/1] w-full rounded object-cover" />
                    <div className="mt-1 flex gap-2">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicker("og")}>
                        Replace
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => update("ogImage", null)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-secondary w-full" onClick={() => setPicker("og")}>
                    <ImageIcon size={15} aria-hidden="true" /> Add social image (1200×630)
                  </button>
                )}
              </div>
            </div>
          </fieldset>

          <section aria-label="Body">
            {ro ? (
              <div className="rounded-[10px] border border-line bg-surface p-5 text-muted">Body editing is locked for this status. Use Preview to read it.</div>
            ) : (
              <RichEditor initial={props.initial.bodyJson} presignedUploads={props.presignedUploads} onChange={(doc) => update("bodyJson", doc)} />
            )}
          </section>

          <section className="rounded-[10px] border border-line bg-surface p-5" aria-labelledby="toc-prev">
            <h2 id="toc-prev" className="text-[15px] font-semibold">
              Table of contents preview
            </h2>
            {toc.length ? (
              <ol className="mt-2 space-y-1 text-[14px]">
                {toc.map((t) => (
                  <li key={t.id} className={t.level === 3 ? "pl-4 text-muted" : ""}>
                    {t.text} <span className="font-mono text-[11px] text-muted">#{t.id}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-[14px] text-muted">Add H2/H3 headings — the TOC is generated from them automatically.</p>
            )}
          </section>

          <section className="rounded-[10px] border border-line bg-surface p-5" aria-labelledby="rel-h">
            <h2 id="rel-h" className="mb-2 text-[15px] font-semibold">
              Related troubleshooting (max 5, published only)
            </h2>
            <RelatedPicker articleId={articleId} value={f.related} disabled={ro} onChange={(v) => update("related", v)} />
          </section>
        </div>

        {/* ── Right settings panel ── */}
        <aside className="w-full shrink-0 lg:sticky lg:top-[132px] lg:max-h-[calc(100dvh-150px)] lg:w-[320px] lg:overflow-y-auto" aria-label="Article settings">
          <div role="tablist" aria-label="Settings sections" className="mb-3 grid grid-cols-4 gap-1 rounded-[10px] border border-line bg-surface p-1">
            {TABS.map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} aria-controls={`tab-${t}`} id={`tabbtn-${t}`} onClick={() => setTab(t)} className={`min-h-9 rounded-md text-[13px] font-medium ${tab === t ? "bg-ink text-white" : "hover:bg-black/5"}`}>
                {t}
              </button>
            ))}
          </div>

          <fieldset disabled={ro} className="space-y-4 rounded-[10px] border border-line bg-surface p-4" role="tabpanel" id={`tab-${tab}`} aria-labelledby={`tabbtn-${tab}`}>
            {tab === "Publish" ? (
              <>
                <Field label="Author" htmlFor="author" hint={author && !author.publicProfile ? "This author has no public profile yet." : "Real staff only — no invented personas."}>
                  <select id="author" className="select" value={f.authorId} disabled={!props.perms.editAny} onChange={(e) => update("authorId", e.target.value)}>
                    {props.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reviewer (optional)" htmlFor="reviewer" error={err("reviewerId")} hint="The review date is recorded automatically when an editor approves or publishes.">
                  <select id="reviewer" className="select" value={f.reviewerId} disabled={!props.perms.review} onChange={(e) => update("reviewerId", e.target.value)}>
                    <option value="">— none —</option>
                    {props.users
                      .filter((u) => u.role !== "AUTHOR")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Visibility" htmlFor="vis">
                  <select id="vis" className="select" value={f.visibility} onChange={(e) => update("visibility", e.target.value as EditorForm["visibility"])}>
                    <option value="PUBLIC">Public (when published)</option>
                    <option value="PRIVATE">Private — preview links only, never indexed</option>
                  </select>
                </Field>
                <Field label="Schedule publication" htmlFor="sched" hint={`Timezone: ${schedule.tz}. Runs via the cron job.`}>
                  <input id="sched" type="datetime-local" className="input" value={schedule.at} onChange={(e) => setSchedule({ ...schedule, at: e.target.value })} disabled={!props.perms.review} />
                </Field>
                {props.perms.review ? (
                  <div className="space-y-2 border-t border-line pt-3">
                    <p className="text-[13px] font-semibold">Homepage &amp; collections</p>
                    <Toggle checked={f.featuredOnHome} onChange={(v) => update("featuredOnHome", v)} disabled={!published} label="Feature on homepage" hint={published ? undefined : "Only published articles can be featured."} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Rank" htmlFor="rank">
                        <input id="rank" type="number" min={1} max={99} className="input" value={f.featuredRank} disabled={!published} onChange={(e) => update("featuredRank", e.target.value)} />
                      </Field>
                      <Field label="Pin until" htmlFor="pin">
                        <input id="pin" type="date" className="input" value={f.pinnedUntil} disabled={!published} onChange={(e) => update("pinnedUntil", e.target.value)} />
                      </Field>
                    </div>
                    <p className="text-[12px] text-muted">Rank also curates “Start with these” on the category page. Editorial priority never overrides relevance in search.</p>
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "Evidence" ? (
              <>
                <div>
                  <p className="field-label">Tested environment</p>
                  {f.testedEnvironment.map((e, i) => (
                    <div key={i} className="mb-1.5 flex gap-1.5">
                      <input aria-label="Software" className="input min-h-9 py-1.5 text-[13px]" placeholder="e.g. WordPress" value={e.label} onChange={(ev) => update("testedEnvironment", f.testedEnvironment.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} />
                      <input aria-label="Version" className="input min-h-9 py-1.5 font-mono text-[13px]" placeholder="6.x / PHP 8.3" value={e.value} onChange={(ev) => update("testedEnvironment", f.testedEnvironment.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))} />
                      <button type="button" aria-label="Remove row" className="px-1 text-muted" onClick={() => update("testedEnvironment", f.testedEnvironment.filter((_, j) => j !== i))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="text-[13px] text-accent" onClick={() => update("testedEnvironment", [...f.testedEnvironment, { label: "", value: "" }])}>
                    <Plus size={13} className="inline" aria-hidden="true" /> Add environment row
                  </button>
                  <p className="field-hint">Only list versions you actually tested on.</p>
                </div>
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="text-[13px] font-semibold">Verification checklist</p>
                  <Toggle checked={f.verification.stepsVerified} onChange={(v) => update("verification", { ...f.verification, stepsVerified: v })} label="All steps reproduced on a test system" />
                  <Toggle checked={f.verification.originalScreenshots} onChange={(v) => update("verification", { ...f.verification, originalScreenshots: v })} label="Screenshots are original" />
                  <Toggle checked={f.verification.claimsSourced} onChange={(v) => update("verification", { ...f.verification, claimsSourced: v })} label="Factual claims are sourced" />
                  <Field label="Last verified (tested) date" htmlFor="lv" hint="Shown as “Last tested” on the article.">
                    <input id="lv" type="date" className="input" value={f.lastVerifiedAt} onChange={(e) => update("lastVerifiedAt", e.target.value)} />
                  </Field>
                </div>
                <div className="border-t border-line pt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[13px] font-semibold">References ({f.references.length})</p>
                    {articleId && f.references.length ? (
                      <button
                        type="button"
                        className="text-[12.5px] text-accent"
                        onClick={async () => {
                          if (dirty) await doSave(false);
                          const r = await checkReferencesAction(articleId);
                          if (r.ok) setRefHealth(Object.fromEntries(r.data.map((x) => [x.url, x.status ? String(x.status) : (x.error ?? "error")])));
                          else setFlash({ tone: "err", text: r.error });
                        }}
                      >
                        Check links
                      </button>
                    ) : null}
                  </div>
                  {f.references.map((r, i) => {
                    const set = (patch: Partial<EditorForm["references"][number]>) => update("references", f.references.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    const h = refHealth[r.url];
                    return (
                      <div key={i} className="mb-2 space-y-1 rounded-md border border-line p-2">
                        <div className="flex items-center justify-between">
                          <span className="mono-label text-muted">[{i + 1}]</span>
                          {h ? <span className={`mono-label ${Number(h) >= 200 && Number(h) < 400 ? "text-positive" : "text-danger"}`}>{h}</span> : null}
                          <button type="button" aria-label="Remove reference" className="text-muted" onClick={() => update("references", f.references.filter((_, j) => j !== i))}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <input aria-label="Reference title" className="input min-h-9 py-1 text-[13px]" placeholder="Title" value={r.title} onChange={(e) => set({ title: e.target.value })} />
                        <input aria-label="Reference URL" className="input min-h-9 py-1 font-mono text-[12px]" placeholder="https://" value={r.url} onChange={(e) => set({ url: e.target.value })} />
                        <div className="grid grid-cols-2 gap-1">
                          <input aria-label="Publisher" className="input min-h-9 py-1 text-[13px]" placeholder="Publisher" value={r.publisher} onChange={(e) => set({ publisher: e.target.value })} />
                          <input aria-label="Accessed on" type="date" className="input min-h-9 py-1 text-[13px]" value={r.accessedAt} onChange={(e) => set({ accessedAt: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2">
                          <select aria-label="Reference type" className="select min-h-9 py-1 text-[12.5px]" value={r.referenceType} onChange={(e) => set({ referenceType: e.target.value as typeof r.referenceType })}>
                            {REFERENCE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t.replace(/_/g, " ").toLowerCase()}
                              </option>
                            ))}
                          </select>
                          <Toggle checked={r.isPrimary} onChange={(v) => set({ isPrimary: v })} label="Primary" />
                        </div>
                      </div>
                    );
                  })}
                  {err("references") ? <p className="field-error">{err("references")}</p> : null}
                  <button type="button" className="text-[13px] text-accent" onClick={() => update("references", [...f.references, { title: "", url: "", publisher: "", accessedAt: new Date().toISOString().slice(0, 10), referenceType: "OFFICIAL_DOCS", isPrimary: false }])}>
                    <Plus size={13} className="inline" aria-hidden="true" /> Add reference
                  </button>
                </div>
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="text-[13px] font-semibold">Updates &amp; corrections</p>
                  {published ? <Toggle checked={f.markMaterialUpdate} onChange={(v) => update("markMaterialUpdate", v)} label="This save is a material update" hint="Sets the visible “Updated” date. Don't use for typo fixes." /> : null}
                  <Field label="What changed (revision reason)" htmlFor="rr">
                    <input id="rr" className="input" value={f.revisionReason} onChange={(e) => update("revisionReason", e.target.value)} maxLength={500} />
                  </Field>
                  <Field label="Public correction note" htmlFor="cn" hint="Shown at the end of the article.">
                    <textarea id="cn" className="textarea min-h-[64px]" value={f.correctionsNote} onChange={(e) => update("correctionsNote", e.target.value)} maxLength={1000} />
                  </Field>
                </div>
                <div className="space-y-2 border-t border-line pt-3">
                  <Toggle checked={f.affiliateDisclosureFlag} onChange={(v) => update("affiliateDisclosureFlag", v)} label="Contains affiliate links (show disclosure)" hint={`${links.filter((l) => l.sponsored).length} link(s) marked sponsored in the body.`} />
                  {f.affiliateDisclosureFlag ? (
                    <Field label="Disclosure text (optional override)" htmlFor="adt">
                      <textarea id="adt" className="textarea min-h-[64px]" value={f.affiliateDisclosureText} onChange={(e) => update("affiliateDisclosureText", e.target.value)} maxLength={600} />
                    </Field>
                  ) : null}
                </div>
              </>
            ) : null}

            {tab === "SEO" ? (
              <>
                <Field label="SEO title" htmlFor="mt" counter={`${fullTitle.length} chars`} hint="Defaults to the article title.">
                  <input id="mt" className="input" value={f.metaTitle} placeholder={f.title} onChange={(e) => update("metaTitle", e.target.value)} maxLength={200} />
                </Field>
                <Field label="Meta description" htmlFor="md" counter={`${(f.metaDescription || f.excerpt).length} chars`} hint="Defaults to the excerpt.">
                  <textarea id="md" className="textarea min-h-[72px]" value={f.metaDescription} placeholder={f.excerpt} onChange={(e) => update("metaDescription", e.target.value)} maxLength={320} />
                </Field>
                <SerpPreview title={fullTitle} url={url} description={f.metaDescription || f.excerpt} />
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="text-[13px] font-semibold">Internal planning (never output publicly)</p>
                  <Field label="Primary search intent / query" htmlFor="si">
                    <input id="si" className="input" value={f.searchIntent} onChange={(e) => update("searchIntent", e.target.value)} />
                  </Field>
                  <Field label="Secondary questions (one per line)" htmlFor="sq">
                    <textarea id="sq" className="textarea min-h-[64px]" value={f.secondaryQueries.join("\n")} onChange={(e) => update("secondaryQueries", e.target.value.split("\n").slice(0, 20))} />
                  </Field>
                </div>
                <div className="space-y-2 border-t border-line pt-3">
                  <Toggle checked={f.robotsIndex} onChange={(v) => update("robotsIndex", v)} label="Allow indexing" hint="Unchecked = noindex and excluded from the sitemap. Drafts and previews are always noindex." />
                  <Toggle checked={f.robotsFollow} onChange={(v) => update("robotsFollow", v)} label="Allow following links" />
                  <Field label="Canonical URL override" htmlFor="can" error={err("canonicalOverride")} hint={props.perms.canonical ? `Leave empty to use ${url}. Only for syndicated duplicates.` : "Admins only."}>
                    <input id="can" className="input font-mono text-[12.5px]" value={f.canonicalOverride} disabled={!props.perms.canonical} onChange={(e) => update("canonicalOverride", e.target.value)} placeholder={url} />
                  </Field>
                  {f.canonicalOverride ? <p className="text-[12.5px] text-warning">⚠ With a canonical pointing elsewhere this page will normally not appear in search, and it is removed from the sitemap.</p> : null}
                </div>
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="text-[13px] font-semibold">Social</p>
                  <Field label="OG title" htmlFor="ogt">
                    <input id="ogt" className="input" value={f.ogTitle} placeholder={effectiveTitle} onChange={(e) => update("ogTitle", e.target.value)} />
                  </Field>
                  <Field label="OG description" htmlFor="ogd">
                    <textarea id="ogd" className="textarea min-h-[60px]" value={f.ogDescription} placeholder={f.metaDescription || f.excerpt} onChange={(e) => update("ogDescription", e.target.value)} />
                  </Field>
                  <SocialPreview title={f.ogTitle || effectiveTitle} description={f.ogDescription || f.metaDescription || f.excerpt} image={(f.ogImage ?? f.cover)?.fileUrl} domain={new URL(props.siteOrigin).host} />
                </div>
                <div className="space-y-2 border-t border-line pt-3">
                  <Field label="Schema type" htmlFor="st" hint="Only types that truthfully match the page. FAQ/HowTo/Review markup is not offered.">
                    <select id="st" className="select" value={f.type === "NEWS" ? "NEWS_ARTICLE" : f.schemaType} disabled={f.type === "NEWS"} onChange={(e) => update("schemaType", e.target.value as EditorForm["schemaType"])}>
                      <option value="BLOG_POSTING">BlogPosting</option>
                      <option value="ARTICLE">Article</option>
                      {f.type === "NEWS" ? <option value="NEWS_ARTICLE">NewsArticle</option> : null}
                    </select>
                  </Field>
                  <JsonLdPreview data={ld} problems={ldProblems} />
                </div>
                <div className="border-t border-line pt-3">
                  <p className="text-[13px] font-semibold">Link inspector</p>
                  <ul className="mt-1 text-[13px]">
                    <li>Internal links: {links.filter((l) => l.internal).length}</li>
                    <li>External links: {links.filter((l) => !l.internal).length}</li>
                    <li>Sponsored (rel=sponsored): {links.filter((l) => l.sponsored).length}</li>
                    <li>Words: {words}</li>
                  </ul>
                </div>
              </>
            ) : null}

            {tab === "Brief" ? (
              <>
                <p className="text-[13px] text-muted">Internal content brief. Never shown publicly. Record observations, not copied competitor text.</p>
                {(
                  [
                    ["queryIntent", "Query intent — what is the reader trying to do?"],
                    ["unmetNeeds", "Unmet reader needs we can answer"],
                    ["competitorNotes", "Competitor observations (domain, angle, gaps)"],
                    ["experiment", "Original test / experiment to run"],
                    ["difficulty", "Reader difficulty level"],
                  ] as const
                ).map(([k, label]) => (
                  <Field key={k} label={label} htmlFor={`brief-${k}`}>
                    <textarea id={`brief-${k}`} className="textarea min-h-[72px]" value={f.brief[k]} onChange={(e) => update("brief", { ...f.brief, [k]: e.target.value })} />
                  </Field>
                ))}
              </>
            ) : null}
          </fieldset>

          {/* Content checks are advisory, always visible below the tabs */}
          <section className="mt-3 rounded-[10px] border border-line bg-surface p-4" aria-labelledby="checks-h">
            <div className="flex items-center justify-between">
              <h2 id="checks-h" className="text-[14px] font-semibold">
                Content checks
              </h2>
              {articleId ? (
                <button
                  type="button"
                  className="text-[12.5px] text-accent"
                  onClick={async () => {
                    if (dirty) await doSave(false);
                    const r = await runChecksAction(articleId);
                    if (r.ok) setChecks(r.data);
                  }}
                >
                  Re-run
                </button>
              ) : null}
            </div>
            <p className="text-[12px] text-muted">Advisory editorial checks — not a Google ranking score.</p>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              {checks.map((c) => (
                <li key={c.checkType} className={c.severity === "ERROR" ? "text-danger" : c.severity === "WARNING" ? "text-[#8a5717]" : "text-muted"}>
                  <span className="font-mono text-[11px] uppercase">{c.severity.toLowerCase()}</span> {c.message}
                </li>
              ))}
              {!checks.length ? <li className="text-positive">{articleId ? "No issues found on the last run." : "Checks run after the first save."}</li> : null}
            </ul>
          </section>
        </aside>
      </div>

      {/* Bottom sticky action toolbar */}
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:left-[248px]">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 lg:px-8">
          <button type="button" className="btn btn-primary btn-sm" disabled={ro || save.kind === "saving"} onClick={() => void doSave(false)}>
            {articleId ? "Save" : "Save draft"}
          </button>
          {articleId
            ? props.actions
                .filter((a) => a !== "schedule" || schedule.at)
                .map((a) => (
                  <button key={a} type="button" disabled={busy} className={`btn btn-sm ${a === "publish" ? "btn-primary" : a === "archive" || a === "unpublish" ? "btn-ghost text-danger" : "btn-secondary"}`} onClick={() => void runTransition(a)}>
                    {ACTION_LABEL[a]}
                    {a === "schedule" && schedule.at ? ` for ${new Date(schedule.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}` : ""}
                  </button>
                ))
            : null}
          {articleId && props.actions.includes("schedule") && !schedule.at ? <span className="text-[12.5px] text-muted">Pick a date in Publish → Schedule to enable scheduling.</span> : null}
          <span className="ml-auto flex gap-2">
            {articleId ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const r = await previewTokenAction(articleId);
                    if (r.ok) {
                      await navigator.clipboard.writeText(r.data.url).catch(() => undefined);
                      setFlash({ tone: "ok", text: `Preview link copied (expires in 48h): ${r.data.url}` });
                    } else setFlash({ tone: "err", text: r.error });
                  }}
                >
                  Share preview link
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const r = await duplicateArticleAction(articleId);
                    if (r.ok) router.push(`/admin/articles/${r.data.id}/edit`);
                    else setFlash({ tone: "err", text: r.error });
                  }}
                >
                  Duplicate as draft
                </button>
              </>
            ) : null}
          </span>
        </div>
      </div>

      <MediaPicker
        open={picker !== null}
        presigned={props.presignedUploads}
        title={picker === "og" ? "Choose a social share image" : "Choose a cover image"}
        onClose={() => setPicker(null)}
        onSelect={(m) => {
          update(picker === "og" ? "ogImage" : "cover", { id: m.id, fileUrl: m.fileUrl, alt: m.alt, width: m.width, height: m.height });
          setPicker(null);
        }}
      />
    </div>
  );
}
