import { activePhase, phaseReached } from "./phase";
import { standings } from "./scoring";
import { commentary } from "./voice";
import type {
  Block,
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

function buildLivePrompt(
  definition: ExperienceDefinition,
  prompt: Prompt,
  state: ExperienceState,
  people: readonly Participant[],
  now: Date,
): LivePrompt {
  const responses = [...definition.seedResponses, ...state.responses].filter(
    (r) => r.promptId === prompt.id,
  );
  const myResponse = state.meId
    ? responses.find((r) => r.participantId === state.meId)
    : undefined;

  const locked = prompt.locksAtPhaseId
    ? phaseReached(definition, prompt.locksAtPhaseId, now)
    : false;

  const revealed =
    prompt.reveal === "immediate"
      ? true
      : prompt.reveal === "onLock"
        ? locked || Boolean(myResponse)
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

  return {
    prompt,
    responses,
    myResponse,
    locked,
    revealed,
    open: !locked,
    tally,
  };
}

export function liveExperience(
  definition: ExperienceDefinition,
  state: ExperienceState,
  realNow: Date,
): LiveExperience {
  const now = state.nowOverride ? new Date(state.nowOverride) : realNow;
  const phase = activePhase(definition, now);
  const people = roster(definition, state);
  const prompts = knownPrompts(definition, allPrompts(definition, state), now);
  const me = people.find((p) => p.id === state.meId) ?? null;

  const live = prompts.map((prompt) =>
    buildLivePrompt(definition, prompt, state, people, now),
  );

  const responses = [...definition.seedResponses, ...state.responses];
  const table = standings(
    people.filter((p) => p.present),
    prompts,
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
    settled:
      prompts.some((p) => p.scoring) &&
      prompts.filter((p) => p.scoring).every((p) => p.resolution !== undefined),
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
