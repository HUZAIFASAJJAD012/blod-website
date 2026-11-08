import { describe, expect, it } from "vitest";
import { can, canEditArticle, canGrantRole } from "@/lib/permissions";
import { availableActions, canTransition } from "@/server/articles/workflow";
import { slugify, isValidSlug } from "@/lib/utils/slug";
import { normalizePath } from "@/server/redirects";
import { validateCanonicalOverride } from "@/lib/seo/urls";
import { chooseAdPositions } from "@/components/article/article-view";
import { parsePage } from "@/components/site/pagination";

const author = { id: "a", role: "AUTHOR" as const };
const editor = { id: "e", role: "EDITOR" as const };
const admin = { id: "ad", role: "ADMIN" as const };
const owner = { id: "o", role: "OWNER" as const };

describe("RBAC", () => {
  it("authors edit only their own drafts", () => {
    expect(canEditArticle(author, { authorId: "a", status: "DRAFT" })).toBe(true);
    expect(canEditArticle(author, { authorId: "a", status: "PUBLISHED" })).toBe(false);
    expect(canEditArticle(author, { authorId: "someone-else", status: "DRAFT" })).toBe(false);
    expect(canEditArticle(editor, { authorId: "someone-else", status: "PUBLISHED" })).toBe(true);
  });
  it("only admins+ configure ads and settings; only owners mint admins", () => {
    expect(can(editor, "monetization.manage")).toBe(false);
    expect(can(admin, "monetization.manage")).toBe(true);
    expect(canGrantRole(admin, "ADMIN")).toBe(false);
    expect(canGrantRole(admin, "EDITOR")).toBe(true);
    expect(canGrantRole(owner, "OWNER")).toBe(true);
  });
});

describe("editorial workflow", () => {
  it("authors can submit but not publish", () => {
    const a = { authorId: "a", status: "DRAFT" as const };
    expect(canTransition(author, a, "submit").ok).toBe(true);
    expect(canTransition(author, a, "publish").ok).toBe(false);
    expect(availableActions(author, a)).toEqual(["submit"]);
  });
  it("editors approve, publish, schedule; cannot submit a published article", () => {
    const r = { authorId: "a", status: "IN_REVIEW" as const };
    expect(availableActions(editor, r)).toEqual(expect.arrayContaining(["approve", "requestChanges", "publish", "schedule", "archive"]));
    expect(canTransition(editor, { authorId: "a", status: "PUBLISHED" }, "submit").ok).toBe(false);
    expect(canTransition(editor, { authorId: "a", status: "PUBLISHED" }, "unpublish").ok).toBe(true);
    expect(canTransition(editor, { authorId: "a", status: "ARCHIVED" }, "restoreDraft").ok).toBe(true);
  });
});

describe("slugs & paths", () => {
  it("slugifies to kebab-case ASCII", () => {
    expect(slugify("How to Fix a WordPress 500 Internal Server Error (Step-by-Step)")).toBe("how-to-fix-a-wordpress-500-internal-server-error-step-by-step");
    expect(slugify("Café & Crème — déjà vu")).toBe("cafe-and-creme-deja-vu");
    expect(isValidSlug("ok-slug-2")).toBe(true);
    expect(isValidSlug("Bad_Slug")).toBe(false);
    expect(isValidSlug("double--dash")).toBe(false);
  });
  it("normalises redirect paths", () => {
    expect(normalizePath("/Guides/Old-Slug/?x=1#y")).toBe("/guides/old-slug");
    expect(normalizePath("guides//a")).toBe("/guides/a");
    expect(normalizePath("/")).toBe("/");
  });
  it("validates canonical overrides", () => {
    expect(validateCanonicalOverride("http://other.example/x").ok).toBe(false);
    expect(validateCanonicalOverride("https://other.example/x#frag").ok).toBe(false);
    const r = validateCanonicalOverride("https://other.example/x");
    expect(r.ok && r.sameOrigin).toBe(false);
  });
  it("rejects junk pagination params", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBeNull();
    expect(parsePage("abc")).toBeNull();
    expect(parsePage(["1", "2"])).toBeNull();
  });
});

describe("ad placement selection", () => {
  const p = (t = "x") => ({ type: "paragraph", content: [{ type: "text", text: t }] });
  const code = { type: "codeBlock", content: [{ type: "text", text: "ls" }] };
  it("never places ads in short articles or next to code blocks", () => {
    expect(chooseAdPositions({ type: "doc", content: [p(), p(), p(), p()] }, 2, 300, 700)).toEqual([]);
    const doc = { type: "doc", content: [p(), p(), p(), code, p(), p(), p()] };
    const picks = chooseAdPositions(doc, 1, 1000, 700);
    for (const i of picks) {
      expect(doc.content[i]!.type).toBe("paragraph");
      expect(doc.content[i + 1]!.type).not.toBe("codeBlock");
    }
  });
  it("respects the slot cap", () => {
    const doc = { type: "doc", content: Array.from({ length: 40 }, () => p()) };
    expect(chooseAdPositions(doc, 2, 5000, 700).length).toBeLessThanOrEqual(2);
    expect(chooseAdPositions(doc, 0, 5000, 700)).toEqual([]);
  });
});
