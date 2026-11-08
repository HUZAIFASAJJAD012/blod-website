"use client";

import { useRouter } from "next/navigation";
import { restoreRevisionAction } from "@/server/articles/actions";
import { ConfirmButton } from "./confirm-button";

export function RestoreRevisionButton({ articleId, revisionId, version }: { articleId: string; revisionId: string; version: number }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Restore this version"
      title={`Restore revision v${version}?`}
      body="The article's content and settings will be replaced with this version (the URL slug is kept). The current version stays in history, and the restore is audit-logged."
      confirmLabel="Restore"
      onConfirm={async () => {
        const r = await restoreRevisionAction(articleId, revisionId);
        if (!r.ok) return r.error;
        router.push(`/admin/articles/${articleId}/edit`);
      }}
    />
  );
}
