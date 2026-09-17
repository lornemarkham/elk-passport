import { Flame } from "lucide-react";
import type { PlaceSectionProps } from "./types";
import { asOfCaption } from "./asOf";

/**
 * Not one of the registry sections in `sections.tsx` — this is a real,
 * live-condition alert (`Place.hasActiveFireBan`), not a growable content
 * section, and it's placed right after the hero rather than mid-page for
 * that reason: a safety-relevant, time-sensitive fact belongs above the
 * fold, not somewhere a traveler has to scroll to confirm. Not in the
 * page structure you listed explicitly, but Atlas has genuinely tracked
 * this since Phase 1.5, and "does Atlas know this? if yes, show it" is
 * the whole point of this page — leaving out a real fire-ban fact Atlas
 * already has would contradict that more than adding one banner does.
 *
 * Renders only when `true` — `false`/`undefined` both render nothing,
 * matching `hasActiveFireBan`'s own documented rule: undefined means "not
 * reported," never "no ban," and a quiet `false` doesn't need a loud
 * confirmation banner the way an active ban does.
 *
 * Whether the value is *current* is Atlas's decision, not this component's
 * (Atlas ADR 072): a reading older than its freshness window never arrives
 * in `place`, and one that does is shown with the date it was read.
 */
export function PlaceFireBanNotice({ place, temporal }: PlaceSectionProps) {
  if (place.hasActiveFireBan !== true) return null;
  const asOf = asOfCaption(temporal, "hasActiveFireBan");

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-300">
      <Flame className="h-4 w-4 shrink-0" />
      <span className="font-medium">
        A fire ban is currently in effect at this location.
      </span>
      {asOf && <span className="text-xs opacity-80">{asOf}</span>}
    </div>
  );
}
