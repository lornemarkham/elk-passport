import { activePhase, phaseReached } from "./phase";
import { standings } from "./scoring";
import { commentary } from "./voice";
import type {
  Block,
  Edge,
  PromptOption,
  ExperienceDefinition,
  ExperienceState,
  Participant,
  Prompt,
  Moment,
  Response,
  ResponseValue,
} from "./types";

/**
 * The read model: definition + what people did → what the page is right now.
 *
 * Everything here is derived. No component asks "is this locked?" by
 * consulting a flag someone wrote; it asks this file, which answers from the
 * clock and the phase order. That is what lets the time machine work at all —
 * move `now` and the entire page becomes a different page, including which
 * questions accept answers, which reveal, and what Passport says.
 */

export interface LivePrompt {
  readonly prompt: Prompt;
  readonly responses: readonly Response[];
  readonly myResponse?: Response;
  readonly locked: boolean;
  readonly revealed: boolean;
  readonly open: boolean;
  /** Waiting for a human to open it. See `reveal: "onCue"`. */
  readonly awaitingCue: boolean;
  /**
   * Whether the answer may be shown yet.
   *
   * A separate flag from `revealed` because they came apart: "who said this?"
   * knows the correct answer from the moment it is generated — the story
   * carries its own author — so the card cheerfully printed *Sarah — that's
   * what happened* underneath the question before anybody had guessed.
   *
   * Scoring still uses the real resolution; only the rendering waits.
   */
  readonly showResolution: boolean;
  /** I have agreed to be bound by this. Only meaningful with `requiresConsent`. */
  readonly consented: boolean;
  /** What I owe, if my answer carried a consequence and I was wrong. */
  readonly owed?: string;
  readonly tally: readonly {
    readonly optionId: string;
    readonly label: string;
    readonly emoji?: string;
    readonly detail?: string;
    readonly addedBy?: string;
    readonly voters: readonly Participant[];
    readonly share: number;
    readonly leading: boolean;
  }[];
}

/**
 * Something a person owes the group, because they picked a side that carried
 * a forfeit and the side lost.
 *
 * Not a score and not a punishment — a promise made in advance, in public,
 * by the person who has to keep it. Derived, never stored, so nobody can be
 * assigned one they did not choose.
 */
export interface Obligation {
  readonly participant: Participant;
  readonly text: string;
  readonly promptId: string;
  readonly settled: boolean;
}

export interface LiveExperience {
  readonly definition: ExperienceDefinition;
  readonly now: Date;
  readonly anchor: Date;
  readonly phase: ExperienceDefinition["phases"][number];
  readonly phaseNumber: number;
  readonly participants: readonly Participant[];
  readonly me: Participant | null;
  readonly blocks: readonly Block[];
  readonly prompts: readonly LivePrompt[];
  readonly standings: ReturnType<typeof standings>;
  readonly commentary: readonly string[];
  readonly isCompetitive: boolean;
  /**
   * Every scored question has a known answer. Nothing hands out a title
   * before this is true — a trophy awarded while questions are still open is
   * just a running total wearing a hat.
   */
  readonly settled: boolean;
  /** Moments that have already happened. The feed and the memory are this list. */
  readonly moments: readonly Moment[];
  /** How much of the room Passport is allowed to have right now. */
  readonly attention: "open" | "quiet" | "burst";
  /** The lower of the night's ceiling and mine. */
  readonly edge: Edge;
  /** Who owes what, once a consequence they opted into has gone against them. */
  readonly obligations: readonly Obligation[];
}

/**
 * Prompts as the group may know them *now*: an answer the world has not
 * produced yet is not on the page, however firmly the fixture knows it.
 */
export function knownPrompts(
  definition: ExperienceDefinition,
  prompts: readonly Prompt[],
  now: Date,
): Prompt[] {
  return prompts.map((prompt) => {
    if (prompt.resolution === undefined || !prompt.resolvesAtPhaseId)
      return prompt;
    return phaseReached(definition, prompt.resolvesAtPhaseId, now)
      ? prompt
      : { ...prompt, resolution: undefined };
  });
}

/**
 * The lower of the two ceilings — the night's and mine.
 *
 * With no brief and no personal setting the answer is 1 ("game for some
 * fun"), which is where a group of coworkers who have told Passport nothing
 * should sit: enough to be funny, not enough to be a problem.
 */
export function effectiveEdge(state: ExperienceState): Edge {
  const night = state.brief?.edge ?? 1;
  const mine = state.myEdge ?? night;
  return Math.min(night, mine) as Edge;
}

/**
 * Questions built out of other people's answers.
 *
 * The round-2 primitive. Two shapes, and they behave very differently:
 *
 * - `submissions` **maps**: every answer to the source becomes an option on
 *   one new question. That is the photo vault — vote on what everybody put in.
 * - `authors` **multiplies**: every answer to the source becomes *its own*
 *   question, carrying that answer as the briefing and its writer as the
 *   correct answer. That is "who said this?", and it was the surprise —
 *   a single toy the curator adds once quietly turns into one question per
 *   person, generated by the group, with no further authoring at all.
 */
function materialise(
  prompt: Prompt,
  responses: readonly Response[],
  people: readonly Participant[],
): Prompt[] {
  const source = prompt.optionsFrom;
  if (!source) return [prompt];

  const submissions = responses
    .filter((r) => r.promptId === source.promptId)
    .filter((r) => String(r.value).trim().length > 0)
    .filter((r) => people.some((p) => p.id === r.participantId));

  if (submissions.length === 0) return [];

  if (source.as === "submissions") {
    return [
      {
        ...prompt,
        options: submissions.map((r) => ({
          id: r.participantId,
          label: String(r.value),
        })),
      },
    ];
  }

  return submissions.map((submission) => ({
    ...prompt,
    id: `${prompt.id}::${submission.participantId}`,
    brief: String(submission.value),
    resolution: submission.participantId,
    // The one person who cannot be asked is the one who wrote it.
    audience: { except: submission.participantId },
    options: people.map((p) => ({ id: p.id, label: p.name, emoji: p.emoji })),
  }));
}

/**
 * Questions the group itself decides. See `Prompt.resolvedBy`.
 *
 * Only once the answers are visible — resolving a vote nobody has been shown
 * would be deciding it on their behalf. A tie leaves it unresolved rather
 * than picking one, because "we could not agree" is a real outcome and
 * inventing a winner is not.
 */
function resolveByVote(
  prompts: readonly Prompt[],
  responses: readonly Response[],
  revealed: (promptId: string) => boolean,
): Prompt[] {
  return prompts.map((prompt) => {
    if (prompt.resolvedBy !== "vote" || prompt.resolution !== undefined)
      return prompt;
    if (!revealed(prompt.id)) return prompt;

    const counts = new Map<string, number>();
    for (const response of responses.filter((r) => r.promptId === prompt.id)) {
      const key = String(response.value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size === 0) return prompt;

    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return prompt;
    return { ...prompt, resolution: ranked[0][0] };
  });
}

export function allPrompts(
  definition: ExperienceDefinition,
  state: ExperienceState,
): Prompt[] {
  const withAddedOptions = definition.prompts.map((prompt) => {
    const extra = state.addedOptions
      .filter((a) => a.promptId === prompt.id)
      .map((a) => a.option);
    if (extra.length === 0) return prompt;
    return { ...prompt, options: [...(prompt.options ?? []), ...extra] };
  });
  return [...withAddedOptions, ...state.addedPrompts];
}

/**
 * Everyone who counts as being here: the fixture's own cast plus whoever
 * joined in this browser. Joining is additive and never removes anybody,
 * which is the behaviour a shared link has to have.
 */
export function roster(
  definition: ExperienceDefinition,
  state: ExperienceState,
): Participant[] {
  return definition.participants.map((p) =>
    state.joinedIds.includes(p.id) ? { ...p, present: true } : p,
  );
}

/**
 * One answer per person per question, with a person's own answer winning.
 *
 * The fixtures seed answers for people who are already "in", and the lab lets
 * you *become* one of them. Concatenating the two lists therefore produced two
 * answers for the same person on the same question, which double-counted their
 * vote, duplicated their avatar (and its React key), and — worst — made
 * `standings()` score the seeded answer and silently ignore the one the human
 * had just given. Answering and seeing nothing change is about the most
 * corrosive bug this prototype could have had.
 */
export function mergeResponses(
  seeded: readonly Response[],
  local: readonly Response[],
): Response[] {
  const byKey = new Map<string, Response>();
  for (const response of [...seeded, ...local]) {
    byKey.set(`${response.promptId}::${response.participantId}`, response);
  }
  return [...byKey.values()];
}

function buildLivePrompt(
  definition: ExperienceDefinition,
  prompt: Prompt,
  state: ExperienceState,
  people: readonly Participant[],
  now: Date,
): LivePrompt {
  const responses = mergeResponses(
    definition.seedResponses,
    state.responses,
  ).filter((r) => r.promptId === prompt.id);
  const myResponse = state.meId
    ? responses.find((r) => r.participantId === state.meId)
    : undefined;

  const locked = prompt.locksAtPhaseId
    ? phaseReached(definition, prompt.locksAtPhaseId, now)
    : false;

  const consented =
    !prompt.requiresConsent ||
    (state.meId !== null && state.consented.includes(prompt.id));

  const revealed =
    prompt.reveal === "immediate"
      ? true
      : prompt.reveal === "onLock"
        ? locked || Boolean(myResponse)
        : prompt.reveal === "onCue"
          ? // Somebody can open it early — that is the whole point — but
            // nothing stays sealed by accident. If nobody ever taps it, it
            // opens by itself when its moment has passed. A vault the group
            // forgot about would otherwise silently swallow everything in it.
            state.cues.includes(prompt.id) || locked
          : false;

  const counts = new Map<string, Participant[]>();
  for (const response of responses) {
    const person = people.find((p) => p.id === response.participantId);
    if (!person) continue;
    const ids = Array.isArray(response.value)
      ? (response.value as string[])
      : [String(response.value)];
    for (const id of ids) {
      counts.set(id, [...(counts.get(id) ?? []), person]);
    }
  }
  const max = Math.max(1, ...[...counts.values()].map((v) => v.length));

  const tally = (prompt.options ?? []).map((option) => {
    const voters = counts.get(option.id) ?? [];
    return {
      optionId: option.id,
      label: option.label,
      emoji: option.emoji,
      detail: option.detail,
      addedBy: option.addedBy,
      voters,
      share: responses.length === 0 ? 0 : voters.length / max,
      leading: voters.length === max && voters.length > 0,
    };
  });

  const chosen = prompt.options?.find((o) => o.id === myResponse?.value);
  const wrong =
    prompt.resolution !== undefined && myResponse?.value !== prompt.resolution;

  return {
    prompt,
    responses,
    myResponse,
    locked,
    revealed,
    open: !locked && !(prompt.requiresConsent && !consented),
    awaitingCue: prompt.reveal === "onCue" && !revealed,
    showResolution: revealed,
    consented,
    owed: wrong && consented ? chosen?.consequence : undefined,
    tally,
  };
}

/**
 * Everyone bound by a consequence on this question.
 *
 * The consent rule needs no separate record: the engine will not let anybody
 * answer a `requiresConsent` question until they have opted in, so *having an
 * answer at all* is the consent. A person who never opted in has no answer and
 * therefore no obligation. That is the difference between a forfeit and a
 * hazing, and it is structural rather than a check somebody has to remember.
 */
function obligationsFor(
  live: LivePrompt,
  people: readonly Participant[],
): Obligation[] {
  const { prompt } = live;
  if (!prompt.requiresConsent || prompt.resolution === undefined) return [];

  return live.responses
    .filter((r) => r.value !== prompt.resolution)
    .map((r) => {
      const option = prompt.options?.find(
        (o: PromptOption) => o.id === r.value,
      );
      const participant = people.find((p) => p.id === r.participantId);
      if (!option?.consequence || !participant) return null;
      return {
        participant,
        text: option.consequence,
        promptId: prompt.id,
        settled: false,
      };
    })
    .filter((o): o is Obligation => o !== null);
}

/**
 * Is this question still capable of changing the standings?
 *
 * Round 1 defined "settled" as *every scored question has an answer*, which
 * worked while every answer came from the world. Round 2 broke it twice over:
 * a photo vault nobody voted in and a secret mission nobody completed have no
 * answer and never will, and under the old rule they held the trophy hostage
 * for ever.
 *
 * The honest test is not "does it have an answer" but "could it still get
 * one":
 *
 * - waiting on the world (`resolvesAtPhaseId`) — pending until that moment;
 * - waiting on people (a vote, a self-reported mission) — pending only while
 *   they can still act, which is until it locks.
 */
function stillInPlay(live: LivePrompt): boolean {
  const { prompt } = live;
  if (!prompt.scoring || prompt.resolution !== undefined) return false;
  return prompt.resolvesAtPhaseId ? true : !live.locked;
}

export function liveExperience(
  definition: ExperienceDefinition,
  state: ExperienceState,
  realNow: Date,
): LiveExperience {
  const now = state.nowOverride ? new Date(state.nowOverride) : realNow;
  const phase = activePhase(definition, now);
  const people = roster(definition, state);
  const merged = mergeResponses(definition.seedResponses, state.responses);
  const ceiling = effectiveEdge(state);

  const prompts = knownPrompts(
    definition,
    allPrompts(definition, state)
      .flatMap((prompt) => materialise(prompt, merged, people))
      // A question aimed at one person is only ever that person's business.
      .filter(
        (p) =>
          !p.audience?.only ||
          p.audience.only === state.meId ||
          state.meId === null,
      )
      .filter((p) => p.audience?.except !== state.meId)
      // Nothing may be *aimed* at somebody above the line they set. Group
      // questions stay on the page; you simply do not have to answer them.
      .filter(
        (p) =>
          !(p.audience?.only || p.requiresConsent) || (p.edge ?? 0) <= ceiling,
      ),
    now,
  );
  const me = people.find((p) => p.id === state.meId) ?? null;

  // Voted outcomes need to know what is revealed, and revealing needs the
  // prompt — so the pass runs between the two.
  const isRevealed = (promptId: string) => {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return false;
    if (prompt.reveal === "immediate") return true;
    if (prompt.reveal === "onCue")
      return (
        state.cues.includes(promptId) ||
        (prompt.locksAtPhaseId
          ? phaseReached(definition, prompt.locksAtPhaseId, now)
          : false)
      );
    return prompt.locksAtPhaseId
      ? phaseReached(definition, prompt.locksAtPhaseId, now)
      : false;
  };

  const live = resolveByVote(prompts, merged, isRevealed).map((prompt) =>
    buildLivePrompt(definition, prompt, state, people, now),
  );

  const responses = merged;
  const table = standings(
    people.filter((p) => p.present),
    live.map((l) => l.prompt),
    responses,
    definition.lineage?.standing.map((s) => ({
      participantId: s.participantId,
      points: 0, // Lineage is shown, never scored. Last year's points are a story, not a head start.
    })) ?? [],
  );

  const blocks = definition.blocks.filter((b) => b.phaseIds.includes(phase.id));

  /**
   * Passport only comments on what is on the page right now.
   *
   * Without this it kept making jokes about the pub vote the morning after
   * the game, which is exactly how a voice stops being a voice: it stops
   * being *about the moment* and becomes a feed of old observations.
   */
  const onPage = new Set(blocks.flatMap((b) => b.promptIds ?? []));
  const visiblePrompts = live
    .filter(
      (l) => l.revealed && l.responses.length > 0 && onPage.has(l.prompt.id),
    )
    .map((l) => l.prompt);

  return {
    definition,
    now,
    anchor: new Date(definition.anchorAt),
    phase,
    phaseNumber: definition.phases.findIndex((p) => p.id === phase.id),
    participants: people,
    me,
    blocks,
    prompts: live,
    standings: table,
    commentary: commentary(
      visiblePrompts,
      responses,
      people.filter((p) => p.present),
      definition.tone,
    ),
    isCompetitive: prompts.some((p) => p.scoring),
    settled: live.some((l) => l.prompt.scoring) && !live.some(stillInPlay),
    attention: phase.attention ?? "open",
    edge: ceiling,
    obligations: live.flatMap((l) => obligationsFor(l, people)),
    moments: [...definition.seedMoments, ...state.moments]
      .filter((m) => new Date(m.at).getTime() <= now.getTime())
      .map((m) =>
        state.reactions[m.id]
          ? { ...m, reactions: { ...m.reactions, ...state.reactions[m.id] } }
          : m,
      )
      .sort((a, b) => b.at.localeCompare(a.at)),
  };
}

/** Answering is upsert-by-(prompt, person). Changing your mind is not an edge case. */
export function withResponse(
  state: ExperienceState,
  promptId: string,
  participantId: string,
  value: ResponseValue,
  at: string,
): ExperienceState {
  const others = state.responses.filter(
    (r) => !(r.promptId === promptId && r.participantId === participantId),
  );
  return {
    ...state,
    responses: [...others, { promptId, participantId, value, at }],
  };
}
