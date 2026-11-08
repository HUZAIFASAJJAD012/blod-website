import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/utils/crypto";
import { NOINDEX } from "@/lib/seo/metadata";
import { ConfirmTracker } from "./tracker";

export const metadata: Metadata = { title: "Confirm subscription", robots: NOINDEX };

/**
 * GET with a token is safe to render but must not mutate on prefetch/scanners:
 * mail scanners follow links, so the page shows a button that POSTs (server action).
 */
async function confirm(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!token || token.length > 100) return;
  await db.newsletterSubscription.updateMany({
    where: { confirmTokenHash: sha256(token), confirmExpiresAt: { gt: new Date() }, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: new Date(), confirmTokenHash: null, confirmExpiresAt: null },
  });
  redirect("/newsletter/confirm?done=1");
}

export default async function ConfirmPage({ searchParams }: PageProps<"/newsletter/confirm">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const done = sp.done === "1";
  const valid =
    !done && token
      ? await db.newsletterSubscription.findFirst({ where: { confirmTokenHash: sha256(token), confirmExpiresAt: { gt: new Date() }, status: "PENDING" }, select: { id: true } })
      : null;

  return (
    <div className="container-page max-w-[640px] py-20">
      {done ? (
        <>
          <h1 className="h1-display">You&apos;re subscribed</h1>
          <p className="mt-4 text-muted">Thanks for confirming. You can unsubscribe at any time with the link in every email.</p>
          <ConfirmTracker />
        </>
      ) : valid ? (
        <>
          <h1 className="h1-display">Confirm your subscription</h1>
          <p className="mt-4 text-muted">One click and you&apos;re in.</p>
          <form action={confirm} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-primary">
              Confirm subscription
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="h1-display">This link has expired</h1>
          <p className="mt-4 text-muted">Confirmation links are valid for three days and can only be used once.</p>
        </>
      )}
      <p className="mt-8">
        <Link href="/" className="link-underline">
          Back to the homepage
        </Link>
      </p>
    </div>
  );
}
