import {
  filled,
  partnerIn,
  playedMinutes,
  teamOf,
  type Club,
  type Session,
} from "./model";

/**
 * **A player's history, read back out of the nights.** Nothing here is a
 * stored counter: games, wins and losses are counted from the finished games
 * and their scores, which are kept for good. (Owner decision 2026-11-12: the
 * real night records scores and shows wins and losses; there is still no
 * ranking — the club table is alphabetical.)
 */
export interface PlayerStats {
  readonly attended: number;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly minutes: number;
  /** Different people they have partnered. */
  readonly partners: number;
  readonly kudos: number;
}

export function playerStats(
  _club: Club,
  sessions: readonly Session[],
  id: string,
): PlayerStats {
  const partners = new Set<string>();
  let attended = 0,
    wins = 0,
    losses = 0,
    games = 0,
    minutes = 0,
    kudos = 0;
  for (const s of sessions) {
    const roster = s.roster.find((r) => r.playerId === id);
    if (s.present[id] && roster?.status !== "no-show") attended += 1;
    for (const g of s.games) {
      if (g.status !== "finished" || !g.slots.includes(id)) continue;
      games += 1;
      const team = teamOf(g, id);
      if (g.winner !== undefined && team !== null) {
        if (g.winner === team) wins += 1;
        else losses += 1;
      }
      minutes += playedMinutes(g);
      const p = partnerIn(g, id);
      if (p) partners.add(p);
      kudos += g.kudos.filter((x) => x.to === id).length;
    }
  }
  return {
    attended,
    games,
    wins,
    losses,
    minutes,
    partners: partners.size,
    kudos,
  };
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

export interface ClubRow {
  readonly id: string;
  readonly name: string;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
}

/**
 * Everyone who has played a finished game, with games, wins and losses. In
 * name order on purpose: it is a record to look things up in, not a ladder.
 */
export function clubTable(club: Club, sessions: readonly Session[]): ClubRow[] {
  const rows = new Map<
    string,
    { games: number; wins: number; losses: number }
  >();
  for (const s of sessions)
    for (const g of s.games) {
      if (g.status !== "finished") continue;
      for (const id of filled(g.slots)) {
        const r = rows.get(id) ?? { games: 0, wins: 0, losses: 0 };
        r.games += 1;
        const team = teamOf(g, id);
        if (g.winner !== undefined && team !== null) {
          if (g.winner === team) r.wins += 1;
          else r.losses += 1;
        }
        rows.set(id, r);
      }
    }
  return [...rows.entries()]
    .map(([id, r]) => ({ id, name: club.players[id]?.name ?? "?", ...r }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
