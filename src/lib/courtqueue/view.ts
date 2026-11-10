import { localDate } from "./clock";
import {
  estimateWaitMinutes,
  inOrder,
  tonight,
  typicalGameMinutes,
} from "./fair";
import {
  MINUTE,
  SKILL_NAMES,
  filled,
  isActiveGame,
  isHeldChallenge,
  playedMinutes,
  type Challenge,
  type Club,
  type Court,
  type Game,
  type GameStatus,
  type RosterStatus,
  type Rules,
  type Session,
  type SessionStatus,
  type Skill,
} from "./model";
import { nightBalance } from "./stats";

/**
 * **What one phone is shown.** Built on the server for the person asking, so
 * nothing private travels: no PINs or tokens, and nobody else's games or
 * minutes — the queue is names in order, never a table of who has played
 * how much. The organizer's phone gets the operational numbers as well.
 */

export interface PersonView {
  readonly id: string;
  readonly name: string;
  readonly skill: Skill;
  readonly photo: boolean;
  readonly mentor: boolean;
}

export interface GameView {
  readonly id: string;
  readonly court: number;
  readonly status: GameStatus;
  readonly source: Game["source"];
  readonly slots: (PersonView | null)[];
  readonly why: readonly string[];
  readonly calledAt: number;
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
  readonly minutes: number | null;
  readonly startEstimated: boolean;
  readonly endEstimated: boolean;
  readonly score: [number, number] | null;
  readonly winner: 0 | 1 | null;
  readonly scoreBy: string | null;
  readonly confirmedBy: string | null;
  readonly disputedBy: string | null;
  readonly accepted: readonly string[];
  readonly kudosFrom: readonly string[];
}

export interface ChallengeView {
  readonly id: string;
  readonly by: string;
  readonly slots: PersonView[];
  readonly accepted: readonly string[];
  readonly status: Challenge["status"];
  readonly readyAt: number | null;
}

export type MyState =
  "away" | "idle" | "queued" | "challenge" | "called" | "playing" | "left";

export interface NightView {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  readonly status: SessionStatus;
  readonly registrationOpen: boolean;
  readonly capacity: number;
  readonly confirmed: number;
  readonly waitlisted: number;
  readonly courts: {
    readonly id: number;
    readonly name: string;
    readonly where: string;
    readonly kind: Court["kind"];
    /** Who may play here, in words. */
    readonly rule: string;
    readonly closed: boolean;
    readonly game: GameView | null;
  }[];
  readonly queue: { readonly person: PersonView; readonly since: number }[];
  readonly present: PersonView[];
  readonly recent: GameView[];
  readonly challenges: ChallengeView[];
  readonly readyChallenges: number;
  readonly typicalMinutes: number;
  readonly me: {
    readonly roster: RosterStatus | null;
    readonly waitlistPosition: number | null;
    readonly state: MyState;
    readonly autoRequeue: boolean;
    readonly queuePosition: number | null;
    readonly queuedSince: number | null;
    readonly estimateMin: number | null;
    readonly games: number;
    readonly minutes: number;
    readonly game: GameView | null;
    /** Finished tonight, newest first: for scores, confirming and kudos. */
    readonly played: GameView[];
  } | null;
}

export interface SessionListing {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  readonly status: SessionStatus;
  readonly registrationOpen: boolean;
  readonly capacity: number;
  readonly confirmed: number;
  readonly waitlisted: number;
  readonly mine: RosterStatus | null;
  readonly waitlistPosition: number | null;
}

export interface MeView extends PersonView {
  readonly organizer: boolean;
  readonly statsPublic: boolean;
}

export interface OrganizerView {
  readonly roster: {
    readonly person: PersonView;
    readonly status: RosterStatus;
    readonly at: number;
    readonly here: boolean;
    readonly left: boolean;
    readonly games: number;
    readonly minutes: number;
    readonly waitingMin: number | null;
  }[];
  readonly players: (PersonView & {
    readonly organizer: boolean;
    readonly statsPublic: boolean;
  })[];
  readonly courts: Court[];
  readonly rules: Rules;
  readonly audit: {
    readonly at: number;
    readonly by: string;
    readonly what: string;
  }[];
  readonly alerts: string[];
  readonly games: GameView[];
  readonly spread: { readonly fewest: number; readonly most: number } | null;
}

export interface LiveView {
  readonly now: number;
  readonly version: string;
  readonly me: MeView | null;
  readonly sessions: SessionListing[];
  readonly night: NightView | null;
  readonly organizer: OrganizerView | null;
}

export function courtRule(c: Court): string {
  const range =
    c.minSkill === c.maxSkill
      ? SKILL_NAMES[c.minSkill]
      : c.minSkill === 1 && c.maxSkill === 5
        ? "Everyone"
        : `${SKILL_NAMES[c.minSkill]} to ${SKILL_NAMES[c.maxSkill]}`;
  const stretch =
    c.stretchPartnerMin !== null && c.minSkill > 1
      ? ` · ${SKILL_NAMES[(c.minSkill - 1) as Skill]} partnered with ${SKILL_NAMES[c.stretchPartnerMin]}${c.stretchPartnerMin < 5 ? " or better" : ""}`
      : "";
  const never = c.kind === "expert" ? " · never Beginner-rated players" : "";
  const meant =
    c.idealMin !== c.minSkill || c.idealMax !== c.maxSkill
      ? ` · mostly ${SKILL_NAMES[c.idealMin]}${c.idealMax !== c.idealMin ? `–${SKILL_NAMES[c.idealMax]}` : ""} games`
      : "";
  return `${range}${stretch}${meant}${never}`;
}

export function person(club: Club, id: string): PersonView {
  const p = club.players[id];
  return {
    id,
    name: p?.name ?? "Someone",
    skill: p?.skill ?? 3,
    photo: !!p?.photo,
    mentor: !!p?.mentor,
  };
}

function gameView(club: Club, g: Game): GameView {
  return {
    id: g.id,
    court: g.court,
    status: g.status,
    source: g.source,
    slots: g.slots.map((id) => (id ? person(club, id) : null)),
    why: g.why,
    calledAt: g.calledAt,
    startedAt: g.startedAt ?? null,
    finishedAt: g.finishedAt ?? null,
    minutes: g.status === "finished" ? playedMinutes(g) : null,
    startEstimated: !!g.startEstimated,
    endEstimated: !!g.endEstimated,
    score: g.score ?? null,
    winner: g.winner ?? null,
    scoreBy: g.scoreBy ?? null,
    confirmedBy: g.confirmedBy ?? null,
    disputedBy: g.disputedBy ?? null,
    accepted: Object.keys(g.accepted),
    kudosFrom: g.kudos.map((k) => k.from),
  };
}

const challengeView = (club: Club, c: Challenge): ChallengeView => ({
  id: c.id,
  by: c.by,
  slots: c.slots.map((id) => person(club, id)),
  accepted: Object.keys(c.accepted),
  status: c.status,
  readyAt: c.readyAt ?? null,
});

export function listing(
  club: Club,
  s: Session,
  me: string | null,
): SessionListing {
  const confirmed = s.roster.filter((r) => r.status === "confirmed").length;
  const wait = s.roster
    .filter((r) => r.status === "waitlist")
    .sort((a, b) => a.at - b.at);
  const mine = me ? s.roster.find((r) => r.playerId === me) : undefined;
  const pos = me ? wait.findIndex((r) => r.playerId === me) : -1;
  return {
    id: s.id,
    date: s.date,
    label: s.label,
    status: s.status,
    registrationOpen: s.registrationOpen,
    capacity: club.rules.capacity,
    confirmed,
    waitlisted: wait.length,
    mine: mine?.status ?? null,
    waitlistPosition: pos >= 0 ? pos + 1 : null,
  };
}

export function nightView(
  club: Club,
  s: Session,
  me: string | null,
  now: number,
): NightView {
  const l = listing(club, s, me);
  const line = inOrder(club, s);
  const open = club.courts.filter((c) => !s.closedCourts.includes(c.id)).length;
  const t = tonight(s);
  const here = (id: string) =>
    s.present[id] && s.present[id]!.leftAt === undefined;
  let mine: NightView["me"] = null;
  if (me) {
    const game = s.games.find((g) => isActiveGame(g) && g.slots.includes(me));
    const held = s.challenges.find(
      (c) => c.status === "ready" && c.slots.includes(me),
    );
    const pos = line.findIndex((w) => w.playerId === me);
    const presence = s.present[me];
    const state: MyState = game
      ? game.status === "playing"
        ? "playing"
        : "called"
      : held
        ? "challenge"
        : pos >= 0
          ? "queued"
          : presence?.leftAt !== undefined
            ? "left"
            : presence
              ? "idle"
              : "away";
    mine = {
      roster: l.mine,
      waitlistPosition: l.waitlistPosition,
      state,
      autoRequeue: presence?.autoRequeue ?? true,
      queuePosition: pos >= 0 ? pos + 1 : null,
      queuedSince: pos >= 0 ? line[pos]!.since : null,
      estimateMin: pos >= 0 ? estimateWaitMinutes(s, open, pos, now) : null,
      games: t.get(me)?.games ?? 0,
      minutes: t.get(me)?.minutes ?? 0,
      game: game ? gameView(club, game) : null,
      played: s.games
        .filter((g) => g.status === "finished" && g.slots.includes(me))
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
        .map((g) => gameView(club, g)),
    };
  }
  return {
    id: s.id,
    date: s.date,
    label: s.label,
    status: s.status,
    registrationOpen: s.registrationOpen,
    capacity: l.capacity,
    confirmed: l.confirmed,
    waitlisted: l.waitlisted,
    courts: club.courts.map((c) => {
      const g = s.games.find((x) => x.court === c.id && isActiveGame(x));
      return {
        id: c.id,
        name: c.name,
        where: c.where,
        kind: c.kind,
        rule: courtRule(c),
        closed: s.closedCourts.includes(c.id),
        game: g ? gameView(club, g) : null,
      };
    }),
    queue: line.map((w) => ({
      person: person(club, w.playerId),
      since: w.since,
    })),
    present: Object.keys(s.present)
      .filter(here)
      .map((id) => person(club, id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    recent: s.games
      .filter((g) => g.status === "finished")
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
      .slice(0, 12)
      .map((g) => gameView(club, g)),
    challenges: me
      ? s.challenges
          .filter(
            (c) =>
              c.slots.includes(me) &&
              (isHeldChallenge(c) ||
                c.status === "on-court" ||
                (c.status === "declined" && now - c.createdAt < 30 * MINUTE)),
          )
          .map((c) => challengeView(club, c))
      : [],
    readyChallenges: s.challenges.filter((c) => c.status === "ready").length,
    typicalMinutes: typicalGameMinutes(s),
    me: mine,
  };
}

export function organizerView(
  club: Club,
  s: Session | null,
  now: number,
): OrganizerView {
  const t = s ? tonight(s) : new Map();
  const queuedSince = new Map(s?.queue.map((q) => [q.playerId, q.since]) ?? []);
  const alerts: string[] = [];
  if (s) {
    for (const g of s.games) {
      if (
        g.status === "playing" &&
        g.startedAt &&
        now - g.startedAt > club.rules.longGameMinutes * MINUTE
      )
        alerts.push(
          `Court ${g.court} has been playing ${Math.round((now - g.startedAt) / MINUTE)} min — did they forget to finish?`,
        );
      if (g.status === "called" && now - g.calledAt > 6 * MINUTE)
        alerts.push(
          `Court ${g.court} was called ${Math.round((now - g.calledAt) / MINUTE)} min ago and hasn't started.`,
        );
      if (g.status === "called" && filled(g.slots).length < 4)
        alerts.push(`Court ${g.court} is waiting for a fourth player.`);
      if (g.disputedBy) alerts.push(`A score on court ${g.court} is disputed.`);
    }
    const busyCourts = new Set(
      s.games.filter(isActiveGame).map((g) => g.court),
    );
    const idle = club.courts.filter(
      (c) => !s.closedCourts.includes(c.id) && !busyCourts.has(c.id),
    );
    if (s.status === "live" && idle.length && s.queue.length >= 4)
      alerts.push(
        `${idle.map((c) => c.name).join(", ")} idle: nobody waiting may play there. Adjust the court's levels or assign a game.`,
      );
  }
  const bal = s ? nightBalance(club, s).filter((r) => s.present[r.id]) : [];
  return {
    roster: s
      ? [...s.roster]
          .sort((a, b) => a.at - b.at)
          .map((r) => ({
            person: person(club, r.playerId),
            status: r.status,
            at: r.at,
            here:
              !!s.present[r.playerId] &&
              s.present[r.playerId]!.leftAt === undefined,
            left: s.present[r.playerId]?.leftAt !== undefined,
            games: t.get(r.playerId)?.games ?? 0,
            minutes: t.get(r.playerId)?.minutes ?? 0,
            waitingMin: queuedSince.has(r.playerId)
              ? Math.round((now - queuedSince.get(r.playerId)!) / MINUTE)
              : null,
          }))
      : [],
    players: Object.values(club.players)
      .map((p) => ({
        ...person(club, p.id),
        organizer: p.organizer,
        statsPublic: p.statsPublic,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    courts: club.courts,
    rules: club.rules,
    audit: s
      ? s.audit
          .slice(-40)
          .reverse()
          .map((a) => ({
            at: a.at,
            by: club.players[a.by]?.name ?? a.by,
            what: a.what,
          }))
      : [],
    alerts,
    games: s
      ? s.games
          .filter((g) => g.status !== "cancelled")
          .sort((a, b) => b.calledAt - a.calledAt)
          .map((g) => gameView(club, g))
      : [],
    spread: bal.length
      ? { fewest: bal[0]!.games, most: bal[bal.length - 1]!.games }
      : null,
  };
}

/** Which night the Tonight screen is about: the live one, else today's. */
export function currentNight(
  club: Club,
  sessions: readonly Session[],
  now: number,
) {
  const live = sessions.find((s) => s.status === "live");
  if (live) return live;
  const today = localDate(now);
  return sessions.find((s) => s.date === today && s.status !== "ended") ?? null;
}
