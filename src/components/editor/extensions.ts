"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkBase from "@tiptap/extension-link";
import ImageBase from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import { createLowlight, common } from "lowlight";
import { CalloutView, CodeBlockView, EmbedView, ImageView, StepView } from "./node-views";
import { safeHref } from "@/lib/content/schema";

const lowlight = createLowlight(common);

const attr = (name: string, def: unknown = null) => ({
  default: def,
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? def,
  renderHTML: (attrs: Record<string, unknown>) => (attrs[name] ? { [`data-${name}`]: attrs[name] } : {}),
});

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes: () => ({ variant: attr("variant", "note"), title: attr("title") }),
  parseHTML: () => [{ tag: "aside[data-callout]" }],
  renderHTML: ({ HTMLAttributes }) => ["aside", mergeAttributes({ "data-callout": "" }, HTMLAttributes), 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
});

export const Steps = Node.create({
  name: "steps",
  group: "block",
  content: "step+",
  parseHTML: () => [{ tag: "ol[data-steps]" }],
  renderHTML: ({ HTMLAttributes }) => ["ol", mergeAttributes({ "data-steps": "", class: "steps" }, HTMLAttributes), 0],
});

export const Step = Node.create({
  name: "step",
  content: "block+",
  defining: true,
  addAttributes: () => ({ title: attr("title") }),
  parseHTML: () => [{ tag: "li[data-step]" }],
  renderHTML: ({ HTMLAttributes }) => ["li", mergeAttributes({ "data-step": "" }, HTMLAttributes), 0],
  addNodeView: () => ReactNodeViewRenderer(StepView),
  addKeyboardShortcuts() {
    return {
      // Mod-Enter inside a step adds the next step.
      "Mod-Enter": () => {
        const { $from } = this.editor.state.selection;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "step") {
            const pos = $from.after(d);
            return this.editor.chain().insertContentAt(pos, { type: "step", content: [{ type: "paragraph" }] }).focus(pos + 2).run();
          }
        }
        return false;
      },
    };
  },
});

export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  addAttributes: () => ({ provider: attr("provider", "youtube"), videoId: attr("video-id"), title: attr("title") }),
  parseHTML: () => [{ tag: "div[data-embed]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes({ "data-embed": "" }, HTMLAttributes)],
  addNodeView: () => ReactNodeViewRenderer(EmbedView),
});

export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ n: { default: 1, parseHTML: (el) => Number(el.getAttribute("data-n") ?? 1), renderHTML: (a) => ({ "data-n": a.n }) } }),
  parseHTML: () => [{ tag: "sup[data-citation]" }],
  renderHTML: ({ node, HTMLAttributes }) => ["sup", mergeAttributes({ "data-citation": "", class: "citation text-accent" }, HTMLAttributes), `[${node.attrs.n}]`],
});

const CodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      filename: attr("filename"),
      kind: attr("kind", "code"),
    };
  },
  addNodeView: () => ReactNodeViewRenderer(CodeBlockView),
}).configure({ lowlight, defaultLanguage: "plaintext", languageClassPrefix: "language-" });

const Image = ImageBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: attr("caption"),
      credit: attr("credit"),
      mediaId: attr("media-id"),
      width: attr("width"),
      height: attr("height"),
    };
  },
  addNodeView: () => ReactNodeViewRenderer(ImageView),
}).configure({ inline: false, allowBase64: false });

const Link = LinkBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      sponsored: {
        default: false,
        parseHTML: (el: HTMLElement) => (el.getAttribute("rel") ?? "").includes("sponsored"),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.sponsored ? { rel: "sponsored noopener noreferrer", "data-sponsored": "true" } : {}),
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  defaultProtocol: "https",
  HTMLAttributes: { rel: null, target: null },
  isAllowedUri: (url) => Boolean(safeHref(url)),
});

export function buildExtensions() {
  return [
    StarterKit.configure({ codeBlock: false, link: false, heading: { levels: [2, 3, 4] } }),
    Link,
    CodeBlock,
    Image,
    Table.configure({ resizable: false, HTMLAttributes: { class: "editor-table" } }),
    TableRow,
    TableHeader,
    TableCell,
    Callout,
    Steps,
    Step,
    Embed,
    Citation,
    CharacterCount,
    Placeholder.configure({ placeholder: "Start with a short introduction: who this is for and what symptom it fixes…" }),
  ];
}
