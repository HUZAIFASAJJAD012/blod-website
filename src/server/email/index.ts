import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";

type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string; kind: string };

/**
 * Transactional email goes through an outbox table: the request enqueues, then
 * we try to deliver immediately; anything that fails is retried by the cron job.
 * EMAIL_TRANSPORT=log prints messages to the server console for local dev.
 */
export async function enqueueEmail(mail: Mail) {
  return db.emailOutbox.create({ data: { ...mail } });
}

let transporter: Transporter | null = null;
function getTransport() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

async function deliver(m: { to: string; subject: string; text: string; html: string | null; replyTo: string | null }) {
  const from = process.env.EMAIL_FROM ?? "FixLayer <no-reply@localhost>";
  if ((process.env.EMAIL_TRANSPORT ?? "log") === "log") {
    console.info(`[email:log] to=${m.to} subject=${JSON.stringify(m.subject)}\n${m.text}\n[/email]`);
    return;
  }
  await getTransport().sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html ?? undefined, replyTo: m.replyTo ?? undefined });
}

/** Claims a message atomically so concurrent workers never send it twice. */
export async function sendOutboxMessage(id: string): Promise<boolean> {
  const claimed = await db.emailOutbox.updateMany({
    where: { id, status: "PENDING", sendAfter: { lte: new Date() } },
    data: { attempts: { increment: 1 }, sendAfter: new Date(Date.now() + 10 * 60_000) },
  });
  if (claimed.count === 0) return false;
  const m = await db.emailOutbox.findUniqueOrThrow({ where: { id } });
  try {
    await deliver(m);
    await db.emailOutbox.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
    return true;
  } catch (e) {
    const failed = m.attempts >= 5;
    await db.emailOutbox.update({
      where: { id },
      data: {
        status: failed ? "FAILED" : "PENDING",
        lastError: String((e as Error).message).slice(0, 500),
        sendAfter: new Date(Date.now() + 2 ** m.attempts * 60_000),
      },
    });
    return false;
  }
}

export async function dispatchOutbox(limit = 25) {
  const due = await db.emailOutbox.findMany({
    where: { status: "PENDING", sendAfter: { lte: new Date() } },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  for (const { id } of due) if (await sendOutboxMessage(id)) sent++;
  return { attempted: due.length, sent };
}

export async function sendNow(mail: Mail) {
  const row = await enqueueEmail(mail);
  await sendOutboxMessage(row.id).catch(() => false);
  return row.id;
}
