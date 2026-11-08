import type { JSONContent } from "./schema";
import { slugify } from "@/lib/utils/slug";

export type TocItem = { id: string; text: string; level: 2 | 3 };

export function nodeText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  return (node.content ?? []).map(nodeText).join("");
}

/** Plain text used for search indexing, word count and content checks. */
export function docToPlainText(doc: JSONContent): string {
  const parts: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "text") {
      parts.push(n.text ?? "");
      return;
    }
    if (n.type === "image") {
      if (typeof n.attrs?.alt === "string") parts.push(` ${n.attrs.alt} `);
      return;
    }
    (n.content ?? []).forEach(walk);
    if (n.type && n.type !== "doc" && n.type !== "listItem") parts.push("\n");
  };
  walk(doc);
  return parts.join("").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function wordCount(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

/** ~220 wpm for technical reading; code is read slower so it is counted at face value. */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 220));
}

/**
 * Deterministic heading ids shared by the TOC and the renderer.
 * Duplicate headings get -2, -3 suffixes.
 */
export function headingIds(doc: JSONContent): Map<JSONContent, string> {
  const ids = new Map<JSONContent, string>();
  const seen = new Map<string, number>();
  const walk = (n: JSONContent) => {
    if (n.type === "heading") {
      const base = slugify(nodeText(n)) || "section";
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      ids.set(n, count === 1 ? base : `${base}-${count}`);
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return ids;
}

export function extractToc(doc: JSONContent): TocItem[] {
  const ids = headingIds(doc);
  const items: TocItem[] = [];
  for (const [node, id] of ids) {
    const level = Number(node.attrs?.level ?? 2);
    if (level === 2 || level === 3) items.push({ id, text: nodeText(node), level });
  }
  return items;
}

export type ExtractedLink = { href: string; text: string; sponsored: boolean; internal: boolean };

export function extractLinks(doc: JSONContent, siteOrigin: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const origin = siteOrigin.replace(/\/+$/, "");
  const walk = (n: JSONContent) => {
    if (n.type === "text" && n.marks) {
      for (const m of n.marks) {
        if (m.type === "link" && typeof m.attrs?.href === "string") {
          const href = m.attrs.href;
          const internal = href.startsWith("/") || href.startsWith("#") || href.startsWith(origin);
          links.push({ href, text: n.text ?? "", sponsored: m.attrs.sponsored === true, internal });
        }
      }
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return links;
}

export type ExtractedImage = { src: string; alt: string; mediaId?: string };

export function extractImages(doc: JSONContent): ExtractedImage[] {
  const out: ExtractedImage[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "image" && typeof n.attrs?.src === "string") {
      out.push({
        src: n.attrs.src,
        alt: typeof n.attrs.alt === "string" ? n.attrs.alt : "",
        mediaId: typeof n.attrs.mediaId === "string" ? n.attrs.mediaId : undefined,
      });
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

/** Heading sequence for structure checks, e.g. [2,3,3,2,4]. */
export function headingLevels(doc: JSONContent): number[] {
  const levels: number[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "heading") levels.push(Number(n.attrs?.level ?? 2));
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return levels;
}

/** Top-level block count — used to decide where in-article ad slots may go. */
export function topLevelBlocks(doc: JSONContent): JSONContent[] {
  return doc.content ?? [];
}
