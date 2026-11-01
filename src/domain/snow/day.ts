import {
  isAbility,
  isDiscipline,
  type Ability,
  type Discipline,
} from "./ability";
import { checkChallengeText, challengeById } from "./challenges";

/**
 * **A snow day, as a plain value.**
 *
 * Everything the crew has decided and done sits in one serialisable
 * document, and every change is a pure `applyAction(day, action)`. That is
 * the seam: the screen, the offline copy on a phone, and — when the shared
 * tables exist (docs/product/snow/SHARING.md) — a server all speak the same
 * actions. Nothing in here touches a clock, a random id or storage; callers
 * pass `now` and ids in, which is what makes it testable.
 */
export const TOPICS = [
  "date",
  "mountain",
  "transport",
  "meeting",
  "tickets",
  "meals",
  "apres",
] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABEL: Record<Topic, string> = {
  date: "Date",
  mountain: "Mountain",
  transport: "Getting there",
  meeting: "Meeting points",
  tickets: "Lift tickets",
  meals: "Meals",
  apres: "Après",
};

/** One line under each topic's heading — what the crew is deciding. */
export const TOPIC_PROMPT: Record<Topic, string> = {
  date: "Which day works for everyone?",
  mountain: "Where are we riding?",
  transport: "Who drives, who rides along, where do we leave from?",
  meeting: "Where do we find each other — lodge, lift base, lunch spot?",
  tickets:
    "How is everyone getting on the lift? Prices are the resort's to state — add what you find.",
  meals: "Packed lunch, lodge, or somewhere in town?",
  apres: "What happens when the lifts stop?",
};

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly discipline: Discipline;
  readonly ability: Ability;
  /** Needs rentals / has own gear. */
  readonly ownGear: boolean;
  /** Anything the crew should know: dietary, nervous about lifts, driving. */
  readonly note?: string;
}

export interface Proposal {
  readonly id: string;
  readonly topic: Topic;
  readonly label: string;
  readonly detail?: string;
  readonly by: string;
  /** Where this came from, so the screen can show Atlas apart from a guess. */
  readonly source?: "atlas" | "passport-list" | "crew";
}

export interface Announcement {
  readonly id: string;
  readonly by: string;
  readonly text: string;
  readonly at: string;
  readonly kind: "announcement" | "change";
}

export interface Completion {
  readonly challengeId: string;
  readonly personId: string;
  readonly at: string;
}

export interface Photo {
  readonly id: string;
  readonly personId: string;
  readonly caption: string;
  /** A small data URL, kept on this device. */
  readonly src: string;
  readonly at: string;
}

export interface Moment {
  readonly id: string;
  readonly personId: string;
  readonly text: string;
  readonly at: string;
}

export interface CheckIn {
  readonly personId: string;
  readonly spot: string;
  readonly at: string;
}

export interface Idea {
  readonly id: string;
  readonly text: string;
  readonly by: string;
  readonly votes: readonly string[];
}

export interface SnowDay {
  readonly v: 1;
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly date?: string;
  readonly meetTime?: string;
  readonly people: readonly Person[];
  readonly proposals: readonly Proposal[];
  /** proposal id → people who voted for it. One vote per person per topic. */
  readonly votes: Readonly<Record<string, readonly string[]>>;
  readonly chosen: Readonly<Partial<Record<Topic, string>>>;
  readonly announcements: readonly Announcement[];
  /** `${personId}:${itemId}` for every packed item. */
  readonly packed: readonly string[];
  readonly challengesOn: boolean;
  readonly customChallenges: readonly {
    id: string;
    title: string;
    by: string;
  }[];
  readonly completions: readonly Completion[];
  readonly photos: readonly Photo[];
  readonly moments: readonly Moment[];
  readonly checkIns: readonly CheckIn[];
  readonly playlist: readonly { id: string; title: string; by: string }[];
  readonly ideas: readonly Idea[];
}

export const LIMITS = {
  people: 24,
  proposals: 80,
  photos: 16,
  moments: 60,
  announcements: 60,
  ideas: 12,
  playlist: 30,
} as const;

export function newDay(input: {
  id: string;
  title: string;
  now: string;
  host: Omit<Person, "id"> & { id: string };
}): SnowDay {
  return {
    v: 1,
    id: input.id,
    title: clean(input.title, 60) || "Our snow day",
    createdAt: input.now,
    people: [input.host],
    proposals: [],
    votes: {},
    chosen: {},
    announcements: [],
    packed: [],
    challengesOn: true,
    customChallenges: [],
    completions: [],
    photos: [],
    moments: [],
    checkIns: [],
    playlist: [],
    ideas: [],
  };
}

export type Action =
  | { type: "title"; title: string }
  | { type: "when"; date?: string; meetTime?: string }
  | { type: "addPerson"; person: Person }
  | { type: "updatePerson"; id: string; patch: Partial<Omit<Person, "id">> }
  | { type: "removePerson"; id: string }
  | { type: "propose"; proposal: Proposal }
  | { type: "withdraw"; id: string }
  | { type: "vote"; proposalId: string; personId: string; on: boolean }
  | {
      type: "choose";
      topic: Topic;
      proposalId: string | null;
      by: string;
      changeId: string;
    }
  | { type: "announce"; id: string; by: string; text: string }
  | { type: "unannounce"; id: string }
  | { type: "pack"; personId: string; itemId: string; on: boolean }
  | { type: "challenges"; on: boolean }
  | { type: "customChallenge"; id: string; title: string; by: string }
  | { type: "complete"; challengeId: string; personId: string }
  | { type: "uncomplete"; challengeId: string; personId: string }
  | { type: "photo"; photo: Photo }
  | { type: "removePhoto"; id: string }
  | { type: "moment"; moment: Moment }
  | { type: "checkIn"; personId: string; spot: string }
  | { type: "checkOut"; personId: string }
  | { type: "song"; id: string; title: string; by: string }
  | { type: "removeSong"; id: string }
  | { type: "idea"; id: string; text: string; by: string }
  | { type: "voteIdea"; id: string; personId: string; on: boolean };

export type Result = { ok: true; day: SnowDay } | { ok: false; reason: string };

const ok = (day: SnowDay): Result => ({ ok: true, day });
const no = (reason: string): Result => ({ ok: false, reason });

export function clean(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

const has = (day: SnowDay, personId: string) =>
  day.people.some((p) => p.id === personId);

/** Who the day names as being "here" — for check-ins and points. */
export function personName(day: SnowDay, id: string | undefined): string {
  return day.people.find((p) => p.id === id)?.name ?? "Someone";
}

/**
 * Apply one change. Refuses (rather than guessing) anything that does not
 * make sense, and says why in words a person can read.
 */
export function applyAction(day: SnowDay, action: Action, now: string): Result {
  switch (action.type) {
    case "title": {
      const title = clean(action.title, 60);
      return title ? ok({ ...day, title }) : no("Give the day a name.");
    }
    case "when": {
      if (
        action.date !== undefined &&
        action.date !== "" &&
        !isRealDate(action.date)
      )
        return no("That isn't a real date.");
      if (action.meetTime && !TIME.test(action.meetTime))
        return no("Use a time like 08:30.");
      return ok({
        ...day,
        date: action.date ? action.date : undefined,
        meetTime: action.meetTime ? action.meetTime : undefined,
      });
    }
    case "addPerson": {
      const p = action.person;
      const name = clean(p.name, 30);
      if (!name) return no("Everyone needs a name.");
      if (day.people.length >= LIMITS.people)
        return no(`A crew tops out at ${LIMITS.people}.`);
      if (day.people.some((q) => q.name.toLowerCase() === name.toLowerCase()))
        return no(`${name} is already in the crew.`);
      if (!isAbility(p.ability) || !isDiscipline(p.discipline))
        return no("Pick a level and what they're riding.");
      return ok({
        ...day,
        people: [
          ...day.people,
          { ...p, name, note: p.note ? clean(p.note, 80) : undefined },
        ],
      });
    }
    case "updatePerson": {
      if (!has(day, action.id)) return no("They aren't in this crew.");
      const patch = { ...action.patch };
      if (patch.name !== undefined) {
        patch.name = clean(patch.name, 30);
        if (!patch.name) return no("Everyone needs a name.");
      }
      if (patch.ability !== undefined && !isAbility(patch.ability))
        return no("Unknown level.");
      if (patch.discipline !== undefined && !isDiscipline(patch.discipline))
        return no("Unknown discipline.");
      if (patch.note !== undefined) patch.note = clean(patch.note, 80);
      return ok({
        ...day,
        people: day.people.map((p) =>
          p.id === action.id ? { ...p, ...patch } : p,
        ),
      });
    }
    case "removePerson": {
      if (day.people[0]?.id === action.id)
        return no("The host can't leave their own day.");
      if (!has(day, action.id)) return day_noop(day);
      const gone = action.id;
      return ok({
        ...day,
        people: day.people.filter((p) => p.id !== gone),
        votes: Object.fromEntries(
          Object.entries(day.votes).map(([k, v]) => [
            k,
            v.filter((id) => id !== gone),
          ]),
        ),
        completions: day.completions.filter((c) => c.personId !== gone),
        packed: day.packed.filter((k) => !k.startsWith(`${gone}:`)),
        checkIns: day.checkIns.filter((c) => c.personId !== gone),
        ideas: day.ideas.map((i) => ({
          ...i,
          votes: i.votes.filter((id) => id !== gone),
        })),
      });
    }
    case "propose": {
      const p = action.proposal;
      const label = clean(p.label, 80);
      if (!label) return no("Say what you're suggesting.");
      if (!(TOPICS as readonly string[]).includes(p.topic))
        return no("Unknown topic.");
      if (!has(day, p.by)) return no("Only the crew can suggest things.");
      if (day.proposals.length >= LIMITS.proposals)
        return no("That's a lot of options — vote on some first.");
      if (p.topic === "date" && !isRealDate(label))
        return no("Dates look like 2026-12-20.");
      if (
        day.proposals.some(
          (q) =>
            q.topic === p.topic &&
            q.label.toLowerCase() === label.toLowerCase(),
        )
      )
        return no("That one is already on the list.");
      return ok({
        ...day,
        proposals: [
          ...day.proposals,
          { ...p, label, detail: p.detail ? clean(p.detail, 140) : undefined },
        ],
      });
    }
    case "withdraw": {
      const gone = day.proposals.find((p) => p.id === action.id);
      if (!gone) return day_noop(day);
      const chosen = { ...day.chosen };
      if (chosen[gone.topic] === gone.id) delete chosen[gone.topic];
      const votes = { ...day.votes };
      delete votes[gone.id];
      return ok(
        sync({
          ...day,
          proposals: day.proposals.filter((p) => p.id !== gone.id),
          votes,
          chosen,
        }),
      );
    }
    case "vote": {
      const proposal = day.proposals.find((p) => p.id === action.proposalId);
      if (!proposal) return no("That option is gone.");
      if (!has(day, action.personId)) return no("Only the crew votes.");
      const votes: Record<string, readonly string[]> = { ...day.votes };
      // One vote per person per topic: backing a new option moves your vote.
      for (const q of day.proposals)
        if (q.topic === proposal.topic)
          votes[q.id] = (votes[q.id] ?? []).filter(
            (id) => id !== action.personId,
          );
      if (action.on)
        votes[proposal.id] = [...(votes[proposal.id] ?? []), action.personId];
      return ok({ ...day, votes });
    }
    case "choose": {
      if (action.proposalId === null) {
        const chosen = { ...day.chosen };
        delete chosen[action.topic];
        return ok(sync({ ...day, chosen }));
      }
      const proposal = day.proposals.find(
        (p) => p.id === action.proposalId && p.topic === action.topic,
      );
      if (!proposal) return no("That option is gone.");
      const before = day.chosen[action.topic];
      if (before === proposal.id) return day_noop(day);
      const changed = before !== undefined;
      let next: SnowDay = sync({
        ...day,
        chosen: { ...day.chosen, [action.topic]: proposal.id },
      });
      // A plan that moves after it was settled tells everyone, once.
      if (changed) {
        next = {
          ...next,
          announcements: [
            {
              id: action.changeId,
              by: action.by,
              text: `${TOPIC_LABEL[action.topic]} changed to ${displayLabel(proposal)}.`,
              at: now,
              kind: "change" as const,
            },
            ...next.announcements,
          ].slice(0, LIMITS.announcements),
        };
      }
      return ok(next);
    }
    case "announce": {
      const text = clean(action.text, 200);
      if (!text) return no("Write the update first.");
      if (!has(day, action.by)) return no("Only the crew can post.");
      return ok({
        ...day,
        announcements: [
          {
            id: action.id,
            by: action.by,
            text,
            at: now,
            kind: "announcement" as const,
          },
          ...day.announcements,
        ].slice(0, LIMITS.announcements),
      });
    }
    case "unannounce":
      return ok({
        ...day,
        announcements: day.announcements.filter((a) => a.id !== action.id),
      });
    case "pack": {
      if (!has(day, action.personId)) return no("They aren't in this crew.");
      const key = `${action.personId}:${action.itemId}`;
      const rest = day.packed.filter((k) => k !== key);
      return ok({ ...day, packed: action.on ? [...rest, key] : rest });
    }
    case "challenges":
      return ok({ ...day, challengesOn: action.on });
    case "customChallenge": {
      const title = clean(action.title, 90);
      const check = checkChallengeText(title);
      if (!check.ok) return no(check.reason);
      if (!has(day, action.by)) return no("Only the crew can add challenges.");
      if (day.customChallenges.length >= 6)
        return no("Six crew challenges is plenty.");
      return ok({
        ...day,
        customChallenges: [
          ...day.customChallenges,
          { id: action.id, title, by: action.by },
        ],
      });
    }
    case "complete": {
      if (!day.challengesOn)
        return no("Challenges are switched off for this day.");
      if (!challengeById(action.challengeId, day.customChallenges))
        return no("That challenge isn't on the list.");
      if (!has(day, action.personId)) return no("They aren't in this crew.");
      if (
        day.completions.some(
          (c) =>
            c.challengeId === action.challengeId &&
            c.personId === action.personId,
        )
      )
        return day_noop(day);
      return ok({
        ...day,
        completions: [
          ...day.completions,
          {
            challengeId: action.challengeId,
            personId: action.personId,
            at: now,
          },
        ],
      });
    }
    case "uncomplete":
      return ok({
        ...day,
        completions: day.completions.filter(
          (c) =>
            !(
              c.challengeId === action.challengeId &&
              c.personId === action.personId
            ),
        ),
      });
    case "photo": {
      if (!has(day, action.photo.personId))
        return no("They aren't in this crew.");
      if (day.photos.length >= LIMITS.photos)
        return no(
          `This device keeps ${LIMITS.photos} photos per day. Remove one first.`,
        );
      return ok({
        ...day,
        photos: [
          ...day.photos,
          {
            ...action.photo,
            caption: clean(action.photo.caption, 120),
            at: now,
          },
        ],
      });
    }
    case "removePhoto":
      return ok({
        ...day,
        photos: day.photos.filter((p) => p.id !== action.id),
      });
    case "moment": {
      const text = clean(action.moment.text, 200);
      if (!text) return no("Write the moment first.");
      if (!has(day, action.moment.personId))
        return no("They aren't in this crew.");
      return ok({
        ...day,
        moments: [...day.moments, { ...action.moment, text, at: now }].slice(
          -LIMITS.moments,
        ),
      });
    }
    case "checkIn": {
      const spot = clean(action.spot, 60);
      if (!spot) return no("Say where you are.");
      if (!has(day, action.personId)) return no("They aren't in this crew.");
      return ok({
        ...day,
        checkIns: [
          ...day.checkIns.filter((c) => c.personId !== action.personId),
          { personId: action.personId, spot, at: now },
        ],
      });
    }
    case "checkOut":
      return ok({
        ...day,
        checkIns: day.checkIns.filter((c) => c.personId !== action.personId),
      });
    case "song": {
      const title = clean(action.title, 80);
      if (!title) return no("Name the song.");
      if (day.playlist.length >= LIMITS.playlist)
        return no("The playlist is full.");
      return ok({
        ...day,
        playlist: [...day.playlist, { id: action.id, title, by: action.by }],
      });
    }
    case "removeSong":
      return ok({
        ...day,
        playlist: day.playlist.filter((s) => s.id !== action.id),
      });
    case "idea": {
      const text = clean(action.text, 100);
      if (!text) return no("What should the next one be?");
      if (day.ideas.length >= LIMITS.ideas)
        return no("That's plenty of ideas — vote!");
      return ok({
        ...day,
        ideas: [
          ...day.ideas,
          { id: action.id, text, by: action.by, votes: [] },
        ],
      });
    }
    case "voteIdea": {
      if (!has(day, action.personId)) return no("Only the crew votes.");
      return ok({
        ...day,
        ideas: day.ideas.map((i) =>
          i.id !== action.id
            ? i
            : {
                ...i,
                votes: action.on
                  ? [...new Set([...i.votes, action.personId])]
                  : i.votes.filter((v) => v !== action.personId),
              },
        ),
      });
    }
  }
}

function day_noop(day: SnowDay): Result {
  return ok(day);
}

/** The date topic drives `date`: choosing a date proposal sets it. */
function sync(day: SnowDay): SnowDay {
  const chosenDate = day.proposals.find((p) => p.id === day.chosen.date);
  return { ...day, date: chosenDate ? chosenDate.label : day.date };
}

export function displayLabel(p: Proposal): string {
  return p.label;
}

// ------------------------------------------------------------------ reading

export function proposalsFor(day: SnowDay, topic: Topic): Proposal[] {
  return day.proposals.filter((p) => p.topic === topic);
}

export function votesFor(day: SnowDay, proposalId: string): number {
  return (day.votes[proposalId] ?? []).length;
}

/** The option with the most votes — earliest suggested wins a tie. */
export function leading(day: SnowDay, topic: Topic): Proposal | undefined {
  let best: Proposal | undefined;
  for (const p of proposalsFor(day, topic)) {
    const n = votesFor(day, p.id);
    if (n > 0 && (!best || n > votesFor(day, best.id))) best = p;
  }
  return best;
}

export function chosenFor(day: SnowDay, topic: Topic): Proposal | undefined {
  return day.proposals.find((p) => p.id === day.chosen[topic]);
}

/** Topics with options but no decision yet. */
export function undecided(day: SnowDay): Topic[] {
  return TOPICS.filter(
    (t) => proposalsFor(day, t).length > 0 && !chosenFor(day, t),
  );
}

export function isPacked(day: SnowDay, personId: string, itemId: string) {
  return day.packed.includes(`${personId}:${itemId}`);
}

// ------------------------------------------------------------ persistence

/** Parse a stored or shared day, or `null` if it is not one. Never throws. */
export function parseDay(raw: unknown): SnowDay | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<SnowDay>;
  if (d.v !== 1 || typeof d.id !== "string" || typeof d.title !== "string")
    return null;
  if (!Array.isArray(d.people) || d.people.length === 0) return null;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    v: 1,
    id: d.id,
    title: clean(d.title, 60) || "Our snow day",
    createdAt:
      typeof d.createdAt === "string" ? d.createdAt : new Date(0).toISOString(),
    date: typeof d.date === "string" && isRealDate(d.date) ? d.date : undefined,
    meetTime:
      typeof d.meetTime === "string" && TIME.test(d.meetTime)
        ? d.meetTime
        : undefined,
    people: arr<Person>(d.people).filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        isAbility(p.ability) &&
        isDiscipline(p.discipline),
    ),
    proposals: arr<Proposal>(d.proposals),
    votes: d.votes && typeof d.votes === "object" ? d.votes : {},
    chosen: d.chosen && typeof d.chosen === "object" ? d.chosen : {},
    announcements: arr<Announcement>(d.announcements),
    packed: arr<string>(d.packed),
    challengesOn: d.challengesOn !== false,
    customChallenges: arr(d.customChallenges),
    completions: arr<Completion>(d.completions),
    photos: arr<Photo>(d.photos).filter(
      (p) => typeof p?.src === "string" && p.src.startsWith("data:image/"),
    ),
    moments: arr<Moment>(d.moments),
    checkIns: arr<CheckIn>(d.checkIns),
    playlist: arr(d.playlist),
    ideas: arr<Idea>(d.ideas),
  };
}
