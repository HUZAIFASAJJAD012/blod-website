"use client";

import { useActionState, useEffect, useRef } from "react";

export type FormResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> } | null;

/**
 * Thin wrapper for admin forms bound to a server action `(prev, formData) => FormResult`.
 * Shows server-confirmed success/error and optionally resets on success.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
  submitLabel = "Save",
  resetOnSuccess = false,
  submitClassName = "btn btn-primary btn-sm",
}: {
  action: (prev: FormResult, form: FormData) => Promise<FormResult>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  submitClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state ? (
          <p role={state.ok ? "status" : "alert"} className={`text-[14px] ${state.ok ? "text-positive" : "text-danger"}`}>
            {state.message}
            {state.fieldErrors ? ` ${Object.values(state.fieldErrors).join(" ")}` : ""}
          </p>
        ) : null}
      </div>
    </form>
  );
}
