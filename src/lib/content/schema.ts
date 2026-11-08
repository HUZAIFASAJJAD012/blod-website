/**
 * Allowlisted structured-content model shared by the editor, the sanitizer and
 * the server renderer. Anything not declared here is dropped on save AND ignored
 * on render, so a crafted payload can never inject markup.
 */

export type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export const CODE_LANGUAGES = [
  "plaintext",
  "bash",
  "shell",
  "php",
  "javascript",
  "typescript",
  "json",
  "yaml",
  "nginx",
  "apache",
  "sql",
  "ini",
  "xml",
  "css",
  "dns",
  "http",
  "diff",
  "python",
] as const;

export const CODE_KINDS = ["code", "command", "output", "config"] as const;
export const CALLOUT_VARIANTS = ["note", "tip", "warning", "danger", "backup"] as const;

type AttrSpec = Record<string, (v: unknown) => unknown>;

const str = (max: number) => (v: unknown) => (typeof v === "string" ? v.slice(0, max) : undefined);
const int = (min: number, max: number) => (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
};
const oneOf =
  <T extends readonly string[]>(values: T, fallback: T[number]) =>
  (v: unknown) =>
    typeof v === "string" && (values as readonly string[]).includes(v) ? v : fallback;
const bool = (v: unknown) => v === true;

/** Only http(s), mailto, in-page anchors and root-relative paths. */
export function safeHref(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const href = v.trim().slice(0, 2048);
  if (href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//"))) return href;
  try {
    const u = new URL(href);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:") return u.toString();
  } catch {
    /* fallthrough */
  }
  return undefined;
}

/** Images must come from our own media store (relative /uploads or configured host). */
export function safeImageSrc(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (v.startsWith("/uploads/") && !v.includes("..")) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "https:") return u.toString();
  } catch {
    /* ignore */
  }
  return undefined;
}

const NODE_ATTRS: Record<string, AttrSpec> = {
  doc: {},
  paragraph: { textAlign: () => undefined },
  text: {},
  heading: { level: int(2, 4) },
  bulletList: {},
  orderedList: { start: int(1, 1000) },
  listItem: {},
  blockquote: {},
  horizontalRule: {},
  hardBreak: {},
  codeBlock: {
    language: oneOf(CODE_LANGUAGES, "plaintext"),
    filename: str(120),
    kind: oneOf(CODE_KINDS, "code"),
  },
  table: {},
  tableRow: {},
  tableHeader: { colspan: int(1, 20), rowspan: int(1, 50) },
  tableCell: { colspan: int(1, 20), rowspan: int(1, 50) },
  image: {
    src: safeImageSrc,
    alt: str(300),
    title: str(200),
    caption: str(400),
    credit: str(200),
    mediaId: str(40),
    width: int(1, 10000),
    height: int(1, 10000),
  },
  callout: { variant: oneOf(CALLOUT_VARIANTS, "note"), title: str(120) },
  steps: {},
  step: { title: str(200) },
  embed: {
    provider: oneOf(["youtube"] as const, "youtube"),
    videoId: (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{6,20}$/.test(v) ? v : undefined),
    title: str(200),
  },
  citation: { n: int(1, 200) },
};

const MARK_ATTRS: Record<string, AttrSpec> = {
  bold: {},
  italic: {},
  strike: {},
  underline: {},
  code: {},
  link: { href: safeHref, rel: str(80), sponsored: bool, target: () => undefined },
};

const MAX_NODES = 20_000;
const MAX_DEPTH = 24;

function cleanAttrs(spec: AttrSpec, attrs: Record<string, unknown> | undefined) {
  const out: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(spec)) {
    const v = fn(attrs?.[key]);
    if (v !== undefined && v !== null && v !== "") out[key] = v;
  }
  return out;
}

/** Rebuilds the document keeping only allowlisted nodes, marks and attributes. */
export function sanitizeDoc(input: unknown): JSONContent {
  let count = 0;
  const walk = (node: unknown, depth: number): JSONContent | null => {
    if (!node || typeof node !== "object" || depth > MAX_DEPTH || ++count > MAX_NODES) return null;
    const n = node as JSONContent;
    const type = typeof n.type === "string" ? n.type : "";
    const spec = NODE_ATTRS[type];
    if (!spec) return null;
    if (type === "text") {
      const text = typeof n.text === "string" ? n.text.slice(0, 100_000) : "";
      if (!text) return null;
      const marks = (Array.isArray(n.marks) ? n.marks : [])
        .filter((m) => m && typeof m.type === "string" && MARK_ATTRS[m.type])
        .map((m) => {
          const attrs = cleanAttrs(MARK_ATTRS[m.type]!, m.attrs);
          return Object.keys(attrs).length ? { type: m.type, attrs } : { type: m.type };
        })
        .filter((m) => m.type !== "link" || (m as { attrs?: { href?: string } }).attrs?.href);
      return marks.length ? { type, text, marks } : { type, text };
    }
    const attrs = cleanAttrs(spec, n.attrs);
    if (type === "image" && !attrs.src) return null;
    if (type === "embed" && !attrs.videoId) return null;
    const out: JSONContent = { type };
    if (Object.keys(attrs).length) out.attrs = attrs;
    if (Array.isArray(n.content)) {
      const children = n.content.map((c) => walk(c, depth + 1)).filter(Boolean) as JSONContent[];
      if (children.length) out.content = children;
    }
    return out;
  };
  const root = walk(input, 0);
  if (!root || root.type !== "doc") return { type: "doc", content: [] };
  return root;
}

export const EMPTY_DOC: JSONContent = { type: "doc", content: [] };
