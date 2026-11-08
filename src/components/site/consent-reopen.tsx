"use client";

import { useState } from "react";

type W = Window & {
  googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  __tcfapi?: (cmd: string, v: number, cb: (...a: unknown[]) => void) => void;
};

/**
 * Re-opens the certified CMP. Supports Google's Privacy & messaging (googlefc)
 * and falls back to TCF-compliant CMPs that expose a display command.
 */
export function ConsentReopen() {
  const [msg, setMsg] = useState<string | null>(null);
  function open() {
    const w = window as W;
    if (w.googlefc) {
      w.googlefc.callbackQueue = w.googlefc.callbackQueue || [];
      w.googlefc.callbackQueue.push(() => w.googlefc?.showRevocationMessage?.());
      return;
    }
    if (w.__tcfapi) {
      w.__tcfapi("displayConsentUi", 2, () => undefined);
      return;
    }
    setMsg("The consent tool hasn't loaded (it may be blocked by an extension). Reload the page and try again.");
  }
  return (
    <div>
      <button type="button" className="btn btn-secondary" onClick={open}>
        Review consent choices
      </button>
      {msg ? (
        <p role="status" className="field-hint">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
