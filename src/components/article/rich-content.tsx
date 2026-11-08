import type { ReactNode } from "react";
import { Fragment } from "react";
import { createLowlight, all } from "lowlight";
import type { Element, RootContent, Root } from "hast";
import { AlertTriangle, Info, Lightbulb, OctagonAlert, DatabaseBackup } from "lucide-react";
import { headingIds, nodeText } from "@/lib/content/extract";
import { sanitizeDoc, safeHref, safeImageSrc, type JSONContent } from "@/lib/content/schema";
import { CopyButton } from "./copy-button";
import { ZoomableImage } from "./zoomable-image";
import { ConsentEmbed } from "./consent-embed";

const lowlight = createLowlight(all);

const CALLOUT = {
  note: { label: "Note", Icon: Info },
  tip: { label: "Tip", Icon: Lightbulb },
  warning: { label: "Warning", Icon: AlertTriangle },
  danger: { label: "Danger", Icon: OctagonAlert },
  backup: { label: "Back up first", Icon: DatabaseBackup },
} as const;

const KIND_LABEL: Record<string, string> = {
  command: "Command",
  output: "Expected output",
  config: "Config",
  code: "Code",
};

type Ctx = { ids: Map<JSONContent, string>; siteOrigin: string; key: number };

/** Renders lowlight's hast tree, keeping only <span class="hljs-*">. */
function renderHast(nodes: RootContent[], k = "h"): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === "text") return n.value;
    if (n.type === "element") {
      const el = n as Element;
      const cls = (el.properties?.className as string[] | undefined)?.filter((c) => /^hljs-[\w-]+$/.test(c)).join(" ");
      return (
        <span key={`${k}-${i}`} className={cls || undefined}>
          {renderHast(el.children as RootContent[], `${k}-${i}`)}
        </span>
      );
    }
    return null;
  });
}

function highlight(code: string, language: string): ReactNode[] | string {
  if (language === "plaintext" || !lowlight.registered(language === "shell" ? "bash" : language)) return code;
  try {
    const tree: Root = lowlight.highlight(language === "shell" ? "bash" : language, code);
    return renderHast(tree.children as RootContent[]);
  } catch {
    return code;
  }
}

function renderText(node: JSONContent, ctx: Ctx, key: string): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "underline":
        out = <u>{out}</u>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "code":
        out = <code className="inline-code">{out}</code>;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (!href) break;
        const external = /^https?:/.test(href) && !href.startsWith(ctx.siteOrigin);
        const rel = [
          mark.attrs?.sponsored === true ? "sponsored" : null,
          external ? "noopener noreferrer" : null,
        ]
          .filter(Boolean)
          .join(" ");
        out = (
          <a href={href} rel={rel || undefined} data-sponsored={mark.attrs?.sponsored === true ? "true" : undefined}>
            {out}
          </a>
        );
        break;
      }
    }
  }
  return <Fragment key={key}>{out}</Fragment>;
}

function renderChildren(node: JSONContent, ctx: Ctx, prefix: string): ReactNode[] {
  return (node.content ?? []).map((c, i) => renderNode(c, ctx, `${prefix}.${i}`));
}

function renderNode(node: JSONContent, ctx: Ctx, key: string): ReactNode {
  const kids = () => renderChildren(node, ctx, key);
  switch (node.type) {
    case "text":
      return renderText(node, ctx, key);
    case "paragraph":
      return <p key={key}>{kids()}</p>;
    case "hardBreak":
      return <br key={key} />;
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const id = ctx.ids.get(node);
      const Tag = (level === 3 ? "h3" : level === 4 ? "h4" : "h2") as "h2" | "h3" | "h4";
      return (
        <Tag key={key} id={id} className="anchored">
          {kids()}
          {id ? (
            <a href={`#${id}`} className="heading-anchor" aria-label={`Link to section: ${nodeText(node)}`}>
              #
            </a>
          ) : null}
        </Tag>
      );
    }
    case "bulletList":
      return <ul key={key}>{kids()}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined}>
          {kids()}
        </ol>
      );
    case "listItem":
      return <li key={key}>{kids()}</li>;
    case "blockquote":
      return <blockquote key={key}>{kids()}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "codeBlock": {
      const code = nodeText(node);
      const language = String(node.attrs?.language ?? "plaintext");
      const kind = String(node.attrs?.kind ?? "code");
      const filename = typeof node.attrs?.filename === "string" ? node.attrs.filename : null;
      return (
        <figure key={key} className={`code-block code-${kind}`}>
          <figcaption className="code-head">
            <span className="code-label">{filename ?? KIND_LABEL[kind] ?? "Code"}</span>
            <span className="code-lang">{language}</span>
            {kind !== "output" ? <CopyButton text={code} /> : null}
          </figcaption>
          <pre tabIndex={0} aria-label={`${KIND_LABEL[kind] ?? "Code"} (${language})`}>
            <code className={`hljs language-${language}`}>{highlight(code, language)}</code>
          </pre>
        </figure>
      );
    }
    case "table":
      return (
        <div key={key} className="table-wrap" role="region" aria-label="Table" tabIndex={0}>
          <table>
            <tbody>{kids()}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{kids()}</tr>;
    case "tableHeader":
      return (
        <th key={key} scope="col" colSpan={(node.attrs?.colspan as number) || undefined}>
          {kids()}
        </th>
      );
    case "tableCell":
      return (
        <td key={key} colSpan={(node.attrs?.colspan as number) || undefined}>
          {kids()}
        </td>
      );
    case "image": {
      const src = safeImageSrc(node.attrs?.src);
      if (!src) return null;
      const width = Number(node.attrs?.width) || 1200;
      const height = Number(node.attrs?.height) || 675;
      const caption = node.attrs?.caption as string | undefined;
      const credit = node.attrs?.credit as string | undefined;
      return (
        <figure key={key} className="article-figure">
          <ZoomableImage src={src} alt={String(node.attrs?.alt ?? "")} width={width} height={height} />
          {caption || credit ? (
            <figcaption>
              {caption}
              {credit ? <span className="credit"> {caption ? "· " : ""}Credit: {credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "callout": {
      const variant = (node.attrs?.variant as keyof typeof CALLOUT) ?? "note";
      const meta = CALLOUT[variant] ?? CALLOUT.note;
      const title = (node.attrs?.title as string | undefined) ?? meta.label;
      return (
        <aside key={key} className={`callout callout-${variant}`} aria-label={title}>
          <div className="callout-title">
            <meta.Icon aria-hidden="true" size={18} strokeWidth={2} />
            <span>{title}</span>
          </div>
          <div className="callout-body">{kids()}</div>
        </aside>
      );
    }
    case "steps":
      return (
        <ol key={key} className="steps">
          {kids()}
        </ol>
      );
    case "step": {
      const title = node.attrs?.title as string | undefined;
      return (
        <li key={key} className="step">
          {title ? <p className="step-title">{title}</p> : null}
          <div className="step-body">{kids()}</div>
        </li>
      );
    }
    case "embed":
      return node.attrs?.videoId ? (
        <ConsentEmbed key={key} videoId={String(node.attrs.videoId)} title={String(node.attrs.title ?? "Embedded video")} />
      ) : null;
    case "citation": {
      const n = Number(node.attrs?.n);
      return n ? (
        <sup key={key} className="citation">
          <a href={`#ref-${n}`} aria-label={`Reference ${n}`}>
            [{n}]
          </a>
        </sup>
      ) : null;
    }
    default:
      return null;
  }
}

/**
 * Server-rendered article body. `slots` lets the page insert reserved blocks
 * (quick-fix summary, ad placements) after a given top-level block index.
 */
export function RichContent({
  doc,
  siteOrigin,
  slots,
}: {
  doc: unknown;
  siteOrigin: string;
  slots?: Record<number, ReactNode>;
}) {
  const clean = sanitizeDoc(doc);
  const ctx: Ctx = { ids: headingIds(clean), siteOrigin, key: 0 };
  const blocks = clean.content ?? [];
  return (
    <div className="prose-article">
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {renderNode(b, ctx, String(i))}
          {slots?.[i] ?? null}
        </Fragment>
      ))}
    </div>
  );
}
