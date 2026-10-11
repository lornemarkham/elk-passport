import "server-only";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { defaultFeed } from "@/domain/discovery/defaultFeed";
import { readBrief } from "@/domain/day/brief";
import { buildDay } from "@/domain/day/build";
import { townById } from "@/domain/discovery/towns";

/**
 * **"What do you want to do in Vancouver?" — answered by GO HAVE A DAY.**
 *
 * There is no second discovery engine here, by the mission's rule. The
 * possibilities colleagues can say "I'm in" to are the stops `/go` itself
 * builds from four sentences, against the same corpus read, the same feed
 * policy and the same builder. If `/go` gets better, this gets better; if it
 * picks something odd, `/go` picked it.
 *
 * The sentences are phrased in the words `readBrief` actually understands
 * (checked: "three *free* hours" reads as no hours at all), and each one is
 * also a door into `/go` itself, where a person can keep talking to the day.
 */
export const DOORS: readonly {
  readonly label: string;
  readonly say: string;
}[] = [
  {
    label: "After the sessions",
    say: "Three hours after the sessions, outdoors, close by",
  },
  { label: "A free day", say: "A whole day, something adventurous" },
  {
    label: "Dinner crowd",
    say: "An evening with colleagues, food and something weird",
  },
  { label: "Quick escape", say: "Two hours, walking distance" },
];

export interface Adventure {
  readonly id: string;
  readonly title: string;
  readonly locality: string | null;
  readonly picture: string | null;
  readonly href: string | null;
  /** Which door found it, in /go's words. */
  readonly because: string;
}

export type Adventures =
  | { readonly ok: true; readonly adventures: readonly Adventure[] }
  | { readonly ok: false };

export async function vancouverAdventures(on: string): Promise<Adventures> {
  const vancouver = townById("vancouver");
  if (!vancouver) return { ok: false };
  let pool;
  try {
    pool = defaultFeed(
      (await listDiscoveryCandidates(undefined, on)).map(candidateToExperience),
    );
  } catch (error) {
    // An unreachable Atlas is said out loud on the page, not shown as "nothing to do".
    console.error("[sycle] Atlas read failed", error);
    return { ok: false };
  }
  const seen = new Set<string>();
  const adventures: Adventure[] = [];
  for (const door of DOORS) {
    const day = buildDay({
      pool,
      brief: readBrief(door.say, { town: vancouver, on }),
    });
    for (const stop of day.stops) {
      const e = stop.experience;
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      adventures.push({
        id: e.id,
        title: e.title,
        locality: e.geography?.locality ?? e.venue?.locality ?? null,
        picture: e.heroMedia?.src ?? null,
        href: destinationFor(e) ?? null,
        because: stop.because,
      });
    }
  }
  return { ok: true, adventures: adventures.slice(0, 9) };
}
