import type { ArticleStatus, Role } from "@/generated/prisma/enums";

/**
 * RBAC policy. Pure functions so they are trivially unit-testable and can be
 * reused by server actions, route handlers and (for UI hints only) client code.
 * Server code must always call these — hiding a button is never authorization.
 */
export const ROLE_RANK: Record<Role, number> = { AUTHOR: 1, EDITOR: 2, ADMIN: 3, OWNER: 4 };

export type Actor = { id: string; role: Role };

export const atLeast = (actor: Actor, role: Role) => ROLE_RANK[actor.role] >= ROLE_RANK[role];

export type Capability =
  | "article.create"
  | "article.review" // approve / reject / publish / schedule / unpublish
  | "article.editAny"
  | "article.bulk"
  | "taxonomy.manage"
  | "media.manageAny"
  | "redirects.manage"
  | "seo.view"
  | "monetization.manage"
  | "settings.manage"
  | "users.manage"
  | "users.manageOwners"
  | "audit.view"
  | "inbox.view";

const CAPABILITY_MIN_ROLE: Record<Capability, Role> = {
  "article.create": "AUTHOR",
  "article.review": "EDITOR",
  "article.editAny": "EDITOR",
  "article.bulk": "EDITOR",
  "taxonomy.manage": "EDITOR",
  "media.manageAny": "EDITOR",
  "redirects.manage": "EDITOR",
  "seo.view": "EDITOR",
  "inbox.view": "EDITOR",
  "monetization.manage": "ADMIN",
  "settings.manage": "ADMIN",
  "users.manage": "ADMIN",
  "audit.view": "ADMIN",
  "users.manageOwners": "OWNER",
};

export function can(actor: Actor, capability: Capability): boolean {
  return atLeast(actor, CAPABILITY_MIN_ROLE[capability]);
}

const AUTHOR_EDITABLE: ArticleStatus[] = ["DRAFT", "IN_REVIEW"];

/** Authors may edit their own drafts (and pull back items in review); editors+ edit anything. */
export function canEditArticle(actor: Actor, article: { authorId: string; status: ArticleStatus }): boolean {
  if (can(actor, "article.editAny")) return true;
  return article.authorId === actor.id && AUTHOR_EDITABLE.includes(article.status);
}

export function canViewArticleInAdmin(actor: Actor, article: { authorId: string }): boolean {
  return can(actor, "article.editAny") || article.authorId === actor.id;
}

/** Who may assign a given role to someone else. Only owners create owners/admins. */
export function canGrantRole(actor: Actor, role: Role): boolean {
  if (role === "OWNER" || role === "ADMIN") return actor.role === "OWNER";
  return can(actor, "users.manage");
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}

export function assertCan(actor: Actor, capability: Capability) {
  if (!can(actor, capability)) throw new ForbiddenError();
}
