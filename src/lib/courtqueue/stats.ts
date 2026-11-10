import {
  filled,
  isBeginnerRated,
  partnerIn,
  playedMinutes,
  teamOf,
  type Club,
  type Session,
  type SkillChange,
} from "./model";

/**
 * **A player's history, read back out of the nights.** Nothing here is a
 * stored counter: a corrected start time or score changes the totals the
 * next time they are read.
 *
 * Participation points reward taking part, never winning, and say nothing
 * about skill:
 */
export const POINTS = {
  attended: 10,
  game: 3,
  newPartner: 2,
  /** A volunteer mentor (Advanced or Expert) partnering a beginner. */
  mentoring: 4,
  kudos: 2,
  award: 5,
} as const;

export interface PlayerStats {
  readonly attended: number;
  readonly games: number;
  readonly minutes: number;
  readonly wins: number;
  readonly losses: number;
  /** Whole percent of games with a result, or null before any. */
  readonly winPct: number | null;
  readonly partners: number;
  readonly mentoredGames: number;
  readonly kudos: number;
  readonly awards: number;
  readonly points: number;
  readonly skillHistory: readonly SkillChange[];
}

export function playerStats(
  club: Club,
  sessions: readonly Session[],
  id: string,
): PlayerStats {
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const partners = new Set<string>();
  let attended = 0,
    games = 0,
    minutes = 0,
    wins = 0,
    losses = 0,
    mentoredGames = 0,
    kudos = 0,
    awards = 0,
    points = 0;
  const me = club.players[id];
  for (const s of ordered) {
    const roster = s.roster.find((r) => r.playerId === id);
    if (s.present[id] && roster?.status !== "no-show") {
      attended += 1;
      points += POINTS.attended;
    }
    const finished = s.games
      .filter((g) => g.status === "finished" && g.slots.includes(id))
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
    for (const g of finished) {
      games += 1;
      points += POINTS.game;
      minutes += playedMinutes(g);
      const p = partnerIn(g, id);
      if (p && !partners.has(p)) {
        partners.add(p);
        points += POINTS.newPartner;
      }
      if (g.winner !== undefined) {
        if (teamOf(g, id) === g.winner) wins += 1;
        else losses += 1;
      }
      const partner = p ? club.players[p] : undefined;
      if (
        me?.mentor &&
        me.skill >= 4 &&
        partner &&
        isBeginnerRated(partner.skill)
      ) {
        mentoredGames += 1;
        points += POINTS.mentoring;
      }
      const k = g.kudos.filter((x) => x.to === id).length;
      kudos += k;
      points += k * POINTS.kudos;
    }
    const a = s.awards.filter((x) => x.to === id).length;
    awards += a;
    points += a * POINTS.award;
  }
  const decided = wins + losses;
  return {
    attended,
    games,
    minutes,
    wins,
    losses,
    winPct: decided ? Math.round((100 * wins) / decided) : null,
    partners: partners.size,
    mentoredGames,
    kudos,
    awards,
    points,
    skillHistory: me?.skillHistory ?? [],
  };
}

/**
 * A nudge for the organizer, never a promotion: someone winning most of a
 * fair number of games against their level may be ready for the next one.
 */
export function promotionHint(stats: PlayerStats): string | null {
  const decided = stats.wins + stats.losses;
  if (decided >= 8 && (stats.winPct ?? 0) >= 70)
    return `Won ${stats.wins} of ${decided} — maybe ready for the next level`;
  return null;
}

/** Everyone who played tonight, for the organizer's fairness check. */
export function nightBalance(club: Club, s: Session) {
  const rows = new Map<string, { games: number; minutes: number }>();
  for (const id of Object.keys(s.present))
    rows.set(id, { games: 0, minutes: 0 });
  for (const g of s.games) {
    if (g.status !== "finished") continue;
    for (const id of filled(g.slots)) {
      const r = rows.get(id) ?? { games: 0, minutes: 0 };
      r.games += 1;
      r.minutes += playedMinutes(g);
      rows.set(id, r);
    }
  }
  return [...rows.entries()]
    .map(([id, r]) => ({ id, name: club.players[id]?.name ?? "?", ...r }))
    .sort((a, b) => a.games - b.games || a.minutes - b.minutes);
}
