import type { CautionId } from "./types";

/**
 * **What an idea needs checked before it is real.**
 *
 * Date Night does not know the ice, the fire rating, the avalanche danger,
 * the season or the road, and it does not pretend to. For each kind of risk
 * it says what to check and where the official answer lives — the sources
 * people already trust, linked rather than summarised, so the invitation
 * never states a condition that was true when somebody typed it.
 */
export interface Caution {
  readonly id: CautionId;
  /** A short label for the chip on the idea. */
  readonly label: string;
  /** What to check, plainly. Never "it's safe". */
  readonly check: string;
  readonly source?: { readonly name: string; readonly url: string };
}

export const CAUTIONS: Readonly<Record<CautionId, Caution>> = {
  "cold-water": {
    id: "cold-water",
    label: "Cold water",
    check:
      "Cold water takes your breath first. Go in together, never alone, ease in, keep it short, and have warm layers waiting. Nobody here has checked the water or any ice — look at it there, and don't stand on ice nobody has measured.",
    source: {
      name: "Lifesaving Society BC & Yukon",
      url: "https://www.lifesaving.bc.ca/",
    },
  },
  fire: {
    id: "fire",
    label: "Fire rules",
    check:
      "Check open-fire bans and restrictions for the area on the day, and any local bylaw. Have water on hand and put it out cold.",
    source: {
      name: "BC Wildfire Service — fire bans and restrictions",
      url: "https://www2.gov.bc.ca/gov/content/safety/wildfire-status/fire-bans-and-restrictions",
    },
  },
  hunting: {
    id: "hunting",
    label: "Licences & season",
    check:
      "Hunting needs valid licences, an open season for the species in that management unit, and the area's own rules. Check the current regulations before planning on it.",
    source: {
      name: "BC Hunting & Trapping Regulations Synopsis",
      url: "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/hunting/regulations-synopsis",
    },
  },
  "backcountry-snow": {
    id: "backcountry-snow",
    label: "Avalanche & snow",
    check:
      "Early-season snow can hide rocks and creeks, and avalanche terrain needs the forecast, training and gear. Check the avalanche forecast and whether there is enough snow at all.",
    source: { name: "Avalanche Canada", url: "https://avalanche.ca/map" },
  },
  "forest-roads": {
    id: "forest-roads",
    label: "Roads & access",
    check:
      "Forest service roads change with the weather and some close. Check the road report, tell someone where you're going, and turn around if it's not right.",
    source: { name: "DriveBC", url: "https://www.drivebc.ca/" },
  },
  "unverified-place": {
    id: "unverified-place",
    label: "Check it's open",
    check:
      "Passport has no hours, access or conditions for this place. Check with them directly before you go.",
  },
};

export function cautionsFor(
  ids: readonly CautionId[] | undefined,
): readonly Caution[] {
  return (ids ?? []).map((id) => CAUTIONS[id]);
}
