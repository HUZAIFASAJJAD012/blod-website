import { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: number; fieldErrors?: Record<string, string> };

/** Converts thrown domain errors into a serializable envelope; logs unexpected ones. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const err = e as Error & { status?: number; fieldErrors?: Record<string, string>; digest?: string };
    // Let Next.js redirect()/notFound() propagate.
    if (typeof err.digest === "string" && (err.digest.startsWith("NEXT_REDIRECT") || err.digest.startsWith("NEXT_HTTP_ERROR"))) throw e;
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input.", code: 422 };
    if (err.status && err.status < 500) return { ok: false, error: err.message, code: err.status, fieldErrors: err.fieldErrors };
    console.error("[action] unexpected error", err);
    return { ok: false, error: "Something went wrong on our side. Your changes were not saved — please retry.", code: 500 };
  }
}
