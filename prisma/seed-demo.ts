/**
 * Creates ONE draft article, clearly labelled [DEMO], that exercises every
 * content block so you can see the editor and preview. It is never published
 * and has noindex set. Delete it before launch.  Run: pnpm db:seed:demo
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const t = (text: string, marks?: object[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const p = (...content: object[]) => ({ type: "paragraph", content });
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [t(text)] });

const body = {
  type: "doc",
  content: [
    p(t("[DEMO CONTENT — not a real guide. Delete before launch.] This draft shows every block the editor supports so you can check styling and the preview.")),
    { type: "callout", attrs: { variant: "tip", title: "Quick fix" }, content: [p(t("Summarise the most likely fix in one or two sentences here."))] },
    h(2, "Before you start"),
    { type: "callout", attrs: { variant: "backup" }, content: [p(t("Take a full backup of files and database before you change anything."))] },
    h(2, "Steps"),
    {
      type: "steps",
      content: [
        { type: "step", attrs: { title: "Check the response code" }, content: [p(t("Run the command and note the status line.")), { type: "codeBlock", attrs: { language: "bash", kind: "command" }, content: [t("curl -sI https://example.com | head -1")] }, { type: "codeBlock", attrs: { language: "http", kind: "output" }, content: [t("HTTP/2 200")] }] },
        { type: "step", attrs: { title: "Read the log" }, content: [p(t("Open the error log and look for the most recent entry."))] },
      ],
    },
    h(3, "Configuration example"),
    { type: "codeBlock", attrs: { language: "nginx", kind: "config", filename: "/etc/nginx/conf.d/example.conf" }, content: [t("location / {\n  try_files $uri $uri/ /index.php?$args;\n}")] },
    h(2, "Reference table"),
    {
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableHeader", content: [p(t("Symptom"))] }, { type: "tableHeader", content: [p(t("Likely layer"))] }] },
        { type: "tableRow", content: [{ type: "tableCell", content: [p(t("500"))] }, { type: "tableCell", content: [p(t("Application"))] }] },
      ],
    },
    { type: "callout", attrs: { variant: "warning" }, content: [p(t("Warnings look like this."))] },
    p(t("Official documentation is linked like "), t("this", [{ type: "link", attrs: { href: "https://developer.wordpress.org/" } }]), t(" and cited like this "), { type: "citation", attrs: { n: 1 } }, t(".")),
  ],
};

async function main() {
  const owner = await db.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" } });
  const cat = await db.category.findFirst({ orderBy: { sortOrder: "asc" } });
  if (!owner || !cat) throw new Error("Run `pnpm db:seed` first.");
  const slug = "demo-editor-showcase-not-for-publication";
  await db.article.upsert({
    where: { slug },
    create: {
      slug,
      title: "[DEMO] Editor showcase — not for publication",
      excerpt: "Demo draft showing every content block. Never publish this.",
      bodyJson: body,
      bodyText: "demo content",
      primaryCategoryId: cat.id,
      authorId: owner.id,
      status: "DRAFT",
      robotsIndex: false,
      testedEnvironment: [{ label: "Example", value: "demo only" }],
    },
    update: {},
  });
  console.log("Demo draft created (status DRAFT, noindex). Delete it before launch.");
}

main().finally(() => db.$disconnect());
