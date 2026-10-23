import type { DiscoveryCandidate } from "@/lib/data/types";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **Is this somewhere an ordinary group could eat before the game?**
 *
 * Atlas holds what a place *is*; whether a stranger can walk in on game day is
 * a judgement about the night, and Hockey makes it here, in one place, with the
 * evidence beside it. A pregame ballot offers places the whole group can
 * actually go to, so it never offers:
 *
 * - a lounge or club **inside the arena** that is sold with a ticket or a
 *   membership (premium hospitality, a ticket-holders' concourse bar);
 * - a place whose own stated hours say it is **not open on game day**
 *   (Atlas's `schedule.onDate` reading — a place shut on Sundays is not an
 *   option for a Sunday game);
 * - a coffee or tea counter: a pregame *meal* is not a latte (Atlas files
 *   them under Eat & drink, correctly, for Discovery);
 * - a place we hold **twice** under two names: one card, with the picture.
 *
 * The named places are Atlas ids, each with the reason and where it came from,
 * so a person can overturn one by deleting a line. Nothing here edits Atlas.
 */
export const NOT_FOR_PREGAME: Readonly<Record<string, string>> = {
  "3cd02b08-7743-47de-a027-dcba3ee853d0":
    "Konica Minolta Champions Club — premium all-inclusive club sold as a ticket (tickets.canucks.com/championsclub); not open to the public.",
  "c885fb10-9087-4e18-8a80-27d5829e0927":
    "Madrí Excepcional Lounge — the former Club 500, an exclusive members' space inside Rogers Arena for ticketed games (Canucks/Molson announcement, Oct 2026).",
  "204508dd-33eb-4b60-94a1-894f0c0650a3":
    "Molson Hockey House — a bar on the arena concourse (near section 119); reached through the gates with a game ticket, so not a place to eat before them.",
  "c0c158ec-8833-4b06-859c-c81a47dba659":
    "Rogers Studio Lounge — a lounge at the arena's own address (800 Griffiths Way) with no public-access evidence; treated as inside-the-gates hospitality.",
  "a9a6c008-6ba2-4c90-89d2-4b880dd51b4c":
    "Hoxton Gastown — a comedy, events and film-location venue rather than a restaurant, and its own website (hoxtongastown.com) is a disconnected Wix domain; not offered until someone confirms it is open.",
  "873697b3-5380-4f1d-84a9-50bfe917f8da":
    "Hoxton — the same business as Hoxton Gastown held under a second record (hoxtongastown.com); see that entry.",
  "903efe43-4789-4031-9a1f-948f8e052ae2":
    "Meat & Bread (Cambie) — a sandwich counter that states 'All days 8am–4pm' (meatandbread.com/cambie); shut before any evening game.",
  "b3ec9cd1-bd48-4cfc-9bf5-60393e0c0861":
    "Moxie's — the same restaurant as Moxies West Georgia (moxies.com/restaurants/west-georgia), held twice; the other record carries the picture.",
  "ba9588ab-c60e-4eb5-a9d6-a60477919dbf":
    "Pho Khanh Express — the same restaurant as KHANH EXPRESS (khanhexpress.ca), held twice; the other record carries the picture.",
};

/** The reason a place is not offered for a pregame meal, or `undefined` when it may be. */
export function notForPregame(
  candidate: DiscoveryCandidate,
): string | undefined {
  const named = NOT_FOR_PREGAME[candidate.id];
  if (named) return named;
  if (
    /^(cafe|café|coffee shop|coffee roaster|tea house|bubble tea)$/i.test(
      candidate.subtype ?? "",
    )
  )
    return "A coffee or tea counter, not a pregame meal.";
  if (candidate.schedule?.onDate?.reading === "not-on")
    return "Its stated hours do not cover game day.";
  return undefined;
}

const key = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * One venue held under two names ("Boston Pizza" / "Boston Pizza Stadium
 * District"): one name is the other plus more words, and the two stand within
 * 120 m. Different places that share a first word are further apart than that.
 */
export function sameVenue(
  a: { name: string; at?: readonly [number, number] },
  b: { name: string; at?: readonly [number, number] },
): boolean {
  if (!a.at || !b.at) return false;
  const [x, y] = [key(a.name), key(b.name)];
  const contained = x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
  if (!contained) return false;
  return (
    distanceKm(
      { latitude: a.at[0], longitude: a.at[1] },
      { latitude: b.at[0], longitude: b.at[1] },
    ) <= 0.12
  );
}
