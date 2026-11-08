import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Unsubscribe", robots: NOINDEX };

async function unsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (token && token.length <= 100) {
    await db.newsletterSubscription.updateMany({
      where: { unsubscribeToken: token, status: { not: "UNSUBSCRIBED" } },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
    });
  }
  redirect("/newsletter/unsubscribe?done=1");
}

export default async function UnsubscribePage({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (sp.done === "1") {
    return (
      <div className="container-page max-w-[640px] py-20">
        <h1 className="h1-display">You&apos;re unsubscribed</h1>
        <p className="mt-4 text-muted">You won&apos;t receive any more newsletters. Sorry to see you go.</p>
        <p className="mt-8">
          <Link href="/" className="link-underline">
            Back to the homepage
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="container-page max-w-[640px] py-20">
      <h1 className="h1-display">Unsubscribe from the newsletter</h1>
      {token ? (
        <form action={unsubscribe} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-primary">
            Unsubscribe
          </button>
        </form>
      ) : (
        <p className="mt-4 text-muted">Use the unsubscribe link at the bottom of any newsletter email.</p>
      )}
    </div>
  );
}
