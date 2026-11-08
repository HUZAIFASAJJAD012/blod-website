import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/auth-card";
import { ForgotForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <AuthCard title="Reset your password" footer={<Link href="/admin/login" className="link-underline">Back to sign in</Link>}>
      <ForgotForm />
    </AuthCard>
  );
}
