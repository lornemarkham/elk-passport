import "server-only";
import { listRegions } from "@/lib/data/atlas-repo";
import type { GeographicScope } from "./geographicScope";

/**
 * **The one place Passport decides where it is looking.**
 *
 * Nothing else in Passport chooses a scope, and nothing else hardcodes a region
 * id or a region's name. Adding a viewport control, a radius control or a second
 * region changes this function and the thing that calls it — not the feed, not
 * search, not any card.
 *
 * ## Why it reads Atlas rather than holding a constant
 *
 * A uuid in the source would be the "Okanagan = Passport" assumption written
 * down, and a hardcoded label would be the same assumption wearing a nicer
 * costume. Atlas is the authority on which Regions exist and what they are
 * called, so the id and the label both come from there.
 *
 * ## What it does today, and what it will not do
 *
 * Exactly one Region exists, so that Region is the scope. **With more than one
 * and no explicit choice, it returns no scope rather than picking** — silently
 * choosing between two destinations is how a traveller ends up looking at the
 * wrong half of the product without being told. `ACTIVE_REGION_ID` makes the
 * choice explicit when that day comes.
 *
 * No regions, or Atlas unreachable, is also no scope: the whole corpus, which is
 * the behaviour that existed before scoping and is honest about knowing nothing
 * rather than guessing.
 */
export async function activeScope(): Promise<GeographicScope | undefined> {
  const regions = await listRegions();
  if (regions.length === 0) return undefined;

  const configured = process.env.ACTIVE_REGION_ID;
  const region = configured
    ? regions.find((r) => r.id === configured)
    : regions.length === 1
      ? regions[0]
      : undefined;

  if (!region) return undefined;
  return { kind: "atlas-region", regionId: region.id, label: region.name };
}
