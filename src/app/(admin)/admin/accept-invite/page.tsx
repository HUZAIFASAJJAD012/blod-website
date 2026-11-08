import type { Metadata } from "next";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/utils/crypto";
import { AuthCard } from "@/components/admin/auth-card";
import { AcceptInviteForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({ searchParams }: PageProps<"/admin/accept-invite">) {
  const token = (await searchParams).token;
  const inv =
    typeof token === "string" && token.length <= 100
      ? await db.invitation.findUnique({ where: { tokenHash: sha256(token) }, select: { name: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true } })
      : null;
  const valid = inv && !inv.acceptedAt && !inv.revokedAt && inv.expiresAt > new Date();
  return (
    <AuthCard title={valid ? `Welcome, ${inv.name}` : "Invitation unavailable"}>
      {valid ? (
        <>
          <p className="mb-4 text-[14.5px] text-muted">
            You&apos;ve been invited as <strong className="text-ink">{inv.role.toLowerCase()}</strong> with <span className="font-mono">{inv.email}</span>. Choose a password to finish.
          </p>
          <AcceptInviteForm token={token as string} />
        </>
      ) : (
        <p className="text-muted">This invitation is invalid, has expired or was already used. Ask an administrator to send a new one.</p>
      )}
    </AuthCard>
  );
}
