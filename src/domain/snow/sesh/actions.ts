/**
 * **Everything a person can do in Sesh Wars, as data.** The demo applies an
 * action to its own world with {@link apply}; the real routes check the same
 * action with {@link check} and then write it as the caller (the database
 * checks again). One set of rules, two places it runs.
 */
import {
  AGE_GROUPS,
  CATEGORIES,
  DIVISIONS,
  REACTIONS,
  SESH_MOUNTAINS,
  SPORTS,
  isOne,
  type AgeGroup,
  type Category,
  type Chirp,
  type Clip,
  type ClipMedia,
  type Division,
  type ReactionKind,
  type Side,
  type Sport,
  type ThreadKind,
  type Viewer,
  type World,
} from "./model";
import {
  canAnswerWith,
  canChallenge,
  canChirp,
  canReact,
  canVote,
  challengeOf,
  clipOf,
  featureOf,
  featureOpen,
  newChallenge,
  riderOf,
  REPORTS_TO_HIDE,
} from "./rules";
import { checkCaption, checkChirp, checkName } from "./safety";

export interface PostClip {
  readonly type: "post";
  readonly featureId: string;
  readonly sport: Sport;
  readonly division: Division;
  readonly category: Category;
  readonly caption: string;
  readonly media: ClipMedia;
  /** "I filmed this or have the rider's OK, and I may share it." */
  readonly rights: boolean;
  /** "It was on an open, permitted feature." */
  readonly openTerrain: boolean;
  readonly byGuardian?: boolean;
  /** The clip being challenged, when this post is an answer. */
  readonly answerTo?: string;
}

export type Action =
  | PostClip
  | { readonly type: "vote"; readonly challengeId: string; readonly side: Side }
  | {
      readonly type: "chirp";
      readonly thread: { readonly kind: ThreadKind; readonly id: string };
      readonly body: string;
    }
  | {
      readonly type: "react";
      readonly clipId: string;
      readonly kind: ReactionKind;
    }
  | {
      readonly type: "report";
      readonly target: {
        readonly kind: "clip" | "chirp" | "feature";
        readonly id: string;
      };
      readonly reason: string;
    }
  | { readonly type: "block"; readonly riderId: string }
  | {
      readonly type: "profile";
      readonly name: string;
      readonly homeMountain: string;
      readonly sport: Sport;
      readonly division?: Division;
      readonly ageGroup: AgeGroup;
    };

export const REPORT_REASONS = [
  "Dangerous or closed terrain",
  "Someone got hurt",
  "Bullying or mean",
  "Not their clip / no permission",
  "Shows a younger rider's private info",
  "Spam or fake",
  "This feature isn't real or is closed",
] as const;

export type Checked = { ok: true } | { ok: false; reason: string };

/** Shape-check untrusted JSON into an Action (the routes' first line). */
export function parseAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const str = (k: string, max = 400) =>
    typeof a[k] === "string" && (a[k] as string).length <= max
      ? (a[k] as string)
      : null;
  switch (a.type) {
    case "post": {
      const featureId = str("featureId", 80);
      const caption = str("caption", 400) ?? "";
      if (
        !featureId ||
        !isOne(SPORTS, a.sport) ||
        !isOne(DIVISIONS, a.division)
      )
        return null;
      if (!isOne(CATEGORIES, a.category)) return null;
      const m = a.media as Record<string, unknown> | undefined;
      let media: ClipMedia;
      if (m?.kind === "video" && typeof m.url === "string")
        media = { kind: "video", url: m.url };
      else if (m?.kind === "illustration" && typeof m.seed === "number")
        media = { kind: "illustration", seed: m.seed };
      else if (m?.kind === "local" && typeof m.url === "string")
        media = { kind: "local", url: m.url };
      else return null;
      return {
        type: "post",
        featureId,
        sport: a.sport,
        division: a.division,
        category: a.category,
        caption,
        media,
        rights: a.rights === true,
        openTerrain: a.openTerrain === true,
        byGuardian: a.byGuardian === true,
        answerTo: str("answerTo", 80) ?? undefined,
      };
    }
    case "vote":
      return str("challengeId", 80) &&
        (a.side === "defender" || a.side === "challenger")
        ? { type: "vote", challengeId: a.challengeId as string, side: a.side }
        : null;
    case "chirp": {
      const t = a.thread as Record<string, unknown> | undefined;
      const body = str("body", 400);
      if (
        !t ||
        !isOne(["feature", "challenge", "clip"] as const, t.kind) ||
        typeof t.id !== "string" ||
        !body
      )
        return null;
      return {
        type: "chirp",
        thread: { kind: t.kind, id: t.id.slice(0, 80) },
        body,
      };
    }
    case "react":
      return str("clipId", 80) && isOne(REACTIONS, a.kind)
        ? { type: "react", clipId: a.clipId as string, kind: a.kind }
        : null;
    case "report": {
      const t = a.target as Record<string, unknown> | undefined;
      const reason = str("reason", 200);
      if (
        !t ||
        !isOne(["clip", "chirp", "feature"] as const, t.kind) ||
        typeof t.id !== "string" ||
        !reason
      )
        return null;
      return {
        type: "report",
        target: { kind: t.kind, id: t.id.slice(0, 80) },
        reason,
      };
    }
    case "block":
      return str("riderId", 80)
        ? { type: "block", riderId: a.riderId as string }
        : null;
    case "profile": {
      const name = str("name", 60);
      if (
        !name ||
        !isOne(SESH_MOUNTAINS, a.homeMountain) ||
        !isOne(SPORTS, a.sport) ||
        !isOne(AGE_GROUPS, a.ageGroup)
      )
        return null;
      return {
        type: "profile",
        name,
        homeMountain: a.homeMountain,
        sport: a.sport,
        division: isOne(DIVISIONS, a.division) ? a.division : undefined,
        ageGroup: a.ageGroup,
      };
    }
  }
  return null;
}

/** Whether `action` is allowed for `viewer` in `w` right now. */
export function check(
  w: World,
  v: Viewer,
  action: Action,
  now: number,
): Checked {
  switch (action.type) {
    case "profile": {
      if (!v.signedIn) return { ok: false, reason: "Sign in first." };
      const name = checkName(action.name);
      if (!name.ok) return name;
      const taken = w.riders.some(
        (r) =>
          r.id !== v.riderId &&
          r.name.trim().toLowerCase() === action.name.trim().toLowerCase(),
      );
      return taken
        ? { ok: false, reason: "That name's taken on Sesh Wars. Try another." }
        : { ok: true };
    }
    case "post": {
      if (!v.signedIn) return { ok: false, reason: "Sign in to post a clip." };
      const me = riderOf(w, v.riderId);
      if (!me) return { ok: false, reason: "Make your rider profile first." };
      if (!action.rights)
        return {
          ok: false,
          reason: "Confirm you filmed it or have the rider's OK to share it.",
        };
      if (!action.openTerrain)
        return {
          ok: false,
          reason: "Clips only count on open, permitted features.",
        };
      if (action.byGuardian && me.ageGroup !== "adult")
        return {
          ok: false,
          reason: "Only a parent or guardian posts for a rider under 13.",
        };
      const f = featureOf(w, action.featureId);
      if (!f) return { ok: false, reason: "Pick a feature." };
      const open = featureOpen(f, now);
      if (!open.ok) return open;
      const cap = checkCaption(action.caption);
      if (!cap.ok) return cap;
      if (action.answerTo) {
        const defender = clipOf(w, action.answerTo);
        if (!defender)
          return { ok: false, reason: "That clip isn't up any more." };
        const can = canChallenge(w, v, defender, now);
        if (!can.ok) return can;
        return canAnswerWith(defender, draftClip("draft", me.id, action, now));
      }
      return { ok: true };
    }
    case "vote": {
      const ch = challengeOf(w, action.challengeId);
      return ch
        ? canVote(w, v, ch, now)
        : { ok: false, reason: "That challenge isn't here." };
    }
    case "chirp": {
      const can = canChirp(w, v, action.thread.kind, action.thread.id);
      return can.ok ? checkChirp(action.body) : can;
    }
    case "react":
      return clipOf(w, action.clipId)
        ? canReact(w, v)
        : { ok: false, reason: "That clip isn't here." };
    case "report":
      return v.signedIn
        ? { ok: true }
        : { ok: false, reason: "Sign in to report — it keeps reports honest." };
    case "block":
      return !v.riderId
        ? { ok: false, reason: "Make your rider profile first." }
        : action.riderId === v.riderId
          ? { ok: false, reason: "That's you." }
          : { ok: true };
  }
}

export function draftClip(
  id: string,
  riderId: string,
  a: PostClip,
  now: number,
): Clip {
  return {
    id,
    featureId: a.featureId,
    riderId,
    sport: a.sport,
    division: a.division,
    category: a.category,
    caption: a.caption.trim(),
    at: new Date(now).toISOString(),
    media: a.media,
    status: "published",
    byGuardian: a.byGuardian || undefined,
  };
}

export interface Reports {
  /** target id → reporter ids */
  readonly [targetId: string]: readonly string[];
}

/**
 * Apply an action to a world (the demo). Returns the new world, or why not.
 * `reports` is the demo's own tally: three distinct reporters hide a thing.
 */
export function apply(
  w: World,
  v: Viewer,
  action: Action,
  now: number,
  newId: () => string,
  reports: Record<string, string[]> = {},
):
  { ok: true; world: World; created?: string } | { ok: false; reason: string } {
  const verdict = check(w, v, action, now);
  if (!verdict.ok) return verdict;
  const me = v.riderId!;
  const at = new Date(now).toISOString();
  switch (action.type) {
    case "profile": {
      const existing = riderOf(w, v.riderId);
      const rider = {
        id: v.riderId ?? newId(),
        name: action.name.trim(),
        homeMountain: action.homeMountain,
        sport: action.sport,
        division: action.division,
        ageGroup: action.ageGroup,
        since: existing?.since ?? at,
      };
      return {
        ok: true,
        world: {
          ...w,
          riders: [...w.riders.filter((r) => r.id !== rider.id), rider],
        },
        created: rider.id,
      };
    }
    case "post": {
      const clip = draftClip(newId(), me, action, now);
      const world = { ...w, clips: [...w.clips, clip] };
      if (!action.answerTo) return { ok: true, world, created: clip.id };
      const ch = newChallenge(newId(), clipOf(w, action.answerTo)!, clip, now);
      return {
        ok: true,
        world: { ...world, challenges: [...w.challenges, ch] },
        created: ch.id,
      };
    }
    case "vote":
      return {
        ok: true,
        world: {
          ...w,
          votes: [
            ...w.votes,
            {
              challengeId: action.challengeId,
              voterId: me,
              side: action.side,
              at,
            },
          ],
        },
      };
    case "chirp": {
      const chirp: Chirp = {
        id: newId(),
        thread: action.thread,
        authorId: me,
        body: action.body.trim(),
        at,
        status: "published",
      };
      return {
        ok: true,
        world: { ...w, chirps: [...w.chirps, chirp] },
        created: chirp.id,
      };
    }
    case "react": {
      const had = w.reactions.some(
        (r) =>
          r.clipId === action.clipId &&
          r.riderId === me &&
          r.kind === action.kind,
      );
      return {
        ok: true,
        world: {
          ...w,
          reactions: had
            ? w.reactions.filter(
                (r) =>
                  !(
                    r.clipId === action.clipId &&
                    r.riderId === me &&
                    r.kind === action.kind
                  ),
              )
            : [
                ...w.reactions,
                { clipId: action.clipId, riderId: me, kind: action.kind },
              ],
        },
      };
    }
    case "report": {
      const id = action.target.id;
      const who = new Set([...(reports[id] ?? []), me]);
      reports[id] = [...who];
      if (who.size < REPORTS_TO_HIDE) return { ok: true, world: w };
      const hide = <T extends { id: string; status: string }>(
        xs: readonly T[],
      ) =>
        xs.map((x) =>
          x.id === id && x.status === "published"
            ? { ...x, status: "hidden" as const }
            : x,
        );
      return {
        ok: true,
        world: { ...w, clips: hide(w.clips), chirps: hide(w.chirps) },
      };
    }
    case "block":
      return {
        ok: true,
        world: {
          ...w,
          blocks: [...w.blocks, { blockerId: me, blockedId: action.riderId }],
        },
      };
  }
}
