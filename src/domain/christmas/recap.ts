import { challengeById, CHALLENGES } from "./challenges";

/**
 * **The recap: what this group actually did, and nothing else.**
 *
 * Built only from what people shared (moments, photos, finished challenges)
 * and the stops the plan kept. No line is generated to fill a gap: a recap
 * with two photos is a recap with two photos (doctrine §2.9; the guide's
 * "a section with no sourced content is left out", ADR 012 §6).
 */

export type MomentKind = "moment" | "tradition" | "challenge";

export interface Moment {
  readonly id: string;
  readonly kind: MomentKind;
  readonly text: string | null;
  /** Whether a photo is attached (the bytes are fetched separately). */
  readonly hasPhoto: boolean;
  readonly challengeId: string | null;
  readonly atlasRef: string | null;
  /** Who shared it, as the group sees them. */
  readonly by: string;
  readonly mine: boolean;
  readonly createdAt: string;
}

export interface Recap {
  readonly photos: number;
  readonly moments: number;
  readonly traditions: readonly Moment[];
  /** Each challenge somebody finished, first finish first. */
  readonly challenges: readonly {
    readonly id: string;
    readonly title: string;
    readonly emoji: string;
    readonly by: readonly string[];
  }[];
  /** Who finished how many, most first — a tally, not a leaderboard. */
  readonly tally: readonly { readonly name: string; readonly count: number }[];
  /** The words people wrote, newest last, for "favourite moments". */
  readonly favourites: readonly Moment[];
  /** Everyone who shared anything. */
  readonly sharers: readonly string[];
  readonly empty: boolean;
}

export function recapOf(moments: readonly Moment[]): Recap {
  const ordered = [...moments].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const finished = new Map<string, string[]>();
  const counts = new Map<string, Set<string>>();
  for (const m of ordered) {
    if (m.kind !== "challenge" || !challengeById(m.challengeId)) continue;
    const id = m.challengeId!;
    const by = finished.get(id) ?? [];
    if (!by.includes(m.by)) by.push(m.by);
    finished.set(id, by);
    counts.set(m.by, (counts.get(m.by) ?? new Set()).add(id));
  }
  const challenges = CHALLENGES.filter((c) => finished.has(c.id))
    .map((c) => ({
      id: c.id,
      title: c.title,
      emoji: c.emoji,
      by: finished.get(c.id)!,
    }))
    .sort(
      (a, b) =>
        ordered.findIndex((m) => m.challengeId === a.id) -
        ordered.findIndex((m) => m.challengeId === b.id),
    );
  const tally = [...counts.entries()]
    .map(([name, set]) => ({ name, count: set.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    photos: ordered.filter((m) => m.hasPhoto).length,
    moments: ordered.length,
    traditions: ordered.filter((m) => m.kind === "tradition"),
    challenges,
    tally,
    favourites: ordered.filter((m) => m.kind === "moment" && m.text?.trim()),
    sharers: [...new Set(ordered.map((m) => m.by))],
    empty: ordered.length === 0,
  };
}

/** The recap's headline, from counts only. */
export function recapLine(recap: Recap): string {
  if (recap.empty) return "Nothing shared yet — the first photo starts it.";
  const bits = [
    recap.photos ? `${recap.photos} photo${recap.photos === 1 ? "" : "s"}` : "",
    recap.challenges.length
      ? `${recap.challenges.length} challenge${recap.challenges.length === 1 ? "" : "s"} done`
      : "",
    recap.traditions.length
      ? `${recap.traditions.length} tradition${recap.traditions.length === 1 ? "" : "s"}`
      : "",
  ].filter(Boolean);
  const who =
    recap.sharers.length === 1
      ? `shared by ${recap.sharers[0]}`
      : `shared by ${recap.sharers.length} of you`;
  return `${bits.length ? bits.join(" · ") : `${recap.moments} moments`} — ${who}.`;
}
