import { guarded, json } from "@/lib/courtqueue/http";
import { tick } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/**
 * The clock's nudge — Vercel cron at 15:00 UTC, which is 8:00 am in BC (on
 * UTC-7 all year; see `legalOffset`), from vercel.json; any phone polling
 * after 8:00 does it first. Opens today's night, sends "sign-up is open"
 * once, sends due reminders and puts last night away. Harmless to call: it
 * does only what any phone's poll does.
 */
export async function GET() {
  return guarded(async () => json(await tick()));
}
