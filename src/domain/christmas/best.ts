import type { Find } from "./discover";
import type { ThemeId } from "./themes";

/**
 * **The season's best, by kind** — the big Christmas things the front page
 * names (owner brief M1064: Holiday Train, lights, Santa, markets, live
 * performances, winter activities, Christmas movies, at-home adventures),
 * each counted from what Discovery already places within the radius.
 *
 * Counts are Atlas's listings and the community's checked displays, never a
 * guess. Movies and a night in carry no count: they need no listing, and say
 * what they are instead. The Holiday Train is a winter festival (`themes`),
 * so it is counted there the day Atlas lists a stop.
 */
export type BestId = ThemeId | "free" | "movies" | "home";

export interface Best {
  readonly id: BestId;
  readonly label: string;
  readonly emoji: string;
  /** How many are placed within the radius; absent where nothing is listed. */
  readonly count?: number;
  /** What a tile without a count says. */
  readonly line?: string;
}

const KINDS: readonly {
  id: BestId;
  label: string;
  emoji: string;
  line?: string;
}[] = [
  { id: "lights", label: "Christmas lights", emoji: "✨" },
  { id: "santa", label: "Santa", emoji: "🎅" },
  { id: "markets", label: "Christmas markets", emoji: "🎪" },
  { id: "shows", label: "Live shows & carols", emoji: "🎭" },
  { id: "festivals", label: "Festivals & the Holiday Train", emoji: "🚂" },
  { id: "winter", label: "Winter fun", emoji: "⛸️" },
  { id: "free", label: "Free", emoji: "🎁" },
  {
    id: "movies",
    label: "Christmas movies",
    emoji: "🎬",
    line: "Pick tonight's film",
  },
  {
    id: "home",
    label: "A night in",
    emoji: "☕",
    line: "Baking, games, cocoa",
  },
];

export function seasonsBest(near: readonly Find[], lightPins: number): Best[] {
  return KINDS.map((k) => {
    if (k.line)
      return { id: k.id, label: k.label, emoji: k.emoji, line: k.line };
    const count =
      k.id === "free"
        ? near.filter((f) => f.free).length
        : near.filter((f) => f.reading.themes.includes(k.id as ThemeId))
            .length + (k.id === "lights" ? lightPins : 0);
    return { id: k.id, label: k.label, emoji: k.emoji, count };
  });
}
