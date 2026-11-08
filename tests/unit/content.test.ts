import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { sanitizeDoc, safeHref, safeImageSrc } from "@/lib/content/schema";
import { docToPlainText, extractLinks, extractToc, readingMinutes, wordCount } from "@/lib/content/extract";
import { RichContent } from "@/components/article/rich-content";

const XSS_DOC = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    { type: "paragraph", content: [{ type: "text", text: "data", marks: [{ type: "link", attrs: { href: "data:text/html;base64,PHNjcmlwdD4=" } }] }] },
    { type: "rawHtml", attrs: { html: "<img src=x onerror=alert(1)>" } },
    { type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } },
    { type: "image", attrs: { src: "/uploads/2026/01/ok.png", alt: '"><svg onload=alert(1)>', onerror: "alert(1)" } },
    { type: "heading", attrs: { level: 1, onclick: "x" }, content: [{ type: "text", text: "Title" }] },
    { type: "codeBlock", attrs: { language: "</code><script>", kind: "evil" }, content: [{ type: "text", text: "</code><script>alert(1)</script>" }] },
    { type: "embed", attrs: { videoId: "abc\"onload=1" } },
  ],
};

describe("sanitizeDoc", () => {
  it("drops unknown nodes, unsafe links and unsafe image sources", () => {
    const clean = sanitizeDoc(XSS_DOC);
    const json = JSON.stringify(clean);
    expect(json).not.toContain("javascript:");
    expect(json).not.toContain("data:text/html");
    expect(json).not.toContain("rawHtml");
    expect(json).not.toContain("onerror");
    expect(json).not.toContain("onclick");
    expect(clean.content!.filter((n) => n.type === "image")).toHaveLength(1);
    expect(clean.content!.find((n) => n.type === "embed")).toBeUndefined();
  });

  it("clamps heading levels to 2–4 and code languages to the allowlist", () => {
    const clean = sanitizeDoc(XSS_DOC);
    const h = clean.content!.find((n) => n.type === "heading");
    expect(h?.attrs?.level).toBe(2);
    const code = clean.content!.find((n) => n.type === "codeBlock");
    expect(code?.attrs?.language).toBe("plaintext");
    expect(code?.attrs?.kind).toBe("code");
  });

  it("returns an empty doc for garbage input", () => {
    expect(sanitizeDoc(null)).toEqual({ type: "doc", content: [] });
    expect(sanitizeDoc({ type: "paragraph" })).toEqual({ type: "doc", content: [] });
    expect(sanitizeDoc("<p>hi</p>")).toEqual({ type: "doc", content: [] });
  });

  it("bounds depth and node count", () => {
    let deep: Record<string, unknown> = { type: "paragraph", content: [{ type: "text", text: "x" }] };
    for (let i = 0; i < 100; i++) deep = { type: "blockquote", content: [deep] };
    const clean = sanitizeDoc({ type: "doc", content: [deep] });
    expect(JSON.stringify(clean).split("blockquote").length).toBeLessThan(30);
  });
});

describe("server renderer never emits executable markup", () => {
  it("escapes text and strips dangerous attributes", () => {
    const html = renderToStaticMarkup(createElement(RichContent, { doc: XSS_DOC, siteOrigin: "https://fixlayer.test" }));
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/javascript:/i);
    // No element may carry an on* event-handler attribute (text inside quoted values is inert).
    expect(html).not.toMatch(/<[a-z][a-z0-9]*(?:\s+[a-z:-]+(?:="[^"]*")?)*\s+on[a-z]+=/i);
    expect(html).not.toMatch(/<svg[^>]*onload/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("marks sponsored external links with rel=sponsored and noopener", () => {
    const html = renderToStaticMarkup(
      createElement(RichContent, {
        doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "host", marks: [{ type: "link", attrs: { href: "https://example.com/aff", sponsored: true } }] }] }] },
        siteOrigin: "https://fixlayer.test",
      }),
    );
    expect(html).toContain('rel="sponsored noopener noreferrer"');
  });

  it("gives headings stable, de-duplicated ids that match the TOC", () => {
    const doc = { type: "doc", content: ["Check logs", "Check logs", "Fix"].map((t, i) => ({ type: "heading", attrs: { level: i === 2 ? 3 : 2 }, content: [{ type: "text", text: t }] })) };
    expect(extractToc(doc).map((t) => t.id)).toEqual(["check-logs", "check-logs-2", "fix"]);
    const html = renderToStaticMarkup(createElement(RichContent, { doc, siteOrigin: "https://x.test" }));
    expect(html).toContain('id="check-logs-2"');
  });
});

describe("url guards", () => {
  it.each([
    ["https://ok.example/a", true],
    ["/guides/x", true],
    ["#section", true],
    ["mailto:a@b.c", true],
    ["//evil.example", false],
    ["javascript:alert(1)", false],
    ["JaVaScRiPt:alert(1)", false],
    ["vbscript:x", false],
    ["data:text/html,x", false],
  ])("safeHref(%s) → %s", (href, ok) => {
    expect(Boolean(safeHref(href))).toBe(ok);
  });

  it("only allows our uploads or https images", () => {
    expect(safeImageSrc("/uploads/a.png")).toBe("/uploads/a.png");
    expect(safeImageSrc("/uploads/../../etc/passwd")).toBeUndefined();
    expect(safeImageSrc("http://insecure.example/a.png")).toBeUndefined();
    expect(safeImageSrc("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
  });
});

describe("text extraction", () => {
  it("counts words and reading time", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: Array(440).fill("word").join(" ") }] }] };
    expect(wordCount(docToPlainText(doc))).toBe(440);
    expect(readingMinutes(docToPlainText(doc))).toBe(2);
  });

  it("classifies internal and external links", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [
        { type: "text", text: "a", marks: [{ type: "link", attrs: { href: "/guides/x" } }] },
        { type: "text", text: "b", marks: [{ type: "link", attrs: { href: "https://fixlayer.test/guides/y" } }] },
        { type: "text", text: "c", marks: [{ type: "link", attrs: { href: "https://other.example" } }] },
      ] }],
    };
    const links = extractLinks(doc, "https://fixlayer.test");
    expect(links.filter((l) => l.internal)).toHaveLength(2);
    expect(links.filter((l) => !l.internal)).toHaveLength(1);
  });
});
