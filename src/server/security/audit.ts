import "server-only";
import { db, type Prisma } from "@/lib/db";

type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: Prisma.InputJsonValue;
  ipHash?: string | null;
};

/** Append-only audit trail. Summaries must never include secrets or full PII. */
export async function audit(input: AuditInput, tx: Prisma.TransactionClient | typeof db = db) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summaryJson: input.summary ?? {},
      ipHash: input.ipHash ?? null,
    },
  });
}
