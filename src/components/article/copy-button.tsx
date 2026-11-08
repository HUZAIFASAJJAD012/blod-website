"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
    window.setTimeout(() => setState("idle"), 1800);
  }

  return (
    <button type="button" className="copy-btn" onClick={copy} aria-live="polite">
      {state === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{state === "copied" ? "Copied" : state === "error" ? "Copy failed" : "Copy"}</span>
    </button>
  );
}
