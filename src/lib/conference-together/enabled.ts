import "server-only";
import { conferenceSetup } from "@/lib/conference/config";

/**
 * **Whether the shared modules — plans, chat, find my people, memories — may
 * run in this process.**
 *
 * Same rule as Arrivals (`conference-arrivals/enabled.ts`): in development on
 * the memory store they are memory too; on `CONFERENCE_STORE=supabase` their
 * tables exist only once `20261023000000_passport_conference_together.sql`
 * is applied, so the owner opens them with `CONFERENCE_TOGETHER=on` after
 * applying it. Until then each says plainly it isn't open, instead of
 * turning every tap into a 500.
 */
export function togetherEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
  isDev = process.env.NODE_ENV !== "production",
): boolean {
  const setup = conferenceSetup(env, isDev);
  if (!setup.open) return false;
  if (setup.config.store === "supabase")
    return env.CONFERENCE_TOGETHER === "on";
  return isDev;
}
