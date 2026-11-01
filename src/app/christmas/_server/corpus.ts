import "server-only";
import {
  listDiscoveryCandidates,
  listDiscoveryDistances,
} from "@/lib/data/atlas-repo";
import { isAtlasUnavailable, type AtlasFailure } from "@/lib/data/atlasAuth";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { townById } from "@/domain/discovery/towns";
import {
  askedDay,
  findsIn,
  youngest,
  type Ask,
  type Find,
} from "@/domain/christmas/discover";

/**
 * **Christmas reads Atlas the way Discovery does** — the same cached corpus
 * read (`listDiscoveryCandidates`, with `childAge` and `on` only when somebody
 * said them), the same distance reading from a town (ADR 094), the same
 * mapper. Christmas adds no Atlas call of its own and keeps no copy: what it
 * shows is Atlas's answer, read through `findsIn`.
 */
export async function christmasFinds(
  ask: Pick<Ask, "at" | "km" | "ages" | "from" | "to">,
  today: string,
): Promise<{ readonly finds: Find[]; readonly outage?: AtlasFailure }> {
  const fullAsk = { ...ask, themes: [], budget: "any" as const };
  try {
    const town = townById(ask.at);
    const [candidates, distances] = await Promise.all([
      listDiscoveryCandidates(youngest(fullAsk), askedDay(fullAsk)),
      town
        ? listDiscoveryDistances(town.latitude, town.longitude, ask.km).catch(
            () => null,
          )
        : Promise.resolve(null),
    ]);
    const experiences = candidates.map((c) => {
      const e = candidateToExperience(c);
      const reading = distances?.distances[c.id];
      return reading ? { ...e, distance: reading } : e;
    });
    return { finds: findsIn(experiences, today) };
  } catch (error) {
    const outage = isAtlasUnavailable(error) ? error.reason : "unreachable";
    console.error(
      `[atlas] christmas candidates unavailable (${outage}):`,
      error instanceof Error ? error.message : error,
    );
    return { finds: [], outage };
  }
}
