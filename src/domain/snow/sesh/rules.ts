/**
 * **The rules of Sesh Wars.** Pure functions over a {@link World}; the
 * database enforces the same rules again (docs/product/snow/sesh-wars-migration.sql)
 * so a hand-made request cannot skip them.
 *
 * - **A challenge** is two clips on one feature, in one division, between
 *   riders of the same age group who haven't blocked each other.
 * - **Voting** is open for {@link VOTING_HOURS} hours. One vote per person
 *   per challenge, final; riders in the challenge don't vote on it.
 * - **The winner** has more votes when voting closes. A tie goes to the
 *   defender (the challenger has to take the feature, not share it). No votes
 *   at all is no contest — nobody is crowned by default.
 * - **A champion** of a feature for a period (day, week, season, all time)
 *   is the rider with the most challenge wins on it that closed in that
 *   period; then most votes won; then whoever got there first.
 */
import type {
  AgeGroup,
  Category,
  Challenge,
  Chirp,
  Clip,
  Feature,
  Rider,
  Side,
  ThreadKind,
  Viewer,
  World,
} from "./model";
import { hillDay, periodKey, type Period } from "./time";

export const VOTING_HOURS = 24;
export const VOTING_MS = VOTING_HOURS * 3_600_000;
/** Distinct reports that take something down until a moderator looks. */
export const REPORTS_TO_HIDE = 3;

export const riderOf = (w: World, id: string | undefined): Rider | undefined =>
  id ? w.riders.find((r) => r.id === id) : undefined;
export const clipOf = (w: World, id: string): Clip | undefined =>
  w.clips.find((c) => c.id === id);
export const featureOf = (w: World, id: string): Feature | undefined =>
  w.features.find((f) => f.id === id);
export const challengeOf = (w: World, id: string): Challenge | undefined =>
  w.challenges.find((c) => c.id === id);

export const blocked = (
  w: World,
  a: string | undefined,
  b: string | undefined,
) =>
  !!a &&
  !!b &&
  w.blocks.some(
    (x) =>
      (x.blockerId === a && x.blockedId === b) ||
      (x.blockerId === b && x.blockedId === a),
  );

/** A feature that can take a clip today: approved, and open if we know when. */
export function featureOpen(
  f: Feature,
  now: number,
): { ok: true } | { ok: false; reason: string } {
  if (f.status === "closed")
    return { ok: false, reason: "The resort has this feature closed." };
  if (f.status !== "approved")
    return { ok: false, reason: "This feature isn't approved yet." };
  if (f.opens && hillDay(now) < f.opens)
    return {
      ok: false,
      reason: `Opens ${f.opens}, by the resort's published date.`,
    };
  return { ok: true };
}

/**
 * What a viewer may see. Real rows arrive already filtered by row-level
 * security; the demo runs the same filter on its own world. A visitor who
 * isn't signed in never sees a younger rider's clips, profile or chirps.
 */
export function visibleTo(w: World, v: Viewer): World {
  const hiddenRider = new Set(
    w.riders
      .filter(
        (r) =>
          (!v.signedIn && r.ageGroup === "youth") ||
          blocked(w, v.riderId, r.id),
      )
      .map((r) => r.id),
  );
  const live = (s: string, owner: string) =>
    (s === "published" || (v.moderator && s === "hidden")) &&
    !hiddenRider.has(owner);
  const clips = w.clips.filter((c) => live(c.status, c.riderId));
  const clipIds = new Set(clips.map((c) => c.id));
  const challenges = w.challenges.filter(
    (c) => clipIds.has(c.defenderClipId) && clipIds.has(c.challengerClipId),
  );
  return {
    ...w,
    features: w.features.filter(
      (f) => f.status !== "removed" && f.status !== "proposed",
    ),
    riders: w.riders.filter((r) => !hiddenRider.has(r.id)),
    clips,
    challenges,
    chirps: w.chirps.filter((c) => live(c.status, c.authorId)),
  };
}

export interface ChallengeState {
  readonly open: boolean;
  readonly msLeft: number;
  readonly tally: Record<Side, number>;
  readonly winner?: Side;
  readonly winnerRiderId?: string;
  readonly loserRiderId?: string;
  readonly noContest?: boolean;
  readonly defender?: Clip;
  readonly challenger?: Clip;
}

export function challengeState(
  w: World,
  ch: Challenge,
  now: number,
): ChallengeState {
  const tally = { defender: 0, challenger: 0 };
  for (const v of w.votes) if (v.challengeId === ch.id) tally[v.side]++;
  const msLeft = Date.parse(ch.closesAt) - now;
  const defender = clipOf(w, ch.defenderClipId);
  const challenger = clipOf(w, ch.challengerClipId);
  if (msLeft > 0) return { open: true, msLeft, tally, defender, challenger };
  if (tally.defender + tally.challenger === 0)
    return {
      open: false,
      msLeft,
      tally,
      noContest: true,
      defender,
      challenger,
    };
  const winner: Side =
    tally.challenger > tally.defender ? "challenger" : "defender";
  const [win, lose] =
    winner === "defender" ? [defender, challenger] : [challenger, defender];
  return {
    open: false,
    msLeft,
    tally,
    winner,
    winnerRiderId: win?.riderId,
    loserRiderId: lose?.riderId,
    defender,
    challenger,
  };
}

export type Verdict = { ok: true } | { ok: false; reason: string };

/** May this viewer answer this clip with a challenge at all? */
export function canChallenge(
  w: World,
  v: Viewer,
  defender: Clip,
  now: number,
): Verdict {
  if (!v.signedIn)
    return { ok: false, reason: "Sign in to throw down a challenge." };
  const me = riderOf(w, v.riderId);
  if (!me)
    return {
      ok: false,
      reason: "Make your rider profile first — it takes ten seconds.",
    };
  if (defender.riderId === me.id)
    return { ok: false, reason: "That's your own clip." };
  if (defender.status !== "published")
    return { ok: false, reason: "This clip isn't up right now." };
  const them = riderOf(w, defender.riderId);
  if (!them) return { ok: false, reason: "That rider isn't here any more." };
  if (them.ageGroup !== me.ageGroup)
    return {
      ok: false,
      reason:
        me.ageGroup === "adult"
          ? "Challenges stay between riders of the same age group. React and cheer instead!"
          : "Challenges stay between riders your age. Find someone in your group!",
    };
  if (blocked(w, me.id, them.id))
    return { ok: false, reason: "You can't challenge this rider." };
  const f = featureOf(w, defender.featureId);
  if (!f) return { ok: false, reason: "That feature isn't listed any more." };
  const open = featureOpen(f, now);
  if (!open.ok) return open;
  const already = w.challenges.some((c) => {
    if (c.defenderClipId !== defender.id) return false;
    const answer = clipOf(w, c.challengerClipId);
    return answer?.riderId === me.id && Date.parse(c.closesAt) > now;
  });
  if (already)
    return {
      ok: false,
      reason: "You've already got a challenge open on this clip.",
    };
  return { ok: true };
}

/** Is `answer` a valid reply to `defender`? (Same feature, same division.) */
export function canAnswerWith(defender: Clip, answer: Clip): Verdict {
  if (answer.featureId !== defender.featureId)
    return { ok: false, reason: "Your answer has to be on the same feature." };
  if (answer.division !== defender.division)
    return {
      ok: false,
      reason: "Same division keeps it fair — post in theirs.",
    };
  if (answer.riderId === defender.riderId)
    return { ok: false, reason: "That's the same rider." };
  return { ok: true };
}

export function newChallenge(
  id: string,
  defender: Clip,
  answer: Clip,
  at: number,
): Challenge {
  return {
    id,
    featureId: defender.featureId,
    category: defender.category,
    division: defender.division,
    defenderClipId: defender.id,
    challengerClipId: answer.id,
    at: new Date(at).toISOString(),
    closesAt: new Date(at + VOTING_MS).toISOString(),
  };
}

export function canVote(
  w: World,
  v: Viewer,
  ch: Challenge,
  now: number,
): Verdict {
  if (!v.signedIn)
    return { ok: false, reason: "Sign in to vote — one person, one vote." };
  if (!v.riderId)
    return { ok: false, reason: "Make your rider profile to vote." };
  if (Date.parse(ch.closesAt) <= now)
    return { ok: false, reason: "Voting has closed." };
  const riders = [
    clipOf(w, ch.defenderClipId)?.riderId,
    clipOf(w, ch.challengerClipId)?.riderId,
  ];
  if (riders.includes(v.riderId))
    return { ok: false, reason: "You're in this one. No voting for yourself!" };
  if (w.votes.some((x) => x.challengeId === ch.id && x.voterId === v.riderId))
    return { ok: false, reason: "You've voted. It's locked in." };
  return { ok: true };
}

export const myVote = (w: World, v: Viewer, ch: Challenge) =>
  w.votes.find((x) => x.challengeId === ch.id && x.voterId === v.riderId)?.side;

/** Who owns a thread, for the age rules (the youngest rider in it). */
function threadAge(
  w: World,
  kind: ThreadKind,
  id: string,
): AgeGroup | undefined {
  if (kind === "feature") return undefined;
  const clips =
    kind === "clip"
      ? [clipOf(w, id)]
      : (() => {
          const ch = challengeOf(w, id);
          return ch
            ? [clipOf(w, ch.defenderClipId), clipOf(w, ch.challengerClipId)]
            : [];
        })();
  const ages = clips.map((c) => riderOf(w, c?.riderId)?.ageGroup);
  return ages.includes("youth")
    ? "youth"
    : ages.includes("adult")
      ? "adult"
      : undefined;
}

/**
 * Chirps are for riders. On a younger rider's clip or challenge, adults
 * react with the five reactions and don't post words — friendly or not, it's
 * the unwanted-contact line. Blocks stop chirps both ways.
 */
export function canChirp(
  w: World,
  v: Viewer,
  kind: ThreadKind,
  id: string,
): Verdict {
  if (!v.signedIn) return { ok: false, reason: "Sign in to chirp." };
  const me = riderOf(w, v.riderId);
  if (!me) return { ok: false, reason: "Make your rider profile to chirp." };
  if (threadAge(w, kind, id) === "youth" && me.ageGroup === "adult")
    return {
      ok: false,
      reason:
        "This one's a younger rider's. Adults cheer with reactions here, not words.",
    };
  if (kind === "clip") {
    const c = clipOf(w, id);
    if (c && blocked(w, me.id, c.riderId))
      return { ok: false, reason: "You can't chirp here." };
  }
  return { ok: true };
}

export const canReact = (w: World, v: Viewer): Verdict =>
  !v.signedIn
    ? { ok: false, reason: "Sign in to react." }
    : !riderOf(w, v.riderId)
      ? { ok: false, reason: "Make your rider profile to react." }
      : { ok: true };

export const threadChirps = (w: World, kind: ThreadKind, id: string): Chirp[] =>
  w.chirps
    .filter((c) => c.thread.kind === kind && c.thread.id === id)
    .sort((a, b) => a.at.localeCompare(b.at));

// ── Results, champions, history ─────────────────────────────────────────

export interface Result {
  readonly challenge: Challenge;
  readonly closedAt: string;
  readonly winnerRiderId: string;
  readonly loserRiderId: string;
  readonly winnerVotes: number;
}

/** Every decided challenge, oldest close first. */
export function results(w: World, now: number): Result[] {
  const out: Result[] = [];
  for (const ch of w.challenges) {
    const s = challengeState(w, ch, now);
    if (s.open || !s.winner || !s.winnerRiderId || !s.loserRiderId) continue;
    out.push({
      challenge: ch,
      closedAt: ch.closesAt,
      winnerRiderId: s.winnerRiderId,
      loserRiderId: s.loserRiderId,
      winnerVotes: s.tally[s.winner],
    });
  }
  return out.sort(
    (a, b) =>
      a.closedAt.localeCompare(b.closedAt) ||
      a.challenge.id.localeCompare(b.challenge.id),
  );
}

export interface Standing {
  readonly riderId: string;
  readonly wins: number;
  readonly votes: number;
  /** When they reached their final win count — the last tie-break. */
  readonly reached: string;
}

export interface BoardFilter {
  readonly category?: Category;
  readonly sport?: Clip["sport"];
  readonly division?: Clip["division"];
}

function rank(
  rs: readonly Result[],
  w: World,
  filter: BoardFilter = {},
): Standing[] {
  const by = new Map<
    string,
    { wins: number; votes: number; reached: string }
  >();
  for (const r of rs) {
    if (filter.category && r.challenge.category !== filter.category) continue;
    if (filter.division && r.challenge.division !== filter.division) continue;
    if (filter.sport) {
      const clip = w.clips.find(
        (c) =>
          c.riderId === r.winnerRiderId &&
          (c.id === r.challenge.defenderClipId ||
            c.id === r.challenge.challengerClipId),
      );
      if (clip?.sport !== filter.sport) continue;
    }
    const s = by.get(r.winnerRiderId) ?? {
      wins: 0,
      votes: 0,
      reached: r.closedAt,
    };
    s.wins++;
    s.votes += r.winnerVotes;
    s.reached = r.closedAt;
    by.set(r.winnerRiderId, s);
  }
  return [...by.entries()]
    .map(([riderId, s]) => ({ riderId, ...s }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.votes - a.votes ||
        a.reached.localeCompare(b.reached) ||
        a.riderId.localeCompare(b.riderId),
    );
}

/** The leaderboard of one feature (or all of a mountain's) for a period. */
export function leaderboard(
  w: World,
  now: number,
  scope: { featureId?: string; mountainId?: string },
  period: Period,
  filter: BoardFilter = {},
): Standing[] {
  const key = periodKey(period, now);
  const inScope = (r: Result) => {
    if (scope.featureId && r.challenge.featureId !== scope.featureId)
      return false;
    if (
      scope.mountainId &&
      featureOf(w, r.challenge.featureId)?.mountainId !== scope.mountainId
    )
      return false;
    return periodKey(period, r.closedAt) === key;
  };
  return rank(results(w, now).filter(inScope), w, filter);
}

export function champion(
  w: World,
  now: number,
  featureId: string,
  period: Period,
): Standing | undefined {
  return leaderboard(w, now, { featureId }, period)[0];
}

export interface PastChampion {
  readonly key: string;
  readonly period: "day" | "week" | "season";
  readonly riderId: string;
  readonly wins: number;
}

/** Champions of finished days, weeks and seasons on a feature, newest first. */
export function history(
  w: World,
  now: number,
  featureId: string,
): PastChampion[] {
  const rs = results(w, now).filter((r) => r.challenge.featureId === featureId);
  const out: PastChampion[] = [];
  for (const period of ["day", "week", "season"] as const) {
    const current = periodKey(period, now);
    const keys = [
      ...new Set(rs.map((r) => periodKey(period, r.closedAt))),
    ].filter((k) => k !== current);
    for (const key of keys) {
      const top = rank(
        rs.filter((r) => periodKey(period, r.closedAt) === key),
        w,
      )[0];
      if (top) out.push({ key, period, riderId: top.riderId, wins: top.wins });
    }
  }
  for (const l of w.legends ?? [])
    if (
      l.featureId === featureId &&
      !out.some((o) => o.period === "season" && o.key === l.season)
    )
      out.push({
        key: l.season,
        period: "season",
        riderId: l.riderId,
        wins: 0,
      });
  return out.sort((a, b) =>
    b.key.replace(/^W/, "").localeCompare(a.key.replace(/^W/, "")),
  );
}

/** A challenge whose loser was the feature's reigning weekly champion. */
export function dethronings(
  w: World,
  now: number,
): { result: Result; featureId: string }[] {
  const rs = results(w, now);
  const out: { result: Result; featureId: string }[] = [];
  rs.forEach((r, i) => {
    const before = rs
      .slice(0, i)
      .filter(
        (p) =>
          p.challenge.featureId === r.challenge.featureId &&
          periodKey("week", p.closedAt) === periodKey("week", r.closedAt),
      );
    const reigning = rank(before, w)[0];
    if (reigning?.riderId !== r.loserRiderId) return;
    const after = rank([...before, r], w)[0];
    if (after?.riderId === r.winnerRiderId)
      out.push({ result: r, featureId: r.challenge.featureId });
  });
  return out.reverse();
}

// ── Little counts for cards ─────────────────────────────────────────────

export function reactionCounts(w: World, clipId: string) {
  const counts: Record<string, number> = {};
  for (const r of w.reactions)
    if (r.clipId === clipId) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return counts;
}

export const reactionTotal = (w: World, clipId: string) =>
  w.reactions.filter((r) => r.clipId === clipId).length;

export const challengesOfClip = (w: World, clipId: string) =>
  w.challenges.filter(
    (c) => c.defenderClipId === clipId || c.challengerClipId === clipId,
  );

export function riderRecord(w: World, now: number, riderId: string) {
  const rs = results(w, now);
  const wins = rs.filter((r) => r.winnerRiderId === riderId).length;
  const losses = rs.filter((r) => r.loserRiderId === riderId).length;
  const clips = w.clips.filter((c) => c.riderId === riderId).length;
  const votesCast = w.votes.filter((v) => v.voterId === riderId).length;
  const reactionsGiven = w.reactions.filter(
    (r) => r.riderId === riderId,
  ).length;
  return { wins, losses, clips, votesCast, reactionsGiven };
}
