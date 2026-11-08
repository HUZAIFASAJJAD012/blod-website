"use server";

import { db } from "@/lib/db";
import { contactSchema, newsletterSchema, spamScore } from "@/lib/schemas/leads";
import { randomToken, sha256 } from "@/lib/utils/crypto";
import { requestIpHash } from "@/lib/utils/request";
import { rateLimit } from "@/server/security/rate-limit";
import { sendNow } from "@/server/email";
import { getSiteOrigin } from "@/lib/seo/urls";

export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

const NEUTRAL_OK = "Thanks — check your inbox for a confirmation link. If you don't see it within a few minutes, check spam.";

export async function subscribeNewsletter(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = newsletterSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fe = fieldErrors(parsed.error.issues);
    if (fe.website) return { status: "success", message: NEUTRAL_OK }; // silently drop bots
    return { status: "error", message: Object.values(fe)[0] ?? "Please check the form.", fieldErrors: fe };
  }
  const ipHash = await requestIpHash();
  const rl = await rateLimit(`newsletter:${ipHash}`, 5, 3600);
  if (!rl.ok) return { status: "error", message: "Too many attempts. Please try again later." };

  const { email, source } = parsed.data;
  const existing = await db.newsletterSubscription.findUnique({ where: { email } });
  // Same response whether or not the address exists → no subscriber enumeration.
  if (existing?.status === "CONFIRMED") return { status: "success", message: NEUTRAL_OK };

  const token = randomToken(24);
  const sub = await db.newsletterSubscription.upsert({
    where: { email },
    create: {
      email,
      consentAt: new Date(),
      source: source ?? null,
      status: "PENDING",
      confirmTokenHash: sha256(token),
      confirmExpiresAt: new Date(Date.now() + 3 * 86400_000),
      unsubscribeToken: randomToken(24),
    },
    update: {
      consentAt: new Date(),
      status: "PENDING",
      unsubscribedAt: null,
      confirmTokenHash: sha256(token),
      confirmExpiresAt: new Date(Date.now() + 3 * 86400_000),
    },
  });
  const origin = getSiteOrigin();
  await sendNow({
    to: email,
    kind: "newsletter_confirm",
    subject: "Confirm your FixLayer subscription",
    text: [
      "Please confirm you want to receive the FixLayer newsletter:",
      `${origin}/newsletter/confirm?token=${token}`,
      "",
      "If you didn't request this, ignore this email — you won't be subscribed.",
      `Unsubscribe at any time: ${origin}/newsletter/unsubscribe?token=${sub.unsubscribeToken}`,
    ].join("\n"),
  });
  return { status: "success", message: NEUTRAL_OK };
}

export async function submitContact(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fe = fieldErrors(parsed.error.issues);
    if (fe.website) return { status: "success", message: "Thanks — your message has been received." };
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fe };
  }
  const data = parsed.data;
  const ipHash = await requestIpHash();
  const rl = await rateLimit(`contact:${ipHash}`, 5, 3600);
  if (!rl.ok) return { status: "error", message: "You've sent several messages recently. Please try again in an hour." };

  const tooFast = data.startedAt && Date.now() - data.startedAt < 3000;
  const spam = tooFast || spamScore(data.message) >= 3;

  const row = await db.contactSubmission.create({
    data: {
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      topic: data.topic,
      pageUrl: data.pageUrl?.startsWith("/") ? data.pageUrl : null,
      consent: true,
      status: spam ? "SPAM" : "NEW",
      ipHash,
    },
  });

  const inbox = process.env.CONTACT_INBOX;
  if (!spam && inbox) {
    await sendNow({
      to: inbox,
      replyTo: data.email,
      kind: "contact_notification",
      subject: `[FixLayer contact · ${data.topic}] ${data.subject}`,
      text: `From: ${data.name} <${data.email}>\nTopic: ${data.topic}\nPage: ${data.pageUrl ?? "-"}\n\n${data.message}\n\nAdmin: ${getSiteOrigin()}/admin/inbox/${row.id}`,
    });
  }
  return { status: "success", message: "Thanks — your message has been received. We reply by email, usually within a few working days." };
}
