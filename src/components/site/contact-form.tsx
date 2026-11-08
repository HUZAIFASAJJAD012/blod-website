"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { submitContact, type FormState } from "@/server/leads/actions";
import { trackEvent } from "@/lib/utils/analytics-client";

const initial: FormState = { status: "idle" };

const TOPIC_LABELS: Record<string, string> = {
  question: "A question about a guide",
  correction: "Report an error / correction",
  "hire-help": "I need help fixing a problem",
  partnership: "Partnership or affiliate enquiry",
  privacy: "Privacy / data request",
  other: "Something else",
};

export function ContactForm({ defaultTopic, pageUrl, hireHelp }: { defaultTopic: string; pageUrl: string; hireHelp: boolean }) {
  const [state, action, pending] = useActionState(submitContact, initial);
  const [startedAt, setStartedAt] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- time-to-submit heuristic must be client time
  useEffect(() => setStartedAt(Date.now()), []);
  useEffect(() => {
    if (state.status === "success") trackEvent("contact_submit");
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-[10px] border border-positive/30 bg-positive-soft p-6">
        <p className="text-[17px] font-semibold text-positive">Message sent</p>
        <p className="mt-1 text-[15px]">{state.message}</p>
      </div>
    );
  }

  const fe = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const err = (k: string) =>
    fe[k] ? (
      <p id={`${k}-error`} className="field-error">
        {fe[k]}
      </p>
    ) : null;
  const aria = (k: string) => (fe[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === "error" ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-[15px] text-danger">
          {state.message}
        </p>
      ) : null}
      <input type="hidden" name="pageUrl" value={pageUrl} />
      <input type="hidden" name="startedAt" value={startedAt || ""} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="field-label">
            Your name
          </label>
          <input id="c-name" name="name" className="input" autoComplete="name" required maxLength={100} {...aria("name")} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="c-email" className="field-label">
            Email
          </label>
          <input id="c-email" name="email" type="email" className="input" autoComplete="email" required maxLength={254} {...aria("email")} />
          {err("email")}
        </div>
      </div>
      <div>
        <label htmlFor="c-topic" className="field-label">
          What is this about?
        </label>
        <select id="c-topic" name="topic" className="select" defaultValue={defaultTopic}>
          {Object.entries(TOPIC_LABELS)
            .filter(([k]) => hireHelp || k !== "hire-help")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label htmlFor="c-subject" className="field-label">
          Subject
        </label>
        <input id="c-subject" name="subject" className="input" required maxLength={160} {...aria("subject")} />
        {err("subject")}
      </div>
      <div>
        <label htmlFor="c-message" className="field-label">
          Message
        </label>
        <textarea id="c-message" name="message" className="textarea min-h-[180px]" required maxLength={5000} {...aria("message")} />
        <p className="field-hint">Include the exact error and what changed before it started. Never include passwords or keys.</p>
        {err("message")}
      </div>
      {pageUrl ? <p className="text-[14px] text-muted">About page: <span className="font-mono">{pageUrl}</span></p> : null}
      <label className="flex items-start gap-2.5 text-[14.5px]">
        <input type="checkbox" name="consent" value="yes" className="checkbox mt-0.5" required {...aria("consent")} />
        <span>
          I agree that {""}FixLayer may store these details to reply to my message, as described in the{" "}
          <Link href="/privacy-policy" className="link-underline">
            privacy policy
          </Link>
          .
        </span>
      </label>
      {err("consent")}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
