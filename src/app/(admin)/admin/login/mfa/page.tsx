import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { MfaForm } from "@/components/admin/auth-forms";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function MfaPage({ searchParams }: PageProps<"/admin/login/mfa">) {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (!s.mfaPending) redirect("/admin");
  const next = (await searchParams).next;
  return (
    <AuthCard title="Two-factor verification">
      <MfaForm next={typeof next === "string" ? next : undefined} />
    </AuthCard>
  );
}
