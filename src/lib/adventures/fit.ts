import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import {
  savedForAdventure,
  type SavedForAdventure,
} from "@/domain/occasion/saved";
import type { AdventureView } from "./store";

/** Every sentence the adventure's days were asked with — its occasion, in words. */
export function adventureSaid(view: AdventureView): string {
  return [
    view.title,
    ...view.days.map((d) => new URLSearchParams(d.ask).get("say") ?? ""),
  ]
    .filter(Boolean)
    .join(". ");
}

/** Where and when the adventure is, as the occasion helpers read it. */
export function adventureFrame(view: AdventureView) {
  const town = townById(view.destinationTownId ?? undefined);
  return {
    said: adventureSaid(view),
    ...(town
      ? {
          origin: { latitude: town.latitude, longitude: town.longitude },
          town: town.name.replace(/,\s*BC$/, ""),
        }
      : {}),
    ...(view.startsOn ? { from: view.startsOn } : {}),
    ...((view.endsOn ?? view.startsOn)
      ? { to: (view.endsOn ?? view.startsOn)! }
      : {}),
  };
}

/** The person's saved places this adventure doesn't hold, fitting ones first. */
export function savedFor(
  view: AdventureView,
  saved: readonly Experience[],
): SavedForAdventure {
  const held = new Set(
    view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
  );
  return savedForAdventure(
    saved.filter((e) => !held.has(e.id)),
    adventureFrame(view),
  );
}
