import {
  filled,
  partnerIn,
  playedMinutes,
  type Club,
  type Session,
} from "./model";

/**
 * **A player's own history, read back out of the nights.** Nothing here is a
 * stored counter. It is participation only — nights, games, people met,
 * shout-outs — and is shown to that player alone: no wins or losses, no
 * points, no board, nothing that ranks one person against another.
 */
export interface PlayerStats {
  readonly attended: number;
  readonly games: number;
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
    games = 0,
    minutes = 0,
    kudos = 0;
  for (const s of sessions) {
    const roster = s.roster.find((r) => r.playerId === id);
    if (s.present[id] && roster?.status !== "no-show") attended += 1;
    for (const g of s.games) {
      if (g.status !== "finished" || !g.slots.includes(id)) continue;
      games += 1;
      minutes += playedMinutes(g);
      const p = partnerIn(g, id);
      if (p) partners.add(p);
      kudos += g.kudos.filter((x) => x.to === id).length;
    }
  }
  return { attended, games, minutes, partners: partners.size, kudos };
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
