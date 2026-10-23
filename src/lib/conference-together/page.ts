import "server-only";
import type { ConferenceContext } from "@/domain/conference/contracts";
import type { ModuleId } from "@/domain/conference/types";
import type { IdentityKey } from "@/domain/conference/types";
import { conferenceSetup } from "@/lib/conference/config";
import { conferenceContext, readIdentity } from "@/lib/conference/request";
import { togetherEnabled } from "./enabled";

/**
 * What a shared module's page needs first: the member's context (or `null`,
 * which the page turns into `notFound()`), their identity for the service,
 * and whether the module may open here at all.
 */
export async function modulePage(
  conferenceId: string,
  module: ModuleId,
): Promise<null | {
  ctx: ConferenceContext;
  identity: IdentityKey;
  open: boolean;
}> {
  const ctx = await conferenceContext(conferenceId);
  if (!ctx) return null;
  if (
    !ctx.conference.modules.includes(module) &&
    ctx.viewer.role !== "organiser"
  )
    return null;
  const setup = conferenceSetup();
  if (!setup.open) return null;
  const identity = await readIdentity(setup.config);
  if (!identity) return null;
  return { ctx, identity, open: togetherEnabled() };
}

/** The days a plan can be on: two either side of the conference, in its zone. */
export function planDays(c: {
  startsOn: string;
  endsOn?: string;
}): { ymd: string; label: string }[] {
  const out: { ymd: string; label: string }[] = [];
  const day = 86_400_000;
  const from = Date.parse(`${c.startsOn}T12:00:00Z`) - 2 * day;
  const to = Date.parse(`${c.endsOn ?? c.startsOn}T12:00:00Z`) + 2 * day;
  for (let t = from; t <= to; t += day) {
    const d = new Date(t);
    out.push({
      ymd: d.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(d),
    });
  }
  return out;
}
