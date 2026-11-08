"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  acceptInviteAction,
  forgotPasswordAction,
  loginAction,
  mfaVerifyAction,
  resetPasswordAction,
  type AuthState,
} from "@/server/users/auth-actions";

const init: AuthState = {};

function Feedback({ state }: { state: AuthState }) {
  if (state.error)
    return (
      <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[14px] text-danger">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="mb-4 rounded-md border border-positive/30 bg-positive-soft px-3 py-2 text-[14px] text-positive">
        {state.message}
      </p>
    );
  return null;
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, init);
  return (
    <form action={action} className="space-y-4">
      {notice && !state.error ? <Feedback state={{ message: notice }} /> : null}
      <Feedback state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <Link href="/admin/login/forgot" className="text-[13px] text-accent">
            Forgot password?
          </Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function MfaForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(mfaVerifyAction, init);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="code" className="field-label">
          6-digit code from your authenticator app
        </label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required className="input font-mono tracking-[0.3em]" autoFocus />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, init);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <div>
        <label htmlFor="email" className="field-label">
          Account email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a reset link"}
      </button>
    </form>
  );
}

function PasswordPair() {
  return (
    <>
      <div>
        <label htmlFor="password" className="field-label">
          New password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className="input" aria-describedby="pw-hint" />
        <p id="pw-hint" className="field-hint">
          At least 12 characters. A passphrase of several words works well.
        </p>
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">
          Confirm password
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required className="input" />
      </div>
    </>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, init);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <input type="hidden" name="token" value={token} />
      <PasswordPair />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, init);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <input type="hidden" name="token" value={token} />
      <PasswordPair />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
