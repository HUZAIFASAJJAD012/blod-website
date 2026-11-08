"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { bulkArticlesAction } from "@/server/articles/actions";
import { ConfirmButton } from "./confirm-button";

/** Wraps the table; reads checked rows and runs a confirmed bulk action. */
export function ArticleBulkBar({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const selected = () => [...(ref.current?.querySelectorAll<HTMLInputElement>('input[name="bulk"]:checked') ?? [])].map((i) => i.value);

  async function runOp(op: "archive" | "noindex" | "index") {
    const ids = selected();
    if (!ids.length) return "Select at least one article.";
    const res = await bulkArticlesAction(ids, op);
    if (!res.ok) return res.error;
    setMsg(`${res.data.count} article(s) updated.`);
    router.refresh();
  }

  if (!enabled) return <>{children}</>;
  return (
    <div ref={ref} onChange={() => setCount(selected().length)}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[14px]" aria-live="polite">
        <span className="text-muted">{count ? `${count} selected` : "Select rows for bulk actions"}</span>
        {count ? (
          <>
            <ConfirmButton label="Archive" title={`Archive ${count} article(s)?`} body="Published articles will be unpublished and removed from the site and sitemap. You can restore them as drafts later." confirmLabel="Archive" tone="danger" onConfirm={() => runOp("archive")} />
            <ConfirmButton label="Set noindex" title={`Set noindex on ${count} article(s)?`} body="They stay published but ask search engines not to index them, and leave the sitemap." confirmLabel="Set noindex" onConfirm={() => runOp("noindex")} />
            <ConfirmButton label="Allow indexing" title={`Allow indexing for ${count} article(s)?`} body="Published ones will be included in the sitemap again." confirmLabel="Allow" onConfirm={() => runOp("index")} />
          </>
        ) : null}
        {msg ? <span role="status" className="text-positive">{msg}</span> : null}
      </div>
      {children}
    </div>
  );
}
