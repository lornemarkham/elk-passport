import { planBlock, planLines } from "./plan";
import { editionLabel, editionOf, type SeriesDetails } from "./edition";
import { hockeyNight } from "@/experience-lab/fixtures/hockeyNight";
import { curatedNear } from "@/domain/collections/places";
import { VANCOUVER_PLACES } from "@/domain/collections/vancouver";
import { walkLabel } from "./nearby";
import { modulesOf, promptIsOn, storedModules, type ModuleId } from "./modules";
import {
  MARKET_PROMPT,
  cupLines,
  gameOf,
  settle,
  type Market,
  type PlayRows,
  type Settled,
} from "./challenges";
import { phaseReached } from "@/experience-lab/core/phase";
import type {
  Brief,
  Edge,
  ExperienceDefinition,
  ExperienceState,
  Moment,
  Participant,
  Prompt,
  PromptOption,
  Response,
  ResponseValue,
  Starter,
  ToyFamily,
} from "@/experience-lab/core/types";

/**
 * **Sycle Hockey Night, the real one.**
 *
 * The Experience Lab's hockey fixture is the design, the personality and the
 * jokes; it is also, by its own header, entirely invented — Nathan, Dave,
 * Sarah's question, last March's standings, the 4–3 final. This file keeps
 * everything that is *structure and voice* (phases, headlines, blocks, toy
 * box wording, awards, the questions themselves) and replaces everything that
 * is *a fact about people or the world* with what the database says.
 *
 * The rule, so the next edit keeps it: nothing on the real night's page may be
 * a thing that did not happen or a person who is not there.
 */

export const TEMPLATE = "sycle-hockey-night";

export interface NightDetails {
  readonly home: string;
  readonly opponent: string;
  readonly opponentEmoji: string;
  readonly venue: string;
  readonly city: string;
  /** [lat, lng] of the venue, for distances to anywhere the group nominates. */
  readonly venueAt: readonly [number, number];
}

/**
 * The night M216 is for. Sunday 25 October 2026, 7pm Pacific — PDT, which
 * ends on 1 November, so UTC−7 and 02:00Z on the 26th.
 */
export const SYCLE_HOCKEY_NIGHT = {
  template: TEMPLATE,
  title: "Sycle Hockey Night",
  startsAt: "2026-10-26T02:00:00.000Z",
  details: {
    home: "Canucks",
    opponent: "Wild",
    opponentEmoji: "🌲",
    venue: "Rogers Arena",
    city: "Vancouver",
    // Rogers Arena, 800 Griffiths Way. Rounded; good to a few metres.
    venueAt: [49.2778, -123.1088],
  } satisfies NightDetails,
} as const;

// ------------------------------------------------------------------ rows

export interface OccasionRow {
  readonly id: string;
  readonly template: string;
  readonly title: string;
  readonly starts_at: string;
  readonly host_id: string;
  /**
   * Template parameters, which run of nights this one belongs to, and which
   * modules the host left on (`modules.ts`; absent means all of them).
   */
  readonly details: Partial<NightDetails> &
    SeriesDetails & {
      readonly modules?: readonly string[];
      /** Chirp Bot in the chat (`chirp.ts`); absent means on. */
      readonly chirp?: boolean;
    };
  readonly brief: Brief | null;
}

export interface MemberRow {
  readonly user_id: string;
  readonly role: "host" | "guest";
  readonly display_name: string;
  readonly emoji: string;
  readonly hue: number;
  readonly vibe: string | null;
  readonly edge: number | null;
  readonly joined_at: string;
  /** Who they bleed for (`fans.ts`), when chirp-migration.sql is applied. */
  readonly nhl_team?: string | null;
  /** At the arena or on the couch (`crowd.ts`), when alive-migration.sql is applied. */
  readonly watching?: string | null;
}

export interface PromptRow {
  readonly prompt_id: string;
  readonly reveal: Prompt["reveal"];
  readonly lock_offset_minutes: number | null;
  readonly audience_only: string | null;
  readonly open_to_suggestions: boolean;
  readonly asked_by: string | null;
  readonly content: Prompt | null;
  readonly resolution: ResponseValue | null;
  /** When it was asked; orders the per-asker cap (`scoringOf`). */
  readonly created_at?: string;
}

export interface OptionRow {
  readonly id: string;
  readonly prompt_id: string;
  readonly label: string;
  readonly detail: string | null;
  readonly added_by: string;
}

export interface ResponseRow {
  readonly prompt_id: string;
  readonly user_id: string;
  readonly value: ResponseValue;
  readonly answered_at: string;
}

export interface MomentRow {
  readonly id: string;
  readonly actor_id: string;
  readonly kind: "note" | "join" | "photo" | "chirp";
  readonly text: string | null;
  readonly emoji: string | null;
  readonly at: string;
  /** Chirp Bot's lines only (`chirp.ts`): what it is, which line, its signature. */
  readonly bot_key?: string | null;
  readonly bot_line?: string | null;
  readonly bot_sig?: string | null;
}

export interface ReactionRow {
  readonly moment_id: string;
  readonly emoji: string;
  readonly user_id: string;
}

export interface CueRow {
  readonly prompt_id: string;
  readonly cued_by: string;
  readonly cued_at: string;
}

export interface ConsentRow {
  readonly prompt_id: string;
  readonly agreed: boolean;
}

export interface NightRows {
  readonly occasion: OccasionRow;
  readonly members: readonly MemberRow[];
  readonly prompts: readonly PromptRow[];
  readonly options: readonly OptionRow[];
  readonly responses: readonly ResponseRow[];
  readonly moments: readonly MomentRow[];
  readonly reactions: readonly ReactionRow[];
  readonly cues: readonly CueRow[];
  /** Mine only. RLS returns nobody else's, and nothing here would show them. */
  readonly consents: readonly ConsentRow[];
  /**
   * Challenges, juries, team reactions and the mission ledger
   * (`challenges.ts`), when mayhem-migration.sql is applied.
   */
  readonly play?: PlayRows;
}

// -------------------------------------------------------------- template

const FIXTURE_PEOPLE = hockeyNight.participants.map((p) => p.name);

/**
 * Questions this night does not ask yet, and why.
 *
 * - `story` / `story-guess` — "who said this?" builds its questions out of
 *   answers nobody else may read (`reveal: "never"`). The lab does that in the
 *   browser, which on a shared page would hand every author to anyone with
 *   devtools. It comes back when the server materialises it.
 * - `mission-mike` — a secret mission aimed at a person the fixture invented.
 *   The toy box still makes real ones, aimed at real people.
 */
const NOT_YET = new Set(["story", "story-guess", "mission-mike"]);
/** Toy families withheld for the same reason as `story`. */
const WITHHELD_TOYS: ReadonlySet<ToyFamily> = new Set(["people"]);

const phaseOffset = (phaseId: string | undefined): number | null =>
  phaseId === undefined
    ? null
    : (hockeyNight.phases.find((p) => p.id === phaseId)?.offsetMinutes ?? null);

/**
 * Template prompts with every invented fact removed: no authored results
 * (the host calls those), no fake askers, no invented venues, the real
 * opponent.
 */
export function templatePrompts(
  details: NightDetails,
  hostName: string,
  people: readonly Participant[],
): Prompt[] {
  const home = { id: "canucks", label: details.home, emoji: "🐋" };
  const away = {
    id: "opponent",
    label: details.opponent,
    emoji: details.opponentEmoji,
  };

  return hockeyNight.prompts
    .filter((p) => !NOT_YET.has(p.id))
    .map((fixture): Prompt => {
      // Results are the world's to give, and the host's to record.
      const prompt: Prompt = { ...fixture, resolution: undefined };
      // Nobody asked these. Passport did, on behalf of a fixture.
      const unasked = { ...prompt, askedBy: undefined };

      switch (prompt.id) {
        case "pregame-spot":
          return {
            ...unasked,
            hint: "Nominate a real place near the arena. Somebody will hate it.",
            // The fixture's pubs and walk times were invented. The concourse
            // is the one option that is true by definition.
            options: prompt.options
              ?.filter((o) => o.id === "concourse")
              .map((o) => ({
                ...o,
                // The fixture credited this to its Dave.
                addedBy: undefined,
                detail: "0 min · $19 beer · zero effort",
              })),
          };
        case "final-score":
          return { ...unasked, pairLabels: [details.home, details.opponent] };
        case "first-team":
          return { ...unasked, options: [home, away] };
        case "lorne-beer":
          return {
            ...unasked,
            id: "host-beer",
            question: `Will ${hostName} buy a $19 arena beer before puck drop?`,
          };
        case "refs":
          return {
            ...unasked,
            options: people.map((p) => ({
              id: p.id,
              label: p.name,
              emoji: p.emoji,
            })),
          };
        case "sides":
          return {
            ...unasked,
            options: [
              {
                ...home,
                consequence: `Wears ${details.opponent} colours in the postgame photo and looks pleased about it.`,
              },
              {
                ...away,
                consequence: `Leads a ${details.home} chant on the walk out. Full volume. Alone if necessary.`,
              },
            ],
          };
        case "group-photo":
          return {
            ...unasked,
            question: `All of us plus one ${details.opponent} fan in a single photo, before the third.`,
          };
        case "postgame":
          // The fixture's joke was about its own Dave. The karaoke stays.
          return {
            ...unasked,
            hint: "Yes, you can suggest karaoke. Somebody always does.",
          };
        default:
          return unasked;
      }
    })
    .flatMap((prompt) =>
      prompt.id === "pregame-spot"
        ? [prompt, plansPrompt(), ...meetingPrompt(details)]
        : [prompt],
    );
}

/**
 * **Who is coming to the pregame?** — the question that replaces asking
 * everyone where to meet (2026-10-24). The pregame restaurant is where the
 * group meets; this says who is joining it, who will find the group at the
 * arena instead, and who doesn't know yet. Answers reveal as they happen and
 * stay changeable until puck drop.
 *
 * Like every template question it exists on a night only if the night has its
 * rule row: nights started before `plan-migration.sql` don't, and the page
 * leaves the question out rather than pretend (`PlanBoards`).
 */
export const PLANS_PROMPT_ID = "pregame-plans";

export const PLANS_OPTIONS = {
  join: "Joining pregame",
  arena: "Meeting at the arena",
  unsure: "Not sure yet",
} as const;

function plansPrompt(): Prompt {
  return {
    id: PLANS_PROMPT_ID,
    question: "Are you joining the pregame?",
    kind: "choice",
    phaseId: "before",
    locksAtPhaseId: "live",
    reveal: "immediate",
    hint: "So everyone knows where to find you.",
    options: [
      { id: "join", label: PLANS_OPTIONS.join, emoji: "🍻" },
      { id: "arena", label: PLANS_OPTIONS.arena, emoji: "🏟️" },
      { id: "unsure", label: PLANS_OPTIONS.unsure, emoji: "🤷" },
    ],
  };
}

/**
 * **Where we meet: real places by the venue, from the shared curated list.**
 *
 * A template question the lab fixture never had, because the lab's people
 * already knew each other's habits. Coworkers coming from different offices
 * do not. Options are real meeting points within a short walk, each with its
 * straight-line distance; anyone may add another. Absent for a venue the
 * curated list knows nothing near.
 */
export const MEET_PROMPT_ID = "meet-spot";

export function meetingPrompt(details: NightDetails): Prompt[] {
  const near = curatedNear(VANCOUVER_PLACES, details.venueAt, {
    kinds: ["meeting"],
    withinKm: 1,
  });
  if (near.length === 0) return [];
  return [
    {
      id: MEET_PROMPT_ID,
      question: "Where are we meeting?",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "warmup",
      reveal: "immediate",
      openToSuggestions: true,
      hint: "Pick somewhere everyone can find. Or add your own.",
      options: [
        ...near.map(({ place, km, walkMinutes }) => ({
          id: place.id.split(":").pop() as string,
          label: place.name,
          detail: `${place.blurb} ${walkLabel({ km, walkMinutes })} to ${details.venue}.`,
          emoji: "📍",
        })),
        {
          id: "at-seats",
          label: "Just meet at our seats",
          detail: "Zero coordination. Someone will still be late.",
          emoji: "🎟️",
        },
      ],
    },
  ];
}

/** What `passport_create_occasion` writes: the rules RLS enforces. */
export function templateRules(): {
  id: string;
  reveal: Prompt["reveal"];
  lockOffsetMinutes: number | null;
  openToSuggestions: boolean;
}[] {
  return templatePrompts(SYCLE_HOCKEY_NIGHT.details, "", []).map((p) => ({
    id: p.id,
    reveal: p.reveal,
    lockOffsetMinutes: phaseOffset(p.locksAtPhaseId),
    openToSuggestions: Boolean(p.openToSuggestions),
  }));
}

/** The rules a question somebody asked carries into the database. */
export function rulesFor(prompt: Prompt) {
  return {
    prompt_id: prompt.id,
    reveal: prompt.reveal,
    lock_offset_minutes: phaseOffset(prompt.locksAtPhaseId),
    audience_only: prompt.audience?.only ?? null,
    open_to_suggestions: Boolean(prompt.openToSuggestions),
  };
}

/**
 * Starters that name a fixture person nobody here is called are dropped
 * rather than rewritten: "get Nathan to say analytics" is a great idea at a
 * table with a Nathan at it and a baffling one otherwise.
 */
function startersFor(
  people: readonly Participant[],
): ExperienceDefinition["starters"] {
  const here = new Set(people.map((p) => p.name.toLowerCase()));
  const absent = FIXTURE_PEOPLE.filter((n) => !here.has(n.toLowerCase()));
  const mentionsAbsent = (s: Starter) =>
    absent.some((name) => new RegExp(`\\b${name}\\b`).test(s.text));

  return Object.fromEntries(
    Object.entries(hockeyNight.starters ?? {})
      .filter(([family]) => !WITHHELD_TOYS.has(family as ToyFamily))
      .map(([family, starters]) => [
        family,
        (starters ?? []).filter((s) => !mentionsAbsent(s)),
      ]),
  );
}

// --------------------------------------------------------------- compose

/**
 * Database rows → the lab's own `ExperienceDefinition` and `ExperienceState`.
 *
 * This is the whole adapter. Every lab component, the engine, scoring and the
 * voice run unchanged on what comes out of it, which is the swap the lab's
 * `store.ts` was built to allow.
 *
 * Only members exist. Anything written by somebody who has since been removed
 * — a vote, a comment, a reaction — drops out of the page with them, so
 * removing a person is never half-done.
 */
export function composeNight(
  rows: NightRows,
  meId: string,
  now: Date = new Date(),
): {
  definition: ExperienceDefinition;
  state: ExperienceState;
  modules: ModuleId[];
} {
  const { occasion } = rows;
  const on = modulesOf(occasion.details);
  const games = on.has("games");
  const details: NightDetails = {
    ...SYCLE_HOCKEY_NIGHT.details,
    ...occasion.details,
  };
  const edition = editionOf(occasion);
  const memberIds = new Set(rows.members.map((m) => m.user_id));
  const isMember = (id: string | null | undefined) =>
    id !== null && id !== undefined && memberIds.has(id);

  const participants: Participant[] = [...rows.members]
    .sort((a, b) =>
      a.role === b.role
        ? a.joined_at.localeCompare(b.joined_at)
        : a.role === "host"
          ? -1
          : 1,
    )
    .map((m) => ({
      id: m.user_id,
      name: m.display_name,
      emoji: m.emoji,
      hue: m.hue,
      vibe: m.vibe ?? undefined,
      present: true,
    }));

  const host = participants.find((p) => p.id === occasion.host_id);
  const resolutions = new Map(
    rows.prompts
      .filter((r) => r.resolution !== null)
      .map((r) => [r.prompt_id, r.resolution as ResponseValue]),
  );

  const prompts = templatePrompts(
    details,
    host?.name ?? "the host",
    participants,
  )
    // A template question exists on this night only if its rule row does,
    // and shows only while the host has its module on.
    .filter(
      (p) =>
        promptIsOn(p.id, on) &&
        rows.prompts.some((r) => r.prompt_id === p.id && r.content === null),
    )
    .map((p) =>
      resolutions.has(p.id) ? { ...p, resolution: resolutions.get(p.id) } : p,
    );

  // Everything a member asked comes from the toy box, which is the games module.
  // What a question is worth is Passport's rule, never the stored content's
  // (`honestScoring`), and with the mission ledger a secret mission's points
  // come from the ledger every member reads alike.
  const ledgered = Boolean(rows.play);
  const addedPrompts: Prompt[] = honestScoring(
    rows.prompts
      .filter((r) => games && r.content !== null && isMember(r.asked_by))
      .map((r) => ({
        ...(r.content as Prompt),
        id: r.prompt_id,
        askedBy: r.asked_by ?? undefined,
        resolution: r.resolution ?? undefined,
      })),
    rows.prompts,
    ledgered,
  );
  const askedBy = new Map(
    addedPrompts
      .filter((p) => p.scoring && !p.scoring.shared)
      .map((p) => [p.id, p.askedBy]),
  );

  const blocks = hockeyNight.blocks
    .map((b) =>
      b.promptIds
        ? {
            ...b,
            promptIds: b.promptIds
              .filter((id) => !NOT_YET.has(id))
              .map((id) => (id === "lorne-beer" ? "host-beer" : id))
              // Who is coming sits right after where we eat. The pregame
              // winner is where we meet, so "where are we meeting?"
              // (`MEET_PROMPT_ID`) is no longer asked.
              .flatMap((id) =>
                id === "pregame-spot" ? [id, PLANS_PROMPT_ID] : [id],
              )
              // Where we go after is decided with the rest of the plan, not
              // outside the doors at the horn.
              .concat(b.id === "pregame" ? ["postgame"] : []),
          }
        : b,
    )
    // No toy box, no "Ask the group something stupid".
    .map((b) => (games ? b : { ...b, inviteOwnPrompt: undefined }))
    // Without picks, that block is only somewhere to ask the group, and must
    // not promise anything sealed.
    .map((b) =>
      b.id === "picks" && !on.has("picks")
        ? { ...b, title: "Ask the group", subtitle: undefined }
        : b,
    )
    .map((b) => (b.kind === "recap" ? { ...b, title: occasion.title } : b))
    // The lab only offered "Run it back" a fortnight later. A real group
    // decides the next one over breakfast, so it is there from the morning.
    .map((b) =>
      b.kind === "runItBack" ? { ...b, phaseIds: ["morning", "again"] } : b,
    )
    .map((b) =>
      b.kind === "leaderboard" && edition > 1
        ? {
            ...b,
            subtitle: `${editionLabel(edition)}. Points start at zero. The grudges don't.`,
          }
        : b,
    );

  // Settled decisions follow the group out of "Before the game".
  const plan = planBlock(
    planLines(prompts, rows),
    hockeyNight.phases.map((p) => p.id),
  );
  if (plan) {
    const at = blocks.findIndex((b) => b.kind === "roster");
    blocks.splice(at + 1, 0, plan);
  }

  const definition: ExperienceDefinition = {
    ...hockeyNight,
    slug: occasion.id,
    title: occasion.title,
    subtitle: `${details.home} vs ${details.opponent}`,
    kicker:
      edition > 1
        ? `${details.venue} · ${editionLabel(edition)}`
        : details.venue,
    whereLine: `${details.venue}, ${details.city}`,
    anchorAt: new Date(occasion.starts_at).toISOString(),
    hostId: occasion.host_id,
    // It is a Sunday. The fixture's headline was written for a Friday.
    phases: hockeyNight.phases.map((p) =>
      p.id === "before"
        ? {
            ...p,
            headline: `Make ${weekday(occasion.starts_at)} worse. Everyone gets a say.`,
          }
        : p,
    ),
    starters: startersFor(participants),
    participants,
    prompts,
    blocks,
    seedResponses: [],
    seedMoments: [],
    lineage: undefined,
    nextEditionOf: undefined,
    labNote: "",
  };

  const opened: Moment[] = rows.cues.map((c) => ({
    id: `cue-${c.prompt_id}`,
    at: c.cued_at,
    kind: "voice",
    text: "🔓 Opened.",
  }));

  // Chirp Bot's lines are the chat's, not the night's: they never reach the
  // lab's feed, receipts, awards or recap (`chirp.ts` draws them).
  const moments: Moment[] = rows.moments
    .filter((m) => m.kind !== "chirp" && isMember(m.actor_id))
    .map((m) => ({
      id: m.id,
      at: m.at,
      kind: m.kind as Exclude<MomentRow["kind"], "chirp">,
      by: m.actor_id,
      text: m.text ?? undefined,
      emoji: m.emoji ?? undefined,
    }));

  const reactions: Record<string, Record<string, string[]>> = {};
  for (const r of rows.reactions) {
    if (!isMember(r.user_id)) continue;
    const byEmoji = (reactions[r.moment_id] ??= {});
    (byEmoji[r.emoji] ??= []).push(r.user_id);
  }

  const responses: Response[] = rows.responses
    .filter((r) => isMember(r.user_id))
    // Whoever asked a scored question calls it, so their own answer to it
    // never counts — the referee does not also play (the server refuses it
    // too; this is for a row written straight to the database).
    .filter((r) => askedBy.get(r.prompt_id.split("::")[0]) !== r.user_id)
    .map((r) => ({
      promptId: r.prompt_id,
      participantId: r.user_id,
      value: r.value,
      at: r.answered_at,
    }));

  // Settled challenges and confirmed missions, as score lines everybody
  // reads the same (`challenges.ts`).
  if (rows.play && games) {
    const cup = cupLines(rows.play, {
      people: participants,
      startsAt: new Date(occasion.starts_at).toISOString(),
      now,
      game: gameOf(details.home, details.opponent),
      market: marketFacts(rows, now),
    });
    prompts.push(...cup.prompts);
    responses.push(...cup.responses);
  }

  const addedOptions = rows.options
    .filter((o) => isMember(o.added_by))
    .map((o) => ({
      promptId: o.prompt_id,
      option: {
        id: o.id,
        label: o.label,
        detail: o.detail ?? undefined,
        addedBy: o.added_by,
      } satisfies PromptOption,
    }));

  const me = rows.members.find((m) => m.user_id === meId);

  const state: ExperienceState = {
    slug: occasion.id,
    meId: me ? meId : null,
    joinedIds: participants.map((p) => p.id),
    responses,
    moments: [...moments, ...opened],
    addedOptions,
    addedPrompts,
    reactions,
    lurking: false,
    brief: occasion.brief,
    myEdge: (me?.edge ?? null) as Edge | null,
    cues: rows.cues.map((c) => c.prompt_id),
    consented: rows.consents.filter((c) => c.agreed).map((c) => c.prompt_id),
    declined: rows.consents.filter((c) => !c.agreed).map((c) => c.prompt_id),
    nowOverride: null,
  };

  return { definition, state, modules: storedModules(on) };
}

function weekday(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    weekday: "long",
    timeZone: "America/Vancouver",
  });
}

/**
 * **What a question somebody asked is worth: Passport's rule, not the row's.**
 *
 * A member's question is stored with its own content, and the database lets
 * a member write any content they like through PostgREST — including a
 * "prediction" worth 999. So the worth is decided here, from the family:
 *
 * - at most `FAMILY_POINTS[family]`, whatever the content says; a family
 *   with no entry (or no family) scores nothing;
 * - a side quest scores nothing: "I did it" with nobody to check is not a
 *   point (the toy box still has them, for the story);
 * - each person's first `ASKED_CAP` scored questions count, in the order
 *   they asked them — enough for a good night, not a points farm;
 * - with the ledger (`ledgered`), a secret mission or dare scores only
 *   through it: everybody reads the ledger, only two people read the mission.
 */
export const FAMILY_POINTS: Partial<Record<ToyFamily, number>> = {
  prediction: 5,
  sealed: 5,
  mission: 8,
  dare: 5,
  photo: 5,
  vault: 5,
  groupquest: 6,
};
export const ASKED_CAP = 3;

export function honestScoring(
  prompts: readonly Prompt[],
  rules: readonly PromptRow[],
  ledgered: boolean,
): Prompt[] {
  const askedAt = new Map(rules.map((r) => [r.prompt_id, r.created_at ?? ""]));
  const counted = new Map<string, number>();
  const order = [...prompts].sort(
    (a, b) =>
      (askedAt.get(a.id) ?? "").localeCompare(askedAt.get(b.id) ?? "") ||
      a.id.localeCompare(b.id),
  );
  const keep = new Map<string, Prompt>();
  for (const prompt of order) {
    const { scoring, family } = prompt;
    const max = family ? FAMILY_POINTS[family] : undefined;
    const ledger = ledgered && (family === "mission" || family === "dare");
    if (!scoring || !max || ledger) {
      keep.set(prompt.id, { ...prompt, scoring: undefined });
      continue;
    }
    const points = Math.max(
      0,
      Math.min(max, Math.round(Number(scoring.points) || 0)),
    );
    // Shared quests give everybody the same, so they cannot move anybody up.
    const shared = scoring.shared === true;
    const who = prompt.askedBy ?? "";
    const n = counted.get(who) ?? 0;
    if (!shared && (points === 0 || n >= ASKED_CAP)) {
      keep.set(prompt.id, { ...prompt, scoring: undefined });
      continue;
    }
    if (!shared) counted.set(who, n + 1);
    keep.set(prompt.id, {
      ...prompt,
      scoring: {
        points,
        label:
          typeof scoring.label === "string"
            ? scoring.label.slice(0, 40)
            : undefined,
        shared: shared || undefined,
      },
    });
  }
  return prompts.map((p) => keep.get(p.id) ?? p);
}

/**
 * What the group may know of each bet's question right now: the host's call,
 * withheld until the phase it resolves at — the engine's own `knownPrompts`
 * rule — so a bet is never settled before its pick is revealed.
 */
export function marketFacts(rows: NightRows, now: Date) {
  const anchorAt = new Date(rows.occasion.starts_at).toISOString();
  const timeline = { ...hockeyNight, anchorAt };
  return (market: Market) => {
    const id = MARKET_PROMPT[market];
    const fixture = hockeyNight.prompts.find((p) => p.id === id);
    const at = fixture?.resolvesAtPhaseId;
    const stored = rows.prompts.find(
      (r) => r.prompt_id === id && r.content === null,
    );
    const known = !at || phaseReached(timeline, at, now);
    const offset =
      hockeyNight.phases.find((p) => p.id === at)?.offsetMinutes ?? 0;
    return {
      resolution: known ? (stored?.resolution ?? undefined) : undefined,
      resolvesAtPhaseId: at,
      knownAt: new Date(Date.parse(anchorAt) + offset * 60_000).toISOString(),
    };
  };
}

/** Every challenge on this night, decided as far as the rows and the clock allow. */
export function settledPlay(
  rows: NightRows,
  now: Date = new Date(),
): Settled[] {
  if (!rows.play) return [];
  const memberIds = rows.members.map((m) => m.user_id);
  const startsAt = new Date(rows.occasion.starts_at).toISOString();
  const market = marketFacts(rows, now);
  return rows.play.challenges
    .filter(
      (c) =>
        memberIds.includes(c.challenger_id) && memberIds.includes(c.target_id),
    )
    .map((c) =>
      settle(c, { memberIds, votes: rows.play!.votes, startsAt, now, market }),
    );
}
