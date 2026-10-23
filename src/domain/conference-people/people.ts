import { z } from "zod";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **Find my people: where your coworkers are, because they said so, for now.**
 *
 * This is the one place Passport keeps a person's position, and it does so
 * only on the terms in ADR 011 (an owner decision of 2026-10-23 that narrows
 * ADR 002 and VISION §6 for this one case):
 *
 * - **Opt-in.** Nothing is shared until the person presses Share, and only
 *   people who chose to be seen in the conference can share.
 * - **Time-limited.** Every share ends by itself: 15 minutes to 4 hours,
 *   chosen up front. The database refuses anything longer, and refuses to
 *   show a position past its end.
 * - **Immediately revocable.** Stop deletes the row. Not hidden; gone.
 * - **Members only.** Coworkers in this conference, and nobody else.
 * - **Rounded.** Four decimal places (about 11 m): enough to find a person on
 *   a sidewalk, not enough to say which table they are at.
 *
 * Arena Mode's check-ins on Hockey Night are the precedent for the consent
 * shape (a window, purge, vanish any time); they use places from a map
 * rather than coordinates, which a city can't offer.
 */

export const SHARE_MINUTES = [15, 30, 60, 120, 240] as const;
export type ShareMinutes = (typeof SHARE_MINUTES)[number];

/** About 11 m. */
export const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

const coord = {
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).nullable().optional(),
};

export const ShareSchema = z.object({
  ...coord,
  minutes: z
    .number()
    .refine(
      (m): m is ShareMinutes => SHARE_MINUTES.includes(m as ShareMinutes),
      {
        message: "15 minutes to 4 hours",
      },
    ),
  note: z.string().trim().max(60).optional().default(""),
});

export const MoveSchema = z.object(coord);

export interface Location {
  readonly conferenceId: string;
  readonly memberId: string;
  readonly lat: number;
  readonly lon: number;
  /** Metres, as the phone reported it; capped for storage. */
  readonly accuracyM: number | null;
  readonly note: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

export interface PersonHere {
  readonly memberId: string;
  readonly name: string;
  readonly you: boolean;
  readonly at: readonly [number, number];
  readonly accuracyM: number | null;
  readonly note: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  /** Straight line from you, when you are sharing too. */
  readonly kmFromYou: number | null;
}

export const live = (l: Location, now: Date) =>
  Date.parse(l.expiresAt) > now.getTime();

/** Who's on the map for this viewer: unexpired, named, you first, then nearest. */
export function peopleHere(
  locations: readonly Location[],
  you: string,
  named: ReadonlyMap<string, string>,
  now: Date,
): PersonHere[] {
  const mine = locations.find((l) => l.memberId === you && live(l, now));
  const out: PersonHere[] = [];
  for (const l of locations) {
    if (!live(l, now)) continue;
    const isYou = l.memberId === you;
    const name = isYou ? "You" : named.get(l.memberId);
    // Someone who stopped being seen stops being on the map, at once.
    if (!name) continue;
    out.push({
      memberId: l.memberId,
      name,
      you: isYou,
      at: [l.lat, l.lon],
      accuracyM: l.accuracyM,
      note: l.note,
      updatedAt: l.updatedAt,
      expiresAt: l.expiresAt,
      kmFromYou:
        mine && !isYou
          ? distanceKm(
              { latitude: mine.lat, longitude: mine.lon },
              { latitude: l.lat, longitude: l.lon },
            )
          : null,
    });
  }
  return out.sort(
    (a, b) =>
      Number(b.you) - Number(a.you) ||
      (a.kmFromYou ?? Infinity) - (b.kmFromYou ?? Infinity) ||
      a.name.localeCompare(b.name),
  );
}

/** "a minute ago", "4 min ago": how fresh a position is, said every time. */
export function freshness(updatedAt: string, now: Date): string {
  const s = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(updatedAt)) / 1000),
  );
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  return m === 1 ? "a minute ago" : `${m} min ago`;
}
