import type { Experience } from "@/domain/experience/types";
import { readOccasion, roleOf } from "@/domain/occasion/occasion";
import { findPlacesFor } from "@/domain/occasion/ideas";
import { statedCloseOn, clockWords } from "@/domain/occasion/hours";
import { CHALLENGES, type Challenge } from "./challenges";
import { readChristmas, type ThemeId } from "./themes";
import { readWhen } from "./when";

/**
 * **A few dares that fit this adventure, with somewhere real to do them.**
 *
 * Twelve challenge cards in a grid was a wall. An adventure leads with at
 * most three, chosen for who is going (no Santa question for two adults on a
 * date) and for what Atlas actually holds near it on its days — "Find the
 * best Christmas lights" points at light displays Atlas dates inside the
 * adventure, "Rank the hot chocolate" at cafés and chocolate shops nearby,
 * "Get on the ice" at rinks that list public skating. Where Atlas holds
 * nothing for a dare, the dare still stands and says so; Passport never
 * points at a private house or invents a display.
 */

export interface ChallengePlace {
  readonly id: string;
  readonly title: string;
  readonly km?: number;
  /** Why this place, from Atlas's words — "Dates from Atlas: Dec 12". */
  readonly because: string;
}

export interface ChallengePick {
  readonly challenge: Challenge;
  /** Why this dare leads, for these people. */
  readonly why: string;
  readonly places: readonly ChallengePlace[];
  /** What Atlas does not hold for it, said plainly. */
  readonly gap?: string;
}

export interface PickContext {
  /** Everything the adventure's days were asked with, joined. */
  readonly said: string;
  readonly origin?: { readonly latitude: number; readonly longitude: number };
  readonly town?: string;
  readonly from?: string;
  readonly to?: string;
  readonly pool: readonly Experience[];
  /** Ids already on the adventure: not offered again. */
  readonly held: ReadonlySet<string>;
}

const km = (
  a: { latitude: number; longitude: number },
  e: Experience,
): number | undefined => {
  const c = e.geography?.coordinates;
  if (!c) return undefined;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(c[1] - a.latitude);
  const dLon = toRad(c[0] - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(c[1])) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
};

const RADIUS = 60;

/** Christmas finds of one theme that Atlas dates inside the adventure. */
function themed(theme: ThemeId, context: PickContext): ChallengePlace[] {
  const out: (ChallengePlace & { order: number })[] = [];
  for (const e of context.pool) {
    if (context.held.has(e.id)) continue;
    const reading = readChristmas(e);
    if (!reading?.themes.includes(theme)) continue;
    const when = readWhen(e, context.from ?? "2026-11-01");
    if (when.confidence !== "dated" || !when.from || !when.to) continue;
    const from = context.from ?? when.from;
    const to = context.to ?? context.from ?? when.to;
    if (when.from > to || when.to < from) continue;
    const away = context.origin ? km(context.origin, e) : undefined;
    if (away !== undefined && away > RADIUS) continue;
    if (
      away === undefined &&
      context.town &&
      e.geography?.locality !== context.town
    )
      continue;
    out.push({
      id: e.id,
      title: e.title,
      ...(away !== undefined ? { km: away } : {}),
      because: `Dates from Atlas: ${when.line ?? `${when.from} – ${when.to}`}`,
      order: away ?? RADIUS,
    });
  }
  return out
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.title,
      ...(p.km !== undefined ? { km: p.km } : {}),
      because: p.because,
    }));
}

/** Cafés, bakeries and chocolate shops near the adventure, open by their own hours where stated. */
function treats(context: PickContext, warm: boolean): ChallengePlace[] {
  if (!context.origin) return [];
  const out: (ChallengePlace & { order: number })[] = [];
  for (const e of context.pool) {
    if (context.held.has(e.id) || roleOf(e) !== "treat") continue;
    const s = (e.subtype ?? "").toLowerCase();
    if (warm && /bakery|donut|ice cream|gelato/.test(s)) continue;
    if (!warm && /coffee|espresso/.test(s) && !/bakery|pastry/.test(s))
      continue;
    const away = km(context.origin, e);
    if (away === undefined || away > 25) continue;
    const close = context.from ? statedCloseOn(e, context.from) : undefined;
    if (close?.closed) continue;
    out.push({
      id: e.id,
      title: e.title,
      km: away,
      because: close
        ? `A ${s.replace(/_/g, " ")} — open till ${clockWords(close.minutes)} that day, by its own hours`
        : `A ${s.replace(/_/g, " ")} — Atlas has no menu or hours for it`,
      // Somewhere with stated hours, and with a picture, first.
      order: away - (close ? 5 : 0) - (e.heroMedia?.src ? 2 : 0),
    });
  }
  return out
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.title,
      ...(p.km !== undefined ? { km: p.km } : {}),
      because: p.because,
    }));
}

function ice(context: PickContext): ChallengePlace[] {
  const found = findPlacesFor("ice skating", context.pool, {
    ...(context.origin ? { origin: context.origin } : {}),
    ...(context.town ? { town: context.town } : {}),
    ...(context.from ? { on: context.from } : {}),
    km: 30,
    limit: 3,
  });
  return found.options
    .filter((o) => !context.held.has(o.experience.id))
    .map((o) => ({
      id: o.experience.id,
      title: o.experience.title,
      ...(o.km !== undefined ? { km: o.km } : {}),
      because:
        o.onTheDay ??
        `Atlas lists “${o.listed[0]}” — public-skate times aren't in Atlas, so check first`,
    }));
}

/**
 * **The dares for this adventure** — at most `limit`, best first. Every
 * dare is still available below them; this only decides what leads.
 */
export function pickChallenges(
  context: PickContext,
  limit = 3,
): readonly ChallengePick[] {
  const occasion = readOccasion(context.said);
  const moods = new Set(occasion?.moods ?? []);
  const wants = new Set((occasion?.wants ?? []).map((w) => w.id));
  const kids = moods.has("family");
  const couple =
    moods.has("romantic") ||
    /\bthe two of us\b|\bmy (wife|husband|partner)\b/i.test(context.said);

  const scored = CHALLENGES.flatMap((challenge) => {
    // Some dares are for children; a date is not a family day.
    if (challenge.id === "santa-question" && !kids) return [];
    if (challenge.id === "make-something" && !kids) return [];
    if (challenge.id === "tradition" && couple && !kids) return [];
    let places: ChallengePlace[] = [];
    let gap: string | undefined;
    let score = 0;
    let why = "";
    switch (challenge.id) {
      case "best-lights":
        places = themed("lights", context);
        score = wants.has("lights") ? 6 : 2;
        why = wants.has("lights")
          ? "You asked for Christmas lights."
          : "The season's best free show.";
        if (places.length === 0)
          gap = `Atlas has no light display dated near ${context.town ?? "here"} for these days — this one works on any lit-up street you pass. Passport won't point at anyone's house.`;
        break;
      case "market":
        places = themed("markets", context);
        score = wants.has("market") ? 6 : places.length > 0 ? 3 : -2;
        why = "A market on your dates, by Atlas.";
        break;
      case "santa-question":
        places = themed("santa", context);
        score = kids ? (places.length > 0 ? 6 : 2) : 0;
        why = "For the youngest.";
        break;
      case "hot-chocolate":
        places = treats(context, true);
        score = wants.has("warm-drink") ? 7 : couple || kids ? 3 : 2;
        why = wants.has("warm-drink")
          ? "You asked for something warm to drink."
          : "Every stop gets a score.";
        break;
      case "new-treat":
        places = treats(context, false);
        score = wants.has("sweet") ? 6 : kids ? 2 : 1;
        why = "Somewhere to find a treat none of you has had.";
        break;
      case "on-the-ice":
        places = ice(context);
        score =
          places.length > 0
            ? wants.has("snow") || couple || kids
              ? 5
              : 3
            : -2;
        why = couple
          ? "Holding hands on the ice is mandatory."
          : "Falling over counts double.";
        break;
      case "carol":
        places = themed("shows", context);
        score = kids ? 2 : 1;
        why = "The car counts.";
        break;
      case "group-photo":
        score = kids ? 3 : moods.has("lively") ? 3 : 1;
        why = couple ? "The two of you, one good one." : "Everyone in it.";
        break;
      case "new-tradition":
        score = couple ? 3 : 1;
        why = couple
          ? "Your first one together, maybe."
          : "If you'd do it again, it counts.";
        break;
      case "kindness":
        score = 1;
        why = "Quiet, and the best one.";
        break;
      default:
        score = kids && challenge.kids ? 1 : 0;
        why = "";
    }
    // A dare with real places to do it leads over one without.
    if (places.length > 0) score += 2;
    return [{ challenge, why, places, ...(gap ? { gap } : {}), score }];
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      challenge: s.challenge,
      why: s.why,
      places: s.places,
      ...(s.gap ? { gap: s.gap } : {}),
    }));
}
