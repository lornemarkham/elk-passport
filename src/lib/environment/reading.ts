import "server-only";
import type { OctoberPlace } from "@/domain/environment/places";
import type { Environment } from "@/domain/environment/types";
import { mscProvider } from "./msc";

/**
 * **The single place the product decides whether it has a forecast at all.**
 *
 * `WEATHER_PROVIDER` is unset by default and nothing calls out. Darkness,
 * sunset and moon still work — they are arithmetic — so October notices the
 * world either way, and the only thing a missing provider removes is the sky
 * and the rain.
 *
 * It is off by default because depending on an outside service is a decision
 * somebody makes, not something a slice does on its way past. Setting
 * `WEATHER_PROVIDER=msc` turns on Environment Canada, which needs no key and
 * no account; the licence (Open Government Licence – Canada) requires
 * attribution, which `Provenance.source` carries to the surface.
 *
 * Failure is always the same shape as having no provider: an empty map, and
 * every interpretation returns `undefined`, and October says nothing. There is
 * no error state to render because there is nothing a person could do about
 * it, and an apology where a sky should be is worse than a quiet page.
 */
export async function environmentFor(
  areas: readonly OctoberPlace[],
): Promise<ReadonlyMap<string, Environment>> {
  if (process.env.WEATHER_PROVIDER !== "msc" || areas.length === 0) {
    return new Map();
  }
  // Deduplicated before it leaves: two saved things in Vernon are one request.
  const unique = [...new Map(areas.map((a) => [a.id, a])).values()];
  try {
    return await mscProvider().forecast(unique);
  } catch {
    return new Map();
  }
}
