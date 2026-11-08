import {
  CATEGORY_LABEL,
  challengeById,
  type ChallengeCategory,
} from "./challenges";
import type { Person, SnowDay } from "./day";
import { bestCallers, predictionPoints } from "./predictions";

/**
 * **Friendly competition: derived, never stored.**
 *
 * Like the Experience Lab's leaderboard this is a pure function of what the
 * crew did — nothing writes a score — so un-ticking a challenge or removing
 * a photo corrects the table with no drift.
 *
 * Every point source is something safe and social: finishing a challenge
 * from the vetted list, showing up, a photo, a shared moment. There is no
 * source for speed, distance, vertical or difficulty, and so no way for the
 * table to pay for risk.
 */
export const POINTS = {
  /** Checking in to a meeting point at least once. */
  showedUp: 5,
  /** Per photo, capped. */
  photo: 3,
  photoCap: 3,
  /** Per shared moment, capped. */
  moment: 2,
  momentCap: 3,
} as const;

export interface Standing {
  readonly person: Person;
  readonly points: number;
  readonly byCategory: Readonly<Partial<Record<ChallengeCategory, number>>>;
  readonly challenges: number;
  readonly photos: number;
  readonly rank: number;
}

export function standings(day: SnowDay): Standing[] {
  const rows = day.people.map((person) => {
    const done = day.completions.filter((c) => c.personId === person.id);
    const byCategory: Partial<Record<ChallengeCategory, number>> = {};
    let points = 0;
    for (const c of done) {
      const ch = challengeById(c.challengeId, day.customChallenges);
      if (!ch) continue;
      points += ch.points;
      byCategory[ch.category] = (byCategory[ch.category] ?? 0) + ch.points;
    }
    const photos = day.photos.filter((p) => p.personId === person.id).length;
    const moments = day.moments.filter((m) => m.personId === person.id).length;
    if (day.checkIns.some((c) => c.personId === person.id) || done.length > 0)
      points += POINTS.showedUp;
    points += Math.min(photos, POINTS.photoCap) * POINTS.photo;
    points += Math.min(moments, POINTS.momentCap) * POINTS.moment;
    points += predictionPoints(day, person.id);
    return { person, points, byCategory, challenges: done.length, photos };
  });
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || a.person.name.localeCompare(b.person.name),
  );
  return sorted.map((row) => ({
    ...row,
    // Ties share a rank: nobody is "second" to a person on the same points.
    rank: sorted.findIndex((r) => r.points === row.points) + 1,
  }));
}

export interface Award {
  readonly id: string;
  readonly emoji: string;
  readonly title: string;
  readonly why: string;
  readonly winners: readonly Person[];
}

/**
 * Playful titles, given only where somebody actually earned one. Ties share.
 * No award exists for riding hardest, fastest or highest.
 */
export function awards(day: SnowDay): Award[] {
  const rows = standings(day);
  const out: Award[] = [];
  const top = (pick: (r: Standing) => number, min = 1): Person[] | null => {
    const best = Math.max(0, ...rows.map(pick));
    if (best < min) return null;
    return rows.filter((r) => pick(r) === best).map((r) => r.person);
  };
  const add = (
    id: string,
    emoji: string,
    title: string,
    why: string,
    winners: Person[] | null,
  ) => winners && out.push({ id, emoji, title, why, winners });

  add(
    "trail-boss",
    "🏔️",
    "Trail Boss",
    "Most challenges completed",
    top((r) => r.challenges),
  );
  add(
    "paparazzi",
    "📸",
    "Paparazzi",
    "Most photos shared",
    top((r) => r.photos),
  );
  add(
    "apres-mvp",
    "🍫",
    "Après MVP",
    `Most ${CATEGORY_LABEL.apres.toLowerCase()} points`,
    top((r) => r.byCategory.apres ?? 0),
  );
  add(
    "chief-hype",
    "🎉",
    "Chief Hype Officer",
    "Most moments shared",
    (() => {
      const n = (p: Person) =>
        day.moments.filter((m) => m.personId === p.id).length;
      const best = Math.max(0, ...day.people.map(n));
      return best > 0 ? day.people.filter((p) => n(p) === best) : null;
    })(),
  );
  add(
    "called-it",
    "🔮",
    "Called It",
    "Most predictions called right",
    (() => {
      const w = bestCallers(day);
      return w.length ? w : null;
    })(),
  );
  const count = (ids: readonly (string | undefined)[], p: Person) =>
    ids.filter((id) => id === p.id).length;
  const most = (ids: readonly (string | undefined)[]): Person[] | null => {
    // A title for the most of something needs someone to have more than.
    if (day.people.length < 2) return null;
    const n = (p: Person) => count(ids, p);
    const best = Math.max(0, ...day.people.map(n));
    return best > 0 ? day.people.filter((p) => n(p) === best) : null;
  };
  add(
    "dj-chairlift",
    "🎧",
    "DJ Chairlift",
    "Most songs for the drive up",
    most(day.playlist.map((s) => s.by)),
  );
  add(
    "social-director",
    "🗓️",
    "Social Director",
    "Most ideas put to the plan",
    most(day.proposals.map((p) => p.by)),
  );
  add(
    "chatterbox",
    "💬",
    "Chatterbox",
    "Most lines in the crew chat",
    most(day.chat.map((m) => m.by)),
  );
  add(
    "crew-spirit",
    "🤝",
    "Crew Spirit",
    "Most points for doing things together",
    top((r) => r.byCategory.group ?? 0),
  );
  add(
    "creative",
    "🎨",
    "Creative Director",
    "Most creative points",
    top((r) => r.byCategory.creative ?? 0),
  );
  return out;
}
