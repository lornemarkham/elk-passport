import "server-only";
import type { Experience } from "@/domain/experience/types";
import { ZONE } from "@/domain/experience/eventTime";
import type { AdventureSession } from "./server";
import {
  adventureGlances,
  adventuresOf,
  type AdventureGlance,
  type AdventureSummary,
} from "./store";
import { atlasStopsFor } from "./atlas-names";

export interface AdventureOverview {
  readonly adventures: readonly AdventureSummary[];
  readonly glances: Readonly<Record<string, AdventureGlance>>;
  /** The picture for each adventure: its first stop's, else its first idea's. */
  readonly covers: Readonly<Record<string, Experience>>;
}

/** Today where Passport's subjects are, `YYYY-MM-DD`. */
export function todayIn(timeZone: string | null = ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timeZone ?? ZONE,
  }).format(new Date());
}

/**
 * **Everything Saved and Adventures need to show someone's adventures as
 * cards**: the list, a glance at each plan, and a picture for each — three
 * reads however many there are. `null` when adventures can't be reached
 * (never "you have none").
 */
export async function adventureOverview(
  session: AdventureSession,
): Promise<AdventureOverview | null> {
  try {
    const adventures = await adventuresOf(session.db, session.user.id);
    const glances = await adventureGlances(
      session.db,
      adventures.map((a) => a.id),
    ).catch(() => ({}) as Record<string, AdventureGlance>);
    const coverRef = Object.fromEntries(
      adventures.flatMap((a) => {
        const g = glances[a.id];
        const ref = g?.stops[0] ?? g?.ideas[0];
        return ref ? [[a.id, ref] as const] : [];
      }),
    );
    const { experiences } = await atlasStopsFor(Object.values(coverRef));
    const covers = Object.fromEntries(
      Object.entries(coverRef).flatMap(([id, ref]) =>
        experiences[ref] ? [[id, experiences[ref]!] as const] : [],
      ),
    );
    return { adventures, glances, covers };
  } catch {
    return null;
  }
}
