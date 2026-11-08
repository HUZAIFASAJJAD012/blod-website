// Local stand-in for the platform scheduler: calls /api/cron every 60s.
// Usage: pnpm cron:local   (reads SITE_URL and CRON_SECRET from .env)
import "dotenv/config";

const url = `${(process.env.SITE_URL ?? "http://localhost:3100").replace(/\/$/, "")}/api/cron`;
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set");
  process.exit(1);
}
async function tick() {
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    console.log(new Date().toISOString(), res.status, await res.text());
  } catch (e) {
    console.error(new Date().toISOString(), "cron call failed:", e.message);
  }
}
await tick();
setInterval(tick, 60_000);
