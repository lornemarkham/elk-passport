import {
  TOPICS,
  applyAction,
  newDay,
  type Action,
  type Announcement,
  type Person,
  type Photo,
  type Proposal,
  type SnowDay,
  type Topic,
  SHARED_PHOTO,
} from "./day";
import { isAbility, isDiscipline } from "./ability";
import type { Prediction } from "./predictions";

/**
 * **A snow day shared between phones: rows in, one `SnowDay` out; one
 * `Action` in, rows to write out.**
 *
 * Everything pure lives here, so it is testable without a database. The
 * server (src/app/snow/_server/shared.ts) reads rows, calls `assemble`, and
 * for a change calls `plan`, which asks the same `applyAction` the screen
 * uses whether the change makes sense and then says exactly which rows it
 * becomes. Postgres row-level security remains the real gate; `plan` is how
 * a refusal gets a sentence a person can read, and how a phone is stopped
 * from acting as somebody else before it ever reaches the database.
 *
 * People are `member_id`s (the core's random per-adventure id). A user id
 * appears in these row types and nowhere in what `assemble` returns.
 */

// ----------------------------------------------------------------- rows

export interface MemberRow {
  readonly user_id: string;
  readonly member_id: string;
  readonly role: "owner" | "participant";
  readonly display_name: string | null;
  readonly joined_at: string;
}

type Authored = {
  readonly user_id: string | null;
  readonly created_at: string;
};

/** What the server reads for one day: one array per table. */
export interface SharedRows {
  readonly adventure: {
    readonly id: string;
    readonly title: string;
    readonly starts_on: string | null;
    readonly created_at: string;
  };
  readonly members: readonly MemberRow[];
  readonly day: {
    readonly meet_time: string | null;
    readonly challenges_on: boolean;
  } | null;
  readonly people: readonly {
    readonly user_id: string;
    readonly discipline: string;
    readonly ability: string;
    readonly own_gear: boolean;
    readonly note: string | null;
  }[];
  readonly proposals: readonly (Authored & {
    readonly id: string;
    readonly topic: string;
    readonly label: string;
    readonly detail: string | null;
    readonly source: string | null;
  })[];
  readonly votes: readonly {
    readonly user_id: string;
    readonly proposal_id: string;
  }[];
  readonly decisions: readonly {
    readonly topic: string;
    readonly proposal_id: string;
  }[];
  readonly posts: readonly (Authored & {
    readonly id: string;
    readonly kind: "chat" | "announcement" | "change";
    readonly body: string;
  })[];
  readonly challenges: readonly (Authored & {
    readonly id: string;
    readonly title: string;
  })[];
  readonly completions: readonly {
    readonly user_id: string;
    readonly challenge_id: string;
    readonly completed_at: string;
  }[];
  readonly moments: readonly {
    readonly id: string;
    readonly user_id: string;
    readonly kind: "moment" | "photo";
    readonly body: string;
    readonly created_at: string;
  }[];
  readonly predictions: readonly (Authored & {
    readonly id: string;
    readonly body: string;
    readonly outcome: boolean | null;
  })[];
  readonly guesses: readonly {
    readonly prediction_id: string;
    readonly user_id: string;
    readonly says: boolean;
  }[];
  readonly checkins: readonly {
    readonly user_id: string;
    readonly spot: string;
    readonly checked_in_at: string;
  }[];
  readonly packed: readonly {
    readonly user_id: string;
    readonly item_id: string;
  }[];
  readonly ideas: readonly (Authored & {
    readonly id: string;
    readonly body: string;
  })[];
  readonly idea_votes: readonly {
    readonly idea_id: string;
    readonly user_id: string;
  }[];
  readonly songs: readonly (Authored & {
    readonly id: string;
    readonly title: string;
  })[];
}

/** An id for somebody who is no longer in the day. Matches no person. */
const GONE = "";

// ------------------------------------------------------------- assemble

/** The day as everyone in it sees it. Stable: same rows, same document. */
export function assemble(rows: SharedRows): SnowDay {
  const byTime = <T extends { created_at: string }>(a: T, b: T) =>
    a.created_at.localeCompare(b.created_at);
  const memberOf = new Map(rows.members.map((m) => [m.user_id, m.member_id]));
  const who = (userId: string | null) =>
    (userId && memberOf.get(userId)) || GONE;
  const profile = new Map(rows.people.map((p) => [p.user_id, p]));

  // The owner is the host, and the host is first.
  const members = [...rows.members].sort((a, b) =>
    a.role !== b.role
      ? a.role === "owner"
        ? -1
        : 1
      : a.joined_at.localeCompare(b.joined_at),
  );
  const people: Person[] = members.map((m) => {
    const p = profile.get(m.user_id);
    return {
      id: m.member_id,
      name: m.display_name?.trim() || "Someone",
      discipline: p && isDiscipline(p.discipline) ? p.discipline : "ski",
      ability: p && isAbility(p.ability) ? p.ability : "intermediate",
      ownGear: p?.own_gear ?? true,
      note: p?.note ?? undefined,
    };
  });

  const proposals: Proposal[] = [...rows.proposals].sort(byTime).map((p) => ({
    id: p.id,
    topic: p.topic as Topic,
    label: p.label,
    detail: p.detail ?? undefined,
    by: who(p.user_id),
    source: (p.source as Proposal["source"]) ?? undefined,
  }));
  const known = new Set(proposals.map((p) => p.id));

  const votes: Record<string, string[]> = {};
  for (const v of rows.votes) {
    const person = who(v.user_id);
    if (!person || !known.has(v.proposal_id)) continue;
    (votes[v.proposal_id] ??= []).push(person);
  }

  const chosen: Partial<Record<Topic, string>> = {};
  for (const d of rows.decisions)
    if (known.has(d.proposal_id)) chosen[d.topic as Topic] = d.proposal_id;

  const posts = [...rows.posts].sort(byTime);
  const announcements: Announcement[] = posts
    .filter((p) => p.kind !== "chat")
    .reverse()
    .map((p) => ({
      id: p.id,
      by: who(p.user_id),
      text: p.body,
      at: p.created_at,
      kind: p.kind === "change" ? "change" : "announcement",
    }));
  const chat = posts
    .filter((p) => p.kind === "chat")
    .map((p) => ({
      id: p.id,
      by: who(p.user_id),
      text: p.body,
      at: p.created_at,
    }));

  const moments = [...rows.moments].sort(byTime);
  const photos: Photo[] = moments
    .filter((m) => m.kind === "photo" && who(m.user_id))
    .map((m) => ({
      id: m.id,
      personId: who(m.user_id),
      caption: m.body,
      src: photoPath(rows.adventure.id, m.id),
      at: m.created_at,
    }));

  const guessesOf = new Map<string, Record<string, boolean>>();
  for (const g of rows.guesses) {
    const person = who(g.user_id);
    if (!person) continue;
    const bag = guessesOf.get(g.prediction_id) ?? {};
    bag[person] = g.says;
    guessesOf.set(g.prediction_id, bag);
  }
  const predictions: Prediction[] = [...rows.predictions]
    .sort(byTime)
    .map((p) => ({
      id: p.id,
      text: p.body,
      by: who(p.user_id),
      guesses: guessesOf.get(p.id) ?? {},
      ...(p.outcome === null ? {} : { outcome: p.outcome }),
    }));

  const ideaVotes = new Map<string, string[]>();
  for (const v of rows.idea_votes) {
    const person = who(v.user_id);
    if (!person) continue;
    ideaVotes.set(v.idea_id, [...(ideaVotes.get(v.idea_id) ?? []), person]);
  }

  const base = newDay({
    id: rows.adventure.id,
    title: rows.adventure.title,
    now: rows.adventure.created_at,
    host: people[0] ?? {
      id: GONE,
      name: "Someone",
      discipline: "ski",
      ability: "intermediate",
      ownGear: true,
    },
  });

  return {
    ...base,
    title: rows.adventure.title,
    date: rows.adventure.starts_on ?? undefined,
    meetTime: rows.day?.meet_time ?? undefined,
    people,
    proposals,
    votes,
    chosen,
    announcements,
    packed: rows.packed
      .filter((p) => who(p.user_id))
      .map((p) => `${who(p.user_id)}:${p.item_id}`),
    challengesOn: rows.day?.challenges_on ?? true,
    customChallenges: [...rows.challenges].sort(byTime).map((c) => ({
      id: c.id,
      title: c.title,
      by: who(c.user_id),
    })),
    completions: rows.completions
      .filter((c) => who(c.user_id))
      .map((c) => ({
        challengeId: c.challenge_id,
        personId: who(c.user_id),
        at: c.completed_at,
      })),
    photos,
    moments: moments
      .filter((m) => m.kind === "moment" && who(m.user_id))
      .map((m) => ({
        id: m.id,
        personId: who(m.user_id),
        text: m.body,
        at: m.created_at,
      })),
    checkIns: rows.checkins
      .filter((c) => who(c.user_id))
      .map((c) => ({
        personId: who(c.user_id),
        spot: c.spot,
        at: c.checked_in_at,
      })),
    playlist: [...rows.songs].sort(byTime).map((s) => ({
      id: s.id,
      title: s.title,
      by: who(s.user_id),
    })),
    ideas: [...rows.ideas].sort(byTime).map((i) => ({
      id: i.id,
      text: i.body,
      by: who(i.user_id),
      votes: ideaVotes.get(i.id) ?? [],
    })),
    predictions,
    chat,
  };
}

export const photoPath = (adventureId: string, photoId: string) =>
  `${SHARED_PHOTO}${adventureId}/photo/${photoId}`;

// ----------------------------------------------------------------- plan

/** One row-level change. `by` is always a member id; the server resolves it. */
export type Op =
  | { readonly k: "title"; readonly title: string }
  | {
      readonly k: "when";
      readonly date: string | null;
      readonly meetTime: string | null;
    }
  | { readonly k: "challengesOn"; readonly on: boolean }
  | { readonly k: "profile"; readonly patch: Partial<Omit<Person, "id">> }
  | { readonly k: "leave"; readonly personId: string }
  | { readonly k: "propose"; readonly proposal: Proposal }
  | { readonly k: "unpropose"; readonly id: string }
  | {
      readonly k: "vote";
      readonly topic: Topic;
      readonly proposalId: string | null;
    }
  | {
      readonly k: "decide";
      readonly topic: Topic;
      readonly proposalId: string | null;
    }
  | {
      readonly k: "post";
      readonly kind: "chat" | "announcement" | "change";
      readonly text: string;
    }
  | { readonly k: "unpost"; readonly id: string }
  | { readonly k: "challenge"; readonly title: string }
  | {
      readonly k: "complete";
      readonly challengeId: string;
      readonly on: boolean;
    }
  | { readonly k: "photo"; readonly caption: string; readonly src: string }
  | { readonly k: "moment"; readonly text: string }
  | { readonly k: "unmoment"; readonly id: string }
  | { readonly k: "checkin"; readonly spot: string | null }
  | { readonly k: "pack"; readonly itemId: string; readonly on: boolean }
  | { readonly k: "song"; readonly title: string }
  | { readonly k: "unsong"; readonly id: string }
  | { readonly k: "idea"; readonly text: string }
  | { readonly k: "ideaVote"; readonly id: string; readonly on: boolean }
  | { readonly k: "predict"; readonly text: string }
  | { readonly k: "unpredict"; readonly id: string }
  | {
      readonly k: "guess";
      readonly id: string;
      readonly says: boolean | null;
    }
  | {
      readonly k: "settle";
      readonly id: string;
      readonly outcome: boolean | null;
    };

export interface Who {
  /** The caller's member id in this day. */
  readonly me: string;
  readonly isOwner: boolean;
}

export type Plan =
  | { readonly ok: true; readonly day: SnowDay; readonly ops: readonly Op[] }
  | { readonly ok: false; readonly reason: string };

const refuse = (reason: string): Plan => ({ ok: false, reason });
const ONLY_YOU = "You can only do that as yourself.";
const ONLY_HOST = "Only the host can do that.";
const NOT_YOURS = "Only whoever added that, or the host, can remove it.";

/**
 * Decide a change and say which rows it becomes.
 *
 * `applyAction` decides whether it makes sense (the same function the screen
 * ran). This decides whether *this person* may do it, and translates it. The
 * client never says who it is: any person id in an action must be the
 * caller's own, so a modified client cannot vote, guess, check in or post
 * for somebody else even before row-level security is asked.
 */
export function plan(
  day: SnowDay,
  action: Action,
  who: Who,
  now: string,
): Plan {
  const me = who.me;
  const mine = (id: string) => id === me;
  const authorOrHost = (author: string | undefined) =>
    who.isOwner || (author !== undefined && author !== GONE && mine(author));

  // Who may do it, before whether it makes sense: a refusal should not
  // reveal anything about a day the caller may not change.
  switch (action.type) {
    case "title":
    case "when":
    case "challenges":
      if (!who.isOwner) return refuse(ONLY_HOST);
      break;
    case "choose":
      if (!who.isOwner) return refuse(ONLY_HOST);
      break;
    case "addPerson":
      return refuse(
        "People join with the invite link. Send it from the Crew tab.",
      );
    case "updatePerson":
      if (!mine(action.id)) return refuse(ONLY_YOU);
      break;
    case "removePerson":
      if (!mine(action.id) && !who.isOwner) return refuse(ONLY_HOST);
      break;
    case "propose":
      if (!mine(action.proposal.by)) return refuse(ONLY_YOU);
      break;
    case "withdraw":
      if (!authorOrHost(day.proposals.find((p) => p.id === action.id)?.by))
        return refuse(NOT_YOURS);
      break;
    case "vote":
      if (!mine(action.personId)) return refuse(ONLY_YOU);
      break;
    case "announce":
      if (!mine(action.by)) return refuse(ONLY_YOU);
      break;
    case "unannounce":
      if (!authorOrHost(day.announcements.find((a) => a.id === action.id)?.by))
        return refuse(NOT_YOURS);
      break;
    case "pack":
    case "complete":
    case "uncomplete":
    case "checkIn":
    case "checkOut":
    case "voteIdea":
    case "guess":
      if (!mine(action.personId)) return refuse(ONLY_YOU);
      break;
    case "customChallenge":
    case "song":
    case "idea":
    case "predict":
    case "say":
      if (!mine(action.by)) return refuse(ONLY_YOU);
      break;
    case "photo":
      if (!mine(action.photo.personId)) return refuse(ONLY_YOU);
      break;
    case "moment":
      if (!mine(action.moment.personId)) return refuse(ONLY_YOU);
      break;
    case "removePhoto":
      if (!authorOrHost(day.photos.find((p) => p.id === action.id)?.personId))
        return refuse(NOT_YOURS);
      break;
    case "removeSong":
      if (!authorOrHost(day.playlist.find((s) => s.id === action.id)?.by))
        return refuse(NOT_YOURS);
      break;
    case "removePrediction":
      if (!authorOrHost(day.predictions.find((p) => p.id === action.id)?.by))
        return refuse(NOT_YOURS);
      break;
    case "settle":
      if (!authorOrHost(day.predictions.find((p) => p.id === action.id)?.by))
        return refuse("Only whoever made the call, or the host, settles it.");
      break;
    case "unsay":
      if (!authorOrHost(day.chat.find((m) => m.id === action.id)?.by))
        return refuse(NOT_YOURS);
      break;
  }

  const result = applyAction(day, action, now);
  if (!result.ok) return refuse(result.reason);
  const next = result.day;
  return { ok: true, day: next, ops: opsFor(day, next, action) };
}

function opsFor(before: SnowDay, after: SnowDay, a: Action): Op[] {
  switch (a.type) {
    case "title":
      return [{ k: "title", title: after.title }];
    case "when":
      return [
        {
          k: "when",
          date: after.date ?? null,
          meetTime: after.meetTime ?? null,
        },
      ];
    case "challenges":
      return [{ k: "challengesOn", on: a.on }];
    case "addPerson":
      return [];
    case "updatePerson":
      return [{ k: "profile", patch: a.patch }];
    case "removePerson":
      return [{ k: "leave", personId: a.id }];
    case "propose": {
      const added = after.proposals.at(-1);
      return added ? [{ k: "propose", proposal: added }] : [];
    }
    case "withdraw":
      return [{ k: "unpropose", id: a.id }];
    case "vote": {
      const topic = after.proposals.find((p) => p.id === a.proposalId)?.topic;
      if (!topic) return [];
      return [{ k: "vote", topic, proposalId: a.on ? a.proposalId : null }];
    }
    case "choose": {
      const ops: Op[] = [
        { k: "decide", topic: a.topic, proposalId: a.proposalId },
      ];
      // Choosing a date sets the day's date; un-choosing leaves it be.
      if (after.date !== before.date)
        ops.push({
          k: "when",
          date: after.date ?? null,
          meetTime: after.meetTime ?? null,
        });
      // A plan that moved after it was settled tells everyone, once: the
      // notice `applyAction` wrote is the one stored.
      const notice = after.announcements.find(
        (n) => n.id === a.changeId && n.kind === "change",
      );
      if (notice) ops.push({ k: "post", kind: "change", text: notice.text });
      return ops;
    }
    case "announce":
      return [
        { k: "post", kind: "announcement", text: after.announcements[0]!.text },
      ];
    case "unannounce":
      return [{ k: "unpost", id: a.id }];
    case "say":
      return [{ k: "post", kind: "chat", text: after.chat.at(-1)!.text }];
    case "unsay":
      return [{ k: "unpost", id: a.id }];
    case "pack":
      return [{ k: "pack", itemId: a.itemId, on: a.on }];
    case "customChallenge":
      return [{ k: "challenge", title: after.customChallenges.at(-1)!.title }];
    case "complete":
      return [{ k: "complete", challengeId: a.challengeId, on: true }];
    case "uncomplete":
      return [{ k: "complete", challengeId: a.challengeId, on: false }];
    case "photo":
      return [
        {
          k: "photo",
          caption: after.photos.at(-1)!.caption,
          src: a.photo.src,
        },
      ];
    case "removePhoto":
      return [{ k: "unmoment", id: a.id }];
    case "moment":
      return [{ k: "moment", text: after.moments.at(-1)!.text }];
    case "checkIn":
      return [{ k: "checkin", spot: after.checkIns.at(-1)!.spot }];
    case "checkOut":
      return [{ k: "checkin", spot: null }];
    case "song":
      return [{ k: "song", title: after.playlist.at(-1)!.title }];
    case "removeSong":
      return [{ k: "unsong", id: a.id }];
    case "idea":
      return [{ k: "idea", text: after.ideas.at(-1)!.text }];
    case "voteIdea":
      return [{ k: "ideaVote", id: a.id, on: a.on }];
    case "predict":
      return [{ k: "predict", text: after.predictions.at(-1)!.text }];
    case "removePrediction":
      return [{ k: "unpredict", id: a.id }];
    case "guess":
      return [{ k: "guess", id: a.id, says: a.says }];
    case "settle":
      return [{ k: "settle", id: a.id, outcome: a.outcome }];
  }
}

/** The topics, for validating what a route is handed. */
export const isTopic = (t: unknown): t is Topic =>
  typeof t === "string" && (TOPICS as readonly string[]).includes(t);

// -------------------------------------------------------------- parseAction

const str = (v: unknown, max = 400): v is string =>
  typeof v === "string" && v.length <= max;
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * An `Action` from a request body, or `null`. Nothing a phone sends is
 * believed: every field is checked for its type and size before
 * `applyAction` sees it, so a malformed body is a 400, never a throw.
 */
export function parseAction(raw: unknown): Action | null {
  if (!obj(raw) || typeof raw.type !== "string") return null;
  const r = raw;
  const t = r.type;
  const ids = (...keys: string[]) => keys.every((k) => str(r[k], 80));
  switch (t) {
    case "title":
      return str(r.title) ? { type: t, title: r.title } : null;
    case "when":
      return (r.date === undefined || str(r.date, 10)) &&
        (r.meetTime === undefined || str(r.meetTime, 5))
        ? {
            type: t,
            date: r.date as string | undefined,
            meetTime: r.meetTime as string | undefined,
          }
        : null;
    case "addPerson":
      return null; // people join by invitation, never by being added
    case "updatePerson": {
      const patch = r.patch;
      if (!ids("id") || !obj(patch)) return null;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (k === "ownGear" && typeof v === "boolean") out[k] = v;
        else if (
          ["name", "note", "discipline", "ability"].includes(k) &&
          str(v, 80)
        )
          out[k] = v;
        else return null;
      }
      return { type: t, id: r.id as string, patch: out };
    }
    case "removePerson":
    case "withdraw":
    case "unannounce":
    case "removePhoto":
    case "removeSong":
    case "removePrediction":
    case "unsay":
      return ids("id") ? ({ type: t, id: r.id } as Action) : null;
    case "propose": {
      const p = r.proposal;
      return obj(p) &&
        str(p.id, 80) &&
        str(p.by, 80) &&
        str(p.label, 200) &&
        isTopic(p.topic) &&
        (p.detail === undefined || str(p.detail, 400)) &&
        (p.source === undefined ||
          p.source === "atlas" ||
          p.source === "passport-list" ||
          p.source === "crew")
        ? {
            type: t,
            proposal: {
              id: p.id,
              by: p.by,
              label: p.label,
              topic: p.topic,
              detail: p.detail as string | undefined,
              source: p.source as Proposal["source"],
            },
          }
        : null;
    }
    case "vote":
      return ids("proposalId", "personId") && typeof r.on === "boolean"
        ? {
            type: t,
            proposalId: r.proposalId as string,
            personId: r.personId as string,
            on: r.on,
          }
        : null;
    case "choose":
      return isTopic(r.topic) &&
        (r.proposalId === null || str(r.proposalId, 80)) &&
        ids("by", "changeId")
        ? {
            type: t,
            topic: r.topic,
            proposalId: r.proposalId as string | null,
            by: r.by as string,
            changeId: r.changeId as string,
          }
        : null;
    case "announce":
    case "say":
      return ids("id", "by", "text")
        ? ({ type: t, id: r.id, by: r.by, text: r.text } as Action)
        : null;
    case "pack":
      return ids("personId", "itemId") && typeof r.on === "boolean"
        ? {
            type: t,
            personId: r.personId as string,
            itemId: r.itemId as string,
            on: r.on,
          }
        : null;
    case "challenges":
      return typeof r.on === "boolean" ? { type: t, on: r.on } : null;
    case "customChallenge":
      return ids("id", "title", "by")
        ? {
            type: t,
            id: r.id as string,
            title: r.title as string,
            by: r.by as string,
          }
        : null;
    case "complete":
    case "uncomplete":
      return ids("challengeId", "personId")
        ? ({
            type: t,
            challengeId: r.challengeId,
            personId: r.personId,
          } as Action)
        : null;
    case "photo": {
      const p = r.photo;
      return obj(p) &&
        str(p.id, 80) &&
        str(p.personId, 80) &&
        str(p.caption, 400) &&
        str(p.src, 700_000) &&
        p.src.startsWith("data:image/")
        ? {
            type: t,
            photo: {
              id: p.id,
              personId: p.personId,
              caption: p.caption,
              src: p.src,
              at: "",
            },
          }
        : null;
    }
    case "moment": {
      const m = r.moment;
      return obj(m) && str(m.id, 80) && str(m.personId, 80) && str(m.text, 400)
        ? {
            type: t,
            moment: { id: m.id, personId: m.personId, text: m.text, at: "" },
          }
        : null;
    }
    case "checkIn":
      return ids("personId") && str(r.spot, 200)
        ? { type: t, personId: r.personId as string, spot: r.spot }
        : null;
    case "checkOut":
      return ids("personId")
        ? { type: t, personId: r.personId as string }
        : null;
    case "song":
      return ids("id", "title", "by")
        ? {
            type: t,
            id: r.id as string,
            title: r.title as string,
            by: r.by as string,
          }
        : null;
    case "idea":
      return ids("id", "by") && str(r.text, 400)
        ? { type: t, id: r.id as string, text: r.text, by: r.by as string }
        : null;
    case "voteIdea":
      return ids("id", "personId") && typeof r.on === "boolean"
        ? {
            type: t,
            id: r.id as string,
            personId: r.personId as string,
            on: r.on,
          }
        : null;
    case "predict":
      return ids("id", "by") && str(r.text, 400)
        ? { type: t, id: r.id as string, text: r.text, by: r.by as string }
        : null;
    case "guess":
      return ids("id", "personId") &&
        (r.says === null || typeof r.says === "boolean")
        ? {
            type: t,
            id: r.id as string,
            personId: r.personId as string,
            says: r.says as boolean | null,
          }
        : null;
    case "settle":
      return ids("id") && (r.outcome === null || typeof r.outcome === "boolean")
        ? { type: t, id: r.id as string, outcome: r.outcome as boolean | null }
        : null;
    default:
      return null;
  }
}
