import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { LoginForm } from "@/components/admin/auth-forms";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const s = await getSession();
  if (s && !s.mfaPending) redirect("/admin");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <AuthCard title="Sign in to the CMS" footer="Staff only. Accounts are created by invitation.">
      <LoginForm next={next} notice={sp.reset === "1" ? "Password updated. Sign in with your new password." : undefined} />
    </AuthCard>
  );
}
