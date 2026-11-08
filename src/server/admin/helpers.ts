import "server-only";
import { ZodError } from "zod";
import type { FormResult } from "@/components/admin/action-form";
import { requireUserOrThrow, type SessionUser } from "@/lib/auth/session";
import { can, type Capability } from "@/lib/permissions";

/** Runs an admin form action with capability check and uniform error handling. */
export async function guarded(capability: Capability, fn: (user: SessionUser) => Promise<string>): Promise<FormResult> {
  try {
    const user = await requireUserOrThrow();
    if (!can(user, capability)) return { ok: false, message: "You don't have permission to do that." };
    return { ok: true, message: await fn(user) };
  } catch (e) {
    if (e instanceof ZodError) {
      const fe: Record<string, string> = {};
      for (const i of e.issues) fe[i.path.join(".")] ??= i.message;
      return { ok: false, message: "Please fix:", fieldErrors: fe };
    }
    const err = e as Error & { status?: number; code?: string };
    if (err.code === "P2002") return { ok: false, message: "That value is already in use (must be unique)." };
    if (err.status && err.status < 500) return { ok: false, message: err.message };
    if (err.message && /redirect|loop|cannot/i.test(err.message)) return { ok: false, message: err.message };
    console.error("[admin action]", e);
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}

export const fdStr = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const fdBool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true" || fd.get(k) === "1";
