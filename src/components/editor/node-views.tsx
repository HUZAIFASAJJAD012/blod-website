"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { CALLOUT_VARIANTS, CODE_KINDS, CODE_LANGUAGES } from "@/lib/content/schema";

const ctl = "rounded border border-line-strong bg-white px-1.5 py-0.5 text-[12px] font-sans text-ink";

export function CalloutView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const variant = (node.attrs.variant as string) ?? "note";
  return (
    <NodeViewWrapper as="aside" className={`callout callout-${variant} my-4`} data-callout="">
      <div className="callout-title mb-2 flex flex-wrap items-center gap-2" contentEditable={false}>
        <select aria-label="Callout type" className={ctl} value={variant} disabled={!editor.isEditable} onChange={(e) => updateAttributes({ variant: e.target.value })}>
          {CALLOUT_VARIANTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <input aria-label="Callout title (optional)" className={`${ctl} min-w-[180px] flex-1`} placeholder="Title (optional, e.g. Quick fix)" value={(node.attrs.title as string) ?? ""} onChange={(e) => updateAttributes({ title: e.target.value || null })} />
      </div>
      <NodeViewContent className="callout-body" />
    </NodeViewWrapper>
  );
}

export function StepView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="li" className="step" data-step="">
      <input
        contentEditable={false}
        aria-label="Step title"
        className="step-title mb-1 w-full border-0 border-b border-dashed border-line bg-transparent px-0 py-0.5 font-semibold focus:border-accent focus:outline-none"
        placeholder="Step title (optional)"
        value={(node.attrs.title as string) ?? ""}
        onChange={(e) => updateAttributes({ title: e.target.value || null })}
      />
      <NodeViewContent className="step-body" />
    </NodeViewWrapper>
  );
}

export function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const kind = (node.attrs.kind as string) ?? "code";
  return (
    <NodeViewWrapper className={`code-block code-${kind} my-4`}>
      <div className="code-head" contentEditable={false}>
        <select aria-label="Block kind" className="rounded bg-[#18212b] px-1 py-0.5 text-[12px] text-[#dbe3ec]" value={kind} onChange={(e) => updateAttributes({ kind: e.target.value })}>
          {CODE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          aria-label="Filename (optional)"
          placeholder="filename (optional)"
          className="min-w-0 flex-1 rounded bg-[#18212b] px-1.5 py-0.5 text-[12px] text-[#dbe3ec] placeholder:text-[#6b7888]"
          value={(node.attrs.filename as string) ?? ""}
          onChange={(e) => updateAttributes({ filename: e.target.value || null })}
        />
        <select aria-label="Language" className="rounded bg-[#18212b] px-1 py-0.5 text-[12px] text-[#dbe3ec]" value={(node.attrs.language as string) ?? "plaintext"} onChange={(e) => updateAttributes({ language: e.target.value })}>
          {CODE_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <pre className="!m-0">
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export function ImageView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const a = node.attrs as { src: string; alt?: string; caption?: string; credit?: string };
  const missingAlt = !a.alt?.trim();
  return (
    <NodeViewWrapper as="figure" className={`article-figure my-4 rounded-[8px] ${selected ? "ring-2 ring-accent ring-offset-2" : ""}`} data-drag-handle="">
      {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of our own media */}
      <img src={a.src} alt={a.alt ?? ""} className="w-full" />
      <div className="mt-2 grid gap-1.5 sm:grid-cols-3" contentEditable={false}>
        <input aria-label="Alt text" className={`${ctl} ${missingAlt ? "border-warning" : ""}`} placeholder="Alt text (describe what it shows)" value={a.alt ?? ""} onChange={(e) => updateAttributes({ alt: e.target.value })} />
        <input aria-label="Caption" className={ctl} placeholder="Caption" value={a.caption ?? ""} onChange={(e) => updateAttributes({ caption: e.target.value || null })} />
        <input aria-label="Credit" className={ctl} placeholder="Credit / source" value={a.credit ?? ""} onChange={(e) => updateAttributes({ credit: e.target.value || null })} />
      </div>
      {missingAlt ? <p className="mt-1 text-[12px] text-warning">Add alt text unless the image is purely decorative.</p> : null}
    </NodeViewWrapper>
  );
}

export function EmbedView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="my-4 rounded-[8px] border border-dashed border-line-strong bg-[#FAFAF8] p-3" contentEditable={false}>
      <p className="mono-label mb-2 text-muted">YouTube embed · click-to-load on the public site</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Video ID" className={ctl} value={(node.attrs.videoId as string) ?? ""} onChange={(e) => updateAttributes({ videoId: e.target.value.trim() })} />
        <input aria-label="Video title" className={ctl} placeholder="Descriptive title" value={(node.attrs.title as string) ?? ""} onChange={(e) => updateAttributes({ title: e.target.value })} />
      </div>
    </NodeViewWrapper>
  );
}
