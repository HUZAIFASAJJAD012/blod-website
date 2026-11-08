"use client";

import Link from "next/link";
import { useActionState } from "react";
import { subscribeNewsletter, type FormState } from "@/server/leads/actions";

const initial: FormState = { status: "idle" };

export function NewsletterForm({ source = "homepage", compact = false }: { source?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, initial);

  if (state.status === "success") {
    return (
      <p role="status" className="rounded-lg border border-positive/30 bg-positive-soft px-4 py-3 text-[15px] text-positive">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className={compact ? "space-y-3" : "space-y-3"} noValidate>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot: real users never see or fill this */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`website-${source}`}>Website</label>
        <input id={`website-${source}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`nl-email-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`nl-email-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="input sm:max-w-sm"
          aria-invalid={state.status === "error" ? true : undefined}
          aria-describedby={`nl-help-${source}`}
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Subscribe"}
        </button>
      </div>
      <label className="flex items-start gap-2.5 text-[14px] text-muted">
        <input type="checkbox" name="consent" value="yes" required className="checkbox mt-0.5" />
        <span>
          I agree to receive the FixLayer newsletter. We&apos;ll email you a confirmation link first (double opt-in). See our{" "}
          <Link href="/privacy-policy" className="link-underline">
            privacy policy
          </Link>
          .
        </span>
      </label>
      <p id={`nl-help-${source}`} role={state.status === "error" ? "alert" : undefined} className={state.status === "error" ? "field-error" : "sr-only"}>
        {state.status === "error" ? state.message : "Enter your email address and tick the consent box."}
      </p>
    </form>
  );
}
