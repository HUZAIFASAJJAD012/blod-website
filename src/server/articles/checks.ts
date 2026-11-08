import "server-only";
import { db } from "@/lib/db";
import type { CheckSeverity } from "@/generated/prisma/enums";
import { sanitizeDoc, type JSONContent } from "@/lib/content/schema";
import { docToPlainText, extractImages, extractLinks, headingLevels, wordCount } from "@/lib/content/extract";
import { getSiteOrigin, validateCanonicalOverride } from "@/lib/seo/urls";
import { normalizePath } from "@/server/redirects";

export type CheckResult = { checkType: string; severity: CheckSeverity; message: string; detail?: unknown };

/**
 * Advisory editorial/SEO checks. These are NOT a Google ranking score — they
 * flag things a careful editor would catch. Blocking issues for publishing are
 * enforced separately in publishReadiness().
 */
export async function runContentChecks(articleId: string): Promise<CheckResult[]> {
  const a = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { references: true, author: { include: { profile: true } }, coverMedia: true },
  });
  const doc: JSONContent = sanitizeDoc(a.bodyJson);
  const text = docToPlainText(doc);
  const words = wordCount(text);
  const out: CheckResult[] = [];
  const add = (checkType: string, severity: CheckSeverity, message: string, detail?: unknown) => out.push({ checkType, severity, message, detail });

  if (!a.title.trim() || /^untitled/i.test(a.title)) add("empty_title", "ERROR", "The article needs a real title.");
  if (/^\s*\[demo\]/i.test(a.title) || /\[DEMO CONTENT/i.test(text) || /lorem ipsum/i.test(text)) add("placeholder_content", "ERROR", "This looks like demo or placeholder content and can't be published.");
  if (a.title.length > 110) add("long_title", "INFO", "Long titles may be truncated in search results and in the Article headline (110 chars).");
  if (!a.excerpt.trim()) add("missing_excerpt", "WARNING", "Add a 1–3 sentence excerpt; it's shown on cards and used as the fallback meta description.");
  if (!a.metaDescription) add("missing_meta_description", "INFO", "No custom meta description — the excerpt will be used.");

  const [dupTitle, dupMeta] = await Promise.all([
    db.article.findFirst({ where: { id: { not: a.id }, title: { equals: a.title, mode: "insensitive" }, status: { not: "ARCHIVED" } }, select: { title: true, slug: true } }),
    a.metaDescription
      ? db.article.findFirst({ where: { id: { not: a.id }, metaDescription: a.metaDescription, status: { not: "ARCHIVED" } }, select: { slug: true } })
      : Promise.resolve(null),
  ]);
  if (dupTitle) add("duplicate_title", "WARNING", `Another article has the same title (/guides/${dupTitle.slug}).`);
  if (dupMeta) add("duplicate_meta", "WARNING", `Another article uses the same meta description (/guides/${dupMeta.slug}).`);

  if (!a.author.profile?.isPublic || !a.author.profile.bio) add("missing_author_bio", "WARNING", "The author has no public profile/bio. Readers and reviewers should be able to see who wrote this.");

  if (words < 300) add("thin_content", "WARNING", `Only ${words} words. Make sure the guide fully solves the problem before publishing.`);

  const levels = headingLevels(doc);
  if (!levels.length && words > 400) add("no_headings", "WARNING", "Long article with no H2 headings — add sections so readers can scan and the TOC works.");
  for (let i = 1; i < levels.length; i++) {
    if (levels[i]! - levels[i - 1]! > 1) {
      add("heading_skip", "INFO", `Heading level jumps from H${levels[i - 1]} to H${levels[i]}. Keep a logical outline.`);
      break;
    }
  }
  if (levels[0] && levels[0] !== 2) add("first_heading_level", "INFO", "The first section heading should be an H2 (the title is the only H1).");

  const images = extractImages(doc);
  const missingAlt = images.filter((im) => !im.alt.trim());
  if (missingAlt.length) add("missing_alt", "WARNING", `${missingAlt.length} image(s) have no alt text.`, missingAlt.map((m) => m.src));
  if (a.coverMedia && !a.coverMedia.alt.trim()) add("cover_missing_alt", "WARNING", "The cover image has no alt text.");

  const mediaIds = images.map((i) => i.mediaId).filter(Boolean) as string[];
  if (mediaIds.length) {
    const found = await db.media.count({ where: { id: { in: mediaIds } } });
    if (found < new Set(mediaIds).size) add("unavailable_images", "ERROR", "Some images refer to media that has been deleted.");
  }

  if (!a.references.length && (a.type === "TUTORIAL" || a.type === "TROUBLESHOOTING" || a.type === "NEWS")) add("missing_citations", "WARNING", "No references. Link to official documentation for the software involved.");
  if (a.type === "NEWS" && !a.references.some((r) => r.isPrimary)) add("news_needs_primary_source", "ERROR", "News articles need at least one primary source.");

  const v = (a.verification ?? {}) as { stepsVerified?: boolean; claimsSourced?: boolean };
  if (!v.stepsVerified && (a.type === "TUTORIAL" || a.type === "TROUBLESHOOTING")) add("unverified_steps", "WARNING", "Steps aren't marked as verified. Test them before publishing, or say clearly that they are untested.");
  if (!v.claimsSourced) add("unsourced_claims", "INFO", "Factual claims are not marked as sourced.");
  const env = Array.isArray(a.testedEnvironment) ? a.testedEnvironment : [];
  if (a.type === "TUTORIAL" && !env.length) add("missing_tested_environment", "INFO", "Tutorials should list the tested environment (software and versions).");

  // Links
  const origin = getSiteOrigin();
  const links = extractLinks(doc, origin);
  const internalGuideSlugs = links
    .filter((l) => l.internal)
    .map((l) => normalizePath(l.href.replace(origin, "")))
    .filter((p) => p.startsWith("/guides/"))
    .map((p) => p.slice("/guides/".length));
  if (internalGuideSlugs.length) {
    const targets = await db.article.findMany({ where: { slug: { in: internalGuideSlugs } }, select: { slug: true, status: true } });
    const bySlug = new Map(targets.map((t) => [t.slug, t.status]));
    const redirects = await db.redirect.findMany({ where: { fromPath: { in: internalGuideSlugs.map((s) => `/guides/${s}`) } }, select: { fromPath: true } });
    const redirected = new Set(redirects.map((r) => r.fromPath));
    const broken = internalGuideSlugs.filter((s) => !bySlug.has(s) && !redirected.has(`/guides/${s}`));
    const drafts = internalGuideSlugs.filter((s) => bySlug.has(s) && bySlug.get(s) !== "PUBLISHED");
    const viaRedirect = internalGuideSlugs.filter((s) => redirected.has(`/guides/${s}`));
    if (broken.length) add("broken_internal_links", "ERROR", `${broken.length} internal link(s) point to guides that don't exist.`, broken);
    if (drafts.length) add("links_to_unpublished", "WARNING", `${drafts.length} internal link(s) point to unpublished guides.`, drafts);
    if (viaRedirect.length) add("links_via_redirect", "INFO", `${viaRedirect.length} internal link(s) go through a redirect — link to the final URL.`, viaRedirect);
  }
  const external = links.filter((l) => !l.internal);
  if (a.affiliateDisclosureFlag && !external.some((l) => l.sponsored)) add("disclosure_without_affiliate_links", "INFO", "Affiliate disclosure is on, but no links are marked sponsored.");
  if (!a.affiliateDisclosureFlag && external.some((l) => l.sponsored)) add("affiliate_links_without_disclosure", "ERROR", "Sponsored/affiliate links are present but the affiliate disclosure is off.");

  const brokenRefs = a.references.filter((r) => r.lastStatus && r.lastStatus >= 400);
  if (brokenRefs.length) add("broken_references", "WARNING", `${brokenRefs.length} reference link(s) returned an error on the last check.`, brokenRefs.map((r) => r.url));

  if (a.canonicalOverride) {
    const c = validateCanonicalOverride(a.canonicalOverride);
    if (!c.ok) add("canonical_invalid", "ERROR", c.error);
    else if (c.sameOrigin && !c.url.endsWith(`/guides/${a.slug}`)) add("canonical_mismatch", "WARNING", "Canonical points to a different page on this site — this page will likely not be indexed.");
    else if (!c.sameOrigin) add("canonical_cross_domain", "INFO", "Canonical points to another domain (syndicated content). This page will not rank itself.");
  }
  if (!a.robotsIndex && a.status === "PUBLISHED") add("published_noindex", "INFO", "This published article is set to noindex and is excluded from the sitemap.");

  const ads = await db.adPlacement.count({ where: { enabled: true } });
  if (ads > 3) add("too_many_ads", "WARNING", "More than 3 ad placements are enabled site-wide. Keep content the main focus.");

  const bodyBytes = Buffer.byteLength(JSON.stringify(a.bodyJson));
  if (bodyBytes > 400_000) add("oversized_payload", "WARNING", `Body is ${(bodyBytes / 1024).toFixed(0)} KB — consider splitting the guide.`);

  return out;
}

/** Persist the latest check run (replaces previous results for the article). */
export async function saveContentChecks(articleId: string, results: CheckResult[]) {
  await db.$transaction([
    db.contentCheck.deleteMany({ where: { articleId } }),
    db.contentCheck.createMany({
      data: results.map((r) => ({ articleId, checkType: r.checkType, severity: r.severity, resultJson: { message: r.message, detail: (r.detail ?? null) as never } })),
    }),
  ]);
}

/** Hard requirements before an article may go live. */
export async function publishReadiness(articleId: string): Promise<string[]> {
  const a = await db.article.findUniqueOrThrow({ where: { id: articleId }, include: { author: { include: { profile: true } } } });
  const problems: string[] = [];
  if (!a.title.trim() || /^untitled/i.test(a.title)) problems.push("Add a real title.");
  if (!a.excerpt.trim()) problems.push("Add an excerpt.");
  const words = wordCount(docToPlainText(sanitizeDoc(a.bodyJson)));
  if (words < 50) problems.push("The body is empty or nearly empty.");
  if (a.author.status !== "ACTIVE") problems.push("The selected author is not an active user.");
  const results = await runContentChecks(articleId);
  for (const r of results) if (r.severity === "ERROR" && r.checkType !== "empty_title") problems.push(r.message);
  return problems;
}
