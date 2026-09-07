import type { Participant, Prompt, Response, VoiceTone } from "./types";

/**
 * **Passport's voice.**
 *
 * The discovery this file exists to record: *the funny thing to say is
 * computed from the shape of the group's answers, not from the subject.*
 * "Nathan is the only person predicting a shutout" is not hockey knowledge —
 * it is the observation `exactly one person chose an option nobody else
 * chose`, which is equally true and equally funny about a ski line, a
 * restaurant, or which of you thinks the date should end at nine.
 *
 * So the observations below are domain-blind and derived. The only authored
 * part is `tone`, which picks the wording. A date does not get told it has a
 * bold strategy.
 *
 * This is the seam where a language model would eventually sit: it would
 * replace `phrase()`, not `observe()`. The observation must stay derived,
 * because a model inventing that Nathan predicted a shutout when he didn't
 * is exactly the failure Passport cannot afford.
 */

export type ObservationKind =
  "lone" | "split" | "unanimous" | "silent" | "crowded" | "matched";

export interface Observation {
  readonly kind: ObservationKind;
  readonly promptId: string;
  readonly question: string;
  /** The people the observation is about. */
  readonly about: readonly Participant[];
  readonly detail?: string;
}

function valueKey(value: unknown): string {
  return JSON.stringify(value);
}

function labelFor(prompt: Prompt, value: unknown): string {
  if (prompt.kind === "pair" && Array.isArray(value)) {
    return `${value[0]}–${value[1]}`;
  }
  if (prompt.kind === "boolean") return value ? "yes" : "no";
  const option = prompt.options?.find((o) => o.id === value);
  return option?.label ?? String(value);
}

/**
 * Everything worth saying about one question, given who answered it.
 * Pure, ordered by how interesting it is, and never invents a fact.
 */
export function observe(
  prompt: Prompt,
  responses: readonly Response[],
  participants: readonly Participant[],
): Observation[] {
  const mine = responses.filter((r) => r.promptId === prompt.id);
  if (mine.length === 0) return [];

  const person = (id: string) => participants.find((p) => p.id === id);
  const groups = new Map<string, Response[]>();
  for (const response of mine) {
    const key = valueKey(response.value);
    groups.set(key, [...(groups.get(key) ?? []), response]);
  }

  const out: Observation[] = [];
  const answered = new Set(mine.map((r) => r.participantId));
  const silent = participants.filter((p) => p.present && !answered.has(p.id));

  if (groups.size === 1 && mine.length >= 3) {
    out.push({
      kind: "unanimous",
      promptId: prompt.id,
      question: prompt.question,
      about: mine.map((r) => person(r.participantId)).filter(isParticipant),
      detail: labelFor(prompt, mine[0].value),
    });
  }

  if (groups.size === 2 && mine.length >= 4) {
    const sizes = [...groups.values()].map((g) => g.length);
    if (Math.abs(sizes[0] - sizes[1]) <= 1) {
      out.push({
        kind: "split",
        promptId: prompt.id,
        question: prompt.question,
        about: [],
      });
    }
  }

  for (const [key, group] of groups) {
    if (group.length === 1 && groups.size > 1 && mine.length >= 3) {
      const who = person(group[0].participantId);
      if (who)
        out.push({
          kind: "lone",
          promptId: prompt.id,
          question: prompt.question,
          about: [who],
          detail: labelFor(prompt, JSON.parse(key)),
        });
    }
    if (group.length >= 3 && groups.size > 1) {
      out.push({
        kind: "crowded",
        promptId: prompt.id,
        question: prompt.question,
        about: group.map((r) => person(r.participantId)).filter(isParticipant),
        detail: labelFor(prompt, JSON.parse(key)),
      });
    }
    if (
      group.length === 2 &&
      participants.filter((p) => p.present).length === 2
    ) {
      out.push({
        kind: "matched",
        promptId: prompt.id,
        question: prompt.question,
        about: group.map((r) => person(r.participantId)).filter(isParticipant),
        detail: labelFor(prompt, JSON.parse(key)),
      });
    }
  }

  if (silent.length > 0 && mine.length >= 2) {
    out.push({
      kind: "silent",
      promptId: prompt.id,
      question: prompt.question,
      about: silent,
    });
  }

  const rank: Record<ObservationKind, number> = {
    lone: 0,
    matched: 1,
    unanimous: 2,
    split: 3,
    silent: 4,
    crowded: 5,
  };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

function isParticipant(p: Participant | undefined): p is Participant {
  return p !== undefined;
}

function names(people: readonly Participant[]): string {
  const list = people.map((p) => p.name);
  if (list.length === 0) return "nobody";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

type Phrasebook = Record<ObservationKind, (o: Observation) => string>;

/**
 * The authored half. Same observation, four registers. Getting Date Night
 * right required nothing but this table — which is the strongest evidence so
 * far that the split between *observing* and *phrasing* is the right one.
 */
const PHRASEBOOKS: Record<VoiceTone, Phrasebook> = {
  rowdy: {
    lone: (o) =>
      `${names(o.about)} is the only person going with ${o.detail}. Bold strategy.`,
    matched: (o) => `${names(o.about)} both said ${o.detail}. Rigged.`,
    unanimous: (o) =>
      `Everyone said ${o.detail}. Either you're all right or you're all cowards.`,
    split: (o) => `This group is dead split on "${o.question}". Delightful.`,
    silent: (o) => `${names(o.about)} has answered nothing. We can see you.`,
    crowded: (o) =>
      `${names(o.about)} are all in on ${o.detail}. Herd behaviour.`,
  },
  hype: {
    lone: (o) => `🚨 ${names(o.about)} stands alone on ${o.detail}.`,
    matched: (o) => `${names(o.about)} are locked in together on ${o.detail}.`,
    unanimous: (o) => `Unanimous. ${o.detail}. This group knows what it wants.`,
    split: (o) => `Straight down the middle on "${o.question}". It's on.`,
    silent: (o) => `Still waiting on ${names(o.about)}.`,
    crowded: (o) => `${o.detail} is running away with it.`,
  },
  warm: {
    lone: (o) =>
      `${names(o.about)} is the only one for ${o.detail}. Someone back them up.`,
    matched: (o) => `${names(o.about)} both picked ${o.detail}.`,
    unanimous: (o) => `Everyone wants ${o.detail}. That was easy.`,
    split: (o) =>
      `You're evenly split on "${o.question}" — worth talking about.`,
    silent: (o) => `${names(o.about)} hasn't weighed in yet.`,
    crowded: (o) => `${o.detail} is where most of you are leaning.`,
  },
  intimate: {
    lone: (o) => `One of you chose ${o.detail}.`,
    matched: (o) =>
      `You both said ${o.detail}. That's either love or laziness.`,
    unanimous: (o) => `You agree on ${o.detail}.`,
    split: () => `You want different things here. That's allowed.`,
    silent: () => `Waiting on the other one of you.`,
    crowded: (o) => `${o.detail}, then.`,
  },
};

export function phrase(observation: Observation, tone: VoiceTone): string {
  return PHRASEBOOKS[tone][observation.kind](observation);
}

/**
 * The one or two lines worth putting on the page right now, across every
 * open question. Capped hard: Passport commenting on everything is noise,
 * and noise is how this stops being funny.
 */
export function commentary(
  prompts: readonly Prompt[],
  responses: readonly Response[],
  participants: readonly Participant[],
  tone: VoiceTone,
  limit = 2,
): string[] {
  // At most one line per question, and at most one line per *kind* — two
  // "bold strategy" jokes in a row is how a voice stops being a voice and
  // starts being a template. Variety beats completeness here.
  const best = prompts
    .filter(prompt_isPublic)
    .map((p) => observe(p, responses, participants)[0])
    .filter((o): o is Observation => o !== undefined);

  const usedKinds = new Set<ObservationKind>();
  const lines: string[] = [];
  for (const observation of best) {
    if (usedKinds.has(observation.kind)) continue;
    usedKinds.add(observation.kind);
    lines.push(phrase(observation, tone));
    if (lines.length >= limit) break;
  }
  return lines;
}

/** Passport never narrates an answer it promised nobody would see. */
function prompt_isPublic(prompt: Prompt): boolean {
  return prompt.reveal !== "never";
}
