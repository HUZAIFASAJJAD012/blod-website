import type { ArticleStatus } from "@/generated/prisma/enums";
import { can, type Actor } from "@/lib/permissions";
import type { WorkflowAction } from "@/lib/schemas/article";

/**
 * Editorial state machine. Pure, so it's exhaustively unit-tested.
 *   DRAFT ──submit──▶ IN_REVIEW ──approve──▶ APPROVED ──publish/schedule──▶ PUBLISHED/SCHEDULED
 *   IN_REVIEW ──requestChanges──▶ DRAFT
 *   SCHEDULED ──(cron)──▶ PUBLISHED, SCHEDULED ──unpublish──▶ APPROVED
 *   PUBLISHED ──unpublish──▶ DRAFT,   any ──archive──▶ ARCHIVED ──restoreDraft──▶ DRAFT
 * Editors may publish directly from DRAFT/IN_REVIEW (they are the reviewer).
 */
const TRANSITIONS: Record<WorkflowAction, { from: ArticleStatus[]; to: ArticleStatus; needsReviewer: boolean }> = {
  submit: { from: ["DRAFT"], to: "IN_REVIEW", needsReviewer: false },
  requestChanges: { from: ["IN_REVIEW", "APPROVED"], to: "DRAFT", needsReviewer: true },
  approve: { from: ["IN_REVIEW"], to: "APPROVED", needsReviewer: true },
  publish: { from: ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED"], to: "PUBLISHED", needsReviewer: true },
  schedule: { from: ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED"], to: "SCHEDULED", needsReviewer: true },
  unpublish: { from: ["PUBLISHED", "SCHEDULED"], to: "DRAFT", needsReviewer: true },
  archive: { from: ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED"], to: "ARCHIVED", needsReviewer: true },
  restoreDraft: { from: ["ARCHIVED"], to: "DRAFT", needsReviewer: true },
};

export function transitionTarget(action: WorkflowAction): ArticleStatus {
  return TRANSITIONS[action].to;
}

export function canTransition(actor: Actor, article: { authorId: string; status: ArticleStatus }, action: WorkflowAction): { ok: true } | { ok: false; reason: string } {
  const t = TRANSITIONS[action];
  if (!t.from.includes(article.status)) return { ok: false, reason: `Cannot ${action} an article that is ${article.status.toLowerCase().replace("_", " ")}.` };
  if (t.needsReviewer && !can(actor, "article.review")) return { ok: false, reason: "Only editors can do that." };
  if (action === "submit" && article.authorId !== actor.id && !can(actor, "article.editAny")) return { ok: false, reason: "You can only submit your own drafts." };
  return { ok: true };
}

export function availableActions(actor: Actor, article: { authorId: string; status: ArticleStatus }): WorkflowAction[] {
  return (Object.keys(TRANSITIONS) as WorkflowAction[]).filter((a) => canTransition(actor, article, a).ok);
}
