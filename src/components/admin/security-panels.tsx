"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, confirmMfaEnrollment, disableMfa, startMfaEnrollment, type AuthState } from "@/server/users/auth-actions";

function Msg({ s }: { s: AuthState }) {
  if (s.error) return <p role="alert" className="field-error">{s.error}</p>;
  if (s.message) return <p role="status" className="text-[14px] text-positive">{s.message}</p>;
  return null;
}

export function MfaPanel({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [confirmState, confirmAction, confirming] = useActionState(confirmMfaEnrollment, {});
  const [disableState, disableAction, disabling] = useActionState(disableMfa, {});
  const on = (enabled && !disableState.message) || Boolean(confirmState.message);

  return (
    <section className="rounded-[10px] border border-line bg-surface p-5">
      <h2 className="text-[15px] font-semibold">Two-factor authentication</h2>
      <p className="mt-1 text-[13.5px] text-muted">{on ? "On — a code from your authenticator app is required at sign-in." : "Off. Strongly recommended for editors and admins."}</p>
      {!on && !setup ? (
        <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={async () => setSetup(await startMfaEnrollment())}>
          Set up 2FA
        </button>
      ) : null}
      {!on && setup ? (
        <form action={confirmAction} className="mt-3 space-y-3">
          <p className="text-[13.5px]">Add this key to your authenticator app (manual entry, time-based):</p>
          <p className="rounded-md bg-[#F4F3EF] p-2 font-mono text-[13px] break-all select-all">{setup.secret}</p>
          <p className="text-[12px] break-all text-muted">or open: <a className="link-underline" href={setup.uri}>{setup.uri.slice(0, 48)}…</a></p>
          <label htmlFor="mfa-code" className="field-label">Enter the current 6-digit code</label>
          <input id="mfa-code" name="code" inputMode="numeric" maxLength={7} required className="input font-mono" />
          <button type="submit" className="btn btn-primary btn-sm" disabled={confirming}>Turn on</button>
          <Msg s={confirmState} />
        </form>
      ) : null}
      {on ? (
        <form action={disableAction} className="mt-3 space-y-2">
          <label htmlFor="mfa-pw" className="field-label">Confirm password to turn off</label>
          <input id="mfa-pw" name="password" type="password" autoComplete="current-password" required className="input" />
          <button type="submit" className="btn btn-ghost btn-sm text-danger" disabled={disabling}>Turn off 2FA</button>
          <Msg s={disableState} />
        </form>
      ) : null}
      {confirmState.message ? <Msg s={confirmState} /> : null}
    </section>
  );
}

export function PasswordPanel() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return (
    <section className="rounded-[10px] border border-line bg-surface p-5">
      <h2 className="text-[15px] font-semibold">Change password</h2>
      <form action={action} className="mt-3 space-y-3">
        <div>
          <label htmlFor="pw-cur" className="field-label">Current password</label>
          <input id="pw-cur" name="current" type="password" autoComplete="current-password" required className="input" />
        </div>
        <div>
          <label htmlFor="pw-new" className="field-label">New password (12+ characters)</label>
          <input id="pw-new" name="password" type="password" autoComplete="new-password" minLength={12} required className="input" />
        </div>
        <div>
          <label htmlFor="pw-conf" className="field-label">Confirm new password</label>
          <input id="pw-conf" name="confirm" type="password" autoComplete="new-password" minLength={12} required className="input" />
        </div>
        <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>Change password</button>
        <Msg s={state} />
      </form>
    </section>
  );
}
