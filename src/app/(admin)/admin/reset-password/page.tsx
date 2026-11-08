import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { ResetForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  const token = (await searchParams).token;
  return (
    <AuthCard title="Choose a new password">
      {typeof token === "string" && token ? <ResetForm token={token} /> : <p className="text-muted">This link is incomplete. Request a new reset email.</p>}
    </AuthCard>
  );
}
