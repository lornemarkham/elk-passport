import { localDate, weekdayLabel } from "./clock";
import {
  estimateWaitMinutes,
  inOrder,
  prepared,
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
import {
  SEASON,
  cancellationOf,
  hoursLabel,
  registrationOpensAt,
  registrationState,
  registrationWords,
  seasonDates,
  sessionWindow,
  type RegistrationState,
} from "./schedule";
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

/**
 * **Where a player is in their night**, the one word the Home screen leads
 * with. Each has one obvious next step:
 *
 *   not-registered  SIGN ME UP (from 8:00 am on the day)
 *   waitlist        — moves up by itself
 *   registered      I'M HERE
 *   ready           JOIN THE QUEUE
 *   waiting         — put the phone down
 *   up              START GAME (the court is called)
 *   playing         FINISH GAME
 *   finished        BACK IN THE QUEUE (never automatic)
 *   left / ended    —
 */
export type Phase =
  | "not-registered"
  | "waitlist"
  | "registered"
  | "ready"
  | "waiting"
  | "up"
  | "playing"
  | "finished"
  | "left"
  | "ended";

export interface PreparedView {
  readonly court: number;
  readonly slots: (PersonView | null)[];
  readonly at: number;
}

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
  /** The next games, already prepared for the courts in use. */
  readonly prepared: PreparedView[];
  readonly hours: string;
  readonly endsAt: number;
  readonly cancelled: string | null;
  readonly registration: RegistrationState;
  readonly registrationNote: string;
  readonly me: {
    readonly roster: RosterStatus | null;
    readonly waitlistPosition: number | null;
    readonly state: MyState;
    readonly phase: Phase;
    /** Minutes spent waiting in line tonight, including now. */
    readonly waited: number;
    /** The prepared game this player is in, if any. */
    readonly next: PreparedView | null;
    /** Why their place in line is what it is, in their own numbers. */
    readonly lineRule: string | null;
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
  /** Sign-up is possible right now: the day, from 8:00 am, not cancelled. */
  readonly registrationOpen: boolean;
  readonly registration: RegistrationState;
  readonly registrationNote: string;
  /** The organizer has closed sign-up for this night by hand. */
  readonly held: boolean;
  readonly opensAt: number;
  readonly hours: string;
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

export type NightOnCalendar = "past" | "today" | "upcoming" | "cancelled";

export interface SeasonView {
  readonly club: string;
  readonly venue: string;
  readonly first: string;
  readonly last: string;
  readonly nights: {
    readonly date: string;
    readonly label: string;
    readonly hours: string;
    readonly status: NightOnCalendar;
    readonly reason: string | null;
  }[];
  /** An organizer has checked the cancellations against the official sheet. */
  readonly confirmed: { readonly by: string; readonly at: number } | null;
  readonly log: {
    readonly at: number;
    readonly by: string;
    readonly what: string;
  }[];
}

export interface LiveView {
  readonly now: number;
  readonly version: string;
  readonly me: MeView | null;
  readonly season: SeasonView;
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
  now: number,
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
    registrationOpen:
      s.registrationOpen &&
      s.status !== "ended" &&
      registrationState(s.date, now, club.cancelled) === "open",
    registration: registrationState(s.date, now, club.cancelled),
    registrationNote: registrationWords(s.date, now, club.cancelled),
    held: !s.registrationOpen,
    opensAt: registrationOpensAt(s.date),
    hours: hoursLabel(s.date),
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
  const l = listing(club, s, me, now);
  const line = inOrder(club, s);
  const ready = prepared(club, s, now).map((p) => ({
    court: p.court,
    slots: p.slots.map((id) => (id ? person(club, id) : null)),
    at: p.at,
  }));
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
    const played = s.games
      .filter((g) => g.status === "finished" && g.slots.includes(me))
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
    const phase: Phase =
      s.status === "ended"
        ? "ended"
        : state === "playing"
          ? "playing"
          : state === "called"
            ? "up"
            : state === "queued" || state === "challenge"
              ? "waiting"
              : state === "left"
                ? "left"
                : state === "idle"
                  ? played.length
                    ? "finished"
                    : "ready"
                  : l.mine === "confirmed"
                    ? "registered"
                    : l.mine === "waitlist"
                      ? "waitlist"
                      : "not-registered";
    const games = t.get(me)?.games ?? 0;
    const waitingNow = pos >= 0 ? Math.max(0, now - line[pos]!.since) : 0;
    mine = {
      roster: l.mine,
      waitlistPosition: l.waitlistPosition,
      state,
      phase,
      waited: (t.get(me)?.waited ?? 0) + Math.round(waitingNow / MINUTE),
      next: ready.find((p) => p.slots.some((x) => x?.id === me)) ?? null,
      lineRule:
        pos < 0
          ? null
          : games === 0
            ? "Everyone gets a first game before anyone plays a second."
            : `People who've played fewer than ${games} game${games === 1 ? "" : "s"} tonight go first, then fewest minutes, then whoever has waited longest.`,
      autoRequeue: presence?.autoRequeue ?? true,
      queuePosition: pos >= 0 ? pos + 1 : null,
      queuedSince: pos >= 0 ? line[pos]!.since : null,
      estimateMin: pos >= 0 ? estimateWaitMinutes(s, open, pos, now) : null,
      games: t.get(me)?.games ?? 0,
      minutes: t.get(me)?.minutes ?? 0,
      game: game ? gameView(club, game) : null,
      played: played.map((g) => gameView(club, g)),
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
    prepared: ready,
    hours: hoursLabel(s.date),
    endsAt: sessionWindow(s.date).end,
    cancelled: cancellationOf(s.date, club.cancelled)?.reason ?? null,
    registration: l.registration,
    registrationNote: l.registrationNote,
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
            by:
              club.players[a.by]?.name ??
              (a.by === "courtqueue" ? "CourtQueue" : a.by),
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

/** The whole season, for the calendar. */
export function seasonView(club: Club, now: number): SeasonView {
  const today = localDate(now);
  const name = (id: string) =>
    club.players[id]?.name ?? (id === "courtqueue" ? "CourtQueue" : id);
  return {
    club: SEASON.club,
    venue: SEASON.venue,
    first: SEASON.first,
    last: SEASON.last,
    nights: seasonDates().map((date) => {
      const c = cancellationOf(date, club.cancelled);
      return {
        date,
        label: weekdayLabel(date),
        hours: hoursLabel(date),
        status: c
          ? "cancelled"
          : date < today
            ? "past"
            : date === today
              ? "today"
              : "upcoming",
        reason: c?.reason ?? null,
      };
    }),
    confirmed: club.scheduleConfirmed
      ? {
          by: name(club.scheduleConfirmed.by),
          at: club.scheduleConfirmed.at,
        }
      : null,
    log: (club.scheduleLog ?? [])
      .slice(-20)
      .reverse()
      .map((a) => ({ at: a.at, by: name(a.by), what: a.what })),
  };
}
