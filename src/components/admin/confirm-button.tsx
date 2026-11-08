"use client";

import { useRef, useState, useTransition } from "react";

/**
 * Button that opens an accessible confirmation dialog before running an action.
 * `onConfirm` returns an optional error string to display.
 */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
  className = "btn btn-secondary btn-sm",
  onConfirm,
}: {
  label: React.ReactNode;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  className?: string;
  onConfirm: () => Promise<string | void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => (setError(null), ref.current?.showModal())}>
        {label}
      </button>
      <dialog ref={ref} aria-labelledby="confirm-title" className="m-auto w-[min(92vw,440px)] rounded-[12px] border border-line bg-surface p-0 backdrop:bg-black/40">
        <div className="p-5">
          <h2 id="confirm-title" className="text-[18px] font-semibold">
            {title}
          </h2>
          <div className="mt-2 text-[14.5px] text-muted">{body}</div>
          {error ? (
            <p role="alert" className="field-error mt-3">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.close()} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const err = await onConfirm();
                if (err) setError(err);
                else ref.current?.close();
              })
            }
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
