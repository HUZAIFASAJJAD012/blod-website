"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code,
  CodeSquare,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  MessageSquareWarning,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Undo2,
  Video,
  Superscript,
  Zap,
} from "lucide-react";
import { buildExtensions } from "./extensions";
import { MediaPicker } from "./media-picker";
import type { JSONContent } from "@/lib/content/schema";

type Props = {
  initial: JSONContent;
  onChange: (doc: JSONContent) => void;
  presignedUploads: boolean;
  onEditorReady?: (e: Editor) => void;
};

function Btn({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-[13px] transition-colors disabled:opacity-40 ${active ? "bg-ink text-white" : "text-ink hover:bg-black/5"}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;

export function RichEditor({ initial, onChange, presignedUploads, onEditorReady }: Props) {
  const [picker, setPicker] = useState(false);
  const linkDialog = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState({ href: "", sponsored: false });

  const editor = useEditor({
    extensions: buildExtensions(),
    content: initial?.type === "doc" ? initial : { type: "doc", content: [] },
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: "prose-article editor-surface min-h-[520px] px-5 py-6 focus:outline-none md:px-8", "aria-label": "Article body", role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as JSONContent),
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  if (!editor) return <div className="min-h-[560px] rounded-[10px] border border-line bg-surface" aria-busy="true" />;

  // Re-rendered on every transaction (shouldRerenderOnTransaction), so toolbar state is always current.
  const s = {
    h2: editor.isActive("heading", { level: 2 }),
    h3: editor.isActive("heading", { level: 3 }),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    link: editor.isActive("link"),
    bullet: editor.isActive("bulletList"),
    ordered: editor.isActive("orderedList"),
    quote: editor.isActive("blockquote"),
    codeBlock: editor.isActive("codeBlock"),
    inTable: editor.isActive("table"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    words: (editor.storage as { characterCount?: { words?: () => number } }).characterCount?.words?.() ?? 0,
  };


  const c = () => editor.chain().focus();

  function openLink() {
    const attrs = editor!.getAttributes("link") as { href?: string; sponsored?: boolean };
    setLink({ href: attrs.href ?? "", sponsored: Boolean(attrs.sponsored) });
    linkDialog.current?.showModal();
  }
  function applyLink() {
    if (!link.href.trim()) c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: link.href.trim() }).updateAttributes("link", { sponsored: link.sponsored }).run();
    linkDialog.current?.close();
  }

  return (
    <div className="rounded-[10px] border border-line bg-surface">
      <div role="toolbar" aria-label="Formatting" className="sticky top-[72px] z-20 flex flex-wrap items-center gap-0.5 rounded-t-[10px] border-b border-line bg-surface/95 px-2 py-1.5 backdrop-blur">
        <Btn label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </Btn>
        <Btn label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </Btn>
        <Sep />
        <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
          <Bold size={16} />
        </Btn>
        <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
          <Italic size={16} />
        </Btn>
        <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
          <Strikethrough size={16} />
        </Btn>
        <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}>
          <Code size={16} />
        </Btn>
        <Btn label="Link" active={s.link} onClick={openLink}>
          <Link2 size={16} />
        </Btn>
        <Sep />
        <Btn label="Bullet list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
          <List size={16} />
        </Btn>
        <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </Btn>
        <Btn label="Numbered steps (Mod+Enter adds a step)" onClick={() => c().insertContent({ type: "steps", content: [{ type: "step", content: [{ type: "paragraph" }] }] }).run()}>
          <ListChecks size={16} />
        </Btn>
        <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
          <Quote size={16} />
        </Btn>
        <Sep />
        <Btn label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}>
          <CodeSquare size={16} />
        </Btn>
        <Btn label="Callout / warning box" onClick={() => c().insertContent({ type: "callout", attrs: { variant: "warning" }, content: [{ type: "paragraph" }] }).run()}>
          <MessageSquareWarning size={16} />
        </Btn>
        <Btn
          label="Quick fix summary"
          onClick={() => c().insertContent({ type: "callout", attrs: { variant: "tip", title: "Quick fix" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Summarise the most likely fix in one or two sentences." }] }] }).run()}
        >
          <Zap size={16} />
        </Btn>
        <Btn
          label="Reusable 'back up first' box"
          onClick={() =>
            c()
              .insertContent({ type: "callout", attrs: { variant: "backup" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Take a full backup of files and database before you change anything, and confirm you can restore it." }] }] })
              .run()
          }
        >
          <span className="font-mono text-[11px]">BAK</span>
        </Btn>
        <Btn label="Image" onClick={() => setPicker(true)}>
          <ImageIcon size={16} />
        </Btn>
        <Btn label="Table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon size={16} />
        </Btn>
        <Btn
          label="YouTube video (click-to-load)"
          onClick={() => {
            const raw = window.prompt("YouTube URL or video ID");
            const id = raw?.match(/(?:v=|youtu\.be\/|embed\/)?([A-Za-z0-9_-]{11})/)?.[1];
            if (id) c().insertContent({ type: "embed", attrs: { provider: "youtube", videoId: id, title: "" } }).run();
          }}
        >
          <Video size={16} />
        </Btn>
        <Btn
          label="Citation marker (links to reference N)"
          onClick={() => {
            const n = Number(window.prompt("Reference number (as listed in the Evidence panel)", "1"));
            if (n > 0) c().insertContent({ type: "citation", attrs: { n } }).run();
          }}
        >
          <Superscript size={16} />
        </Btn>
        <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}>
          <Minus size={16} />
        </Btn>
        <Sep />
        <Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>
          <Undo2 size={16} />
        </Btn>
        <Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>
          <Redo2 size={16} />
        </Btn>
        {s.inTable ? (
          <span className="ml-1 flex flex-wrap items-center gap-1 border-l border-line pl-2 text-[12px]">
            <button type="button" className="rounded px-1.5 py-1 hover:bg-black/5" onClick={() => c().addRowAfter().run()}>+ row</button>
            <button type="button" className="rounded px-1.5 py-1 hover:bg-black/5" onClick={() => c().addColumnAfter().run()}>+ col</button>
            <button type="button" className="rounded px-1.5 py-1 hover:bg-black/5" onClick={() => c().deleteRow().run()}>− row</button>
            <button type="button" className="rounded px-1.5 py-1 hover:bg-black/5" onClick={() => c().deleteColumn().run()}>− col</button>
            <button type="button" className="rounded px-1.5 py-1 text-danger hover:bg-black/5" onClick={() => c().deleteTable().run()}>delete table</button>
          </span>
        ) : null}
        <span className="mono-label ml-auto pr-1 text-muted" aria-live="polite">
          {s.words} words
        </span>
      </div>

      <EditorContent editor={editor} />

      <MediaPicker
        open={picker}
        presigned={presignedUploads}
        onClose={() => setPicker(false)}
        onSelect={(m) => {
          c().insertContent({ type: "image", attrs: { src: m.fileUrl, alt: m.alt, mediaId: m.id, width: m.width, height: m.height, caption: m.caption, credit: m.copyrightHolder } }).run();
          setPicker(false);
        }}
      />

      <dialog ref={linkDialog} aria-labelledby="link-title" className="m-auto w-[min(92vw,440px)] rounded-[12px] border border-line bg-surface p-5 backdrop:bg-black/40">
        <h2 id="link-title" className="text-[17px] font-semibold">
          Link
        </h2>
        <label htmlFor="link-href" className="field-label mt-3">
          URL
        </label>
        <input id="link-href" className="input" value={link.href} onChange={(e) => setLink({ ...link, href: e.target.value })} placeholder="https://… or /guides/slug" />
        <p className="field-hint">Use a root-relative path (/guides/…) for internal links. Leave empty to remove the link.</p>
        <label className="mt-3 flex items-start gap-2 text-[14px]">
          <input type="checkbox" className="checkbox mt-0.5" checked={link.sponsored} onChange={(e) => setLink({ ...link, sponsored: e.target.checked })} />
          <span>
            Affiliate / sponsored link <span className="text-muted">(adds rel=&quot;sponsored&quot;; requires the affiliate disclosure)</span>
          </span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => linkDialog.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={applyLink}>
            Apply
          </button>
        </div>
      </dialog>
    </div>
  );
}
