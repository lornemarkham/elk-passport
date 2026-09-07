import type {
  Edge,
  ExperienceDefinition,
  Prompt,
  Starter,
  ToyFamily,
} from "./types";

/**
 * **The toy box.**
 *
 * Round 1 found that the best question of the night is the one Passport did
 * not write. Round 2's problem is the obvious consequence: most people are
 * not game designers, and "write something funny" in an empty box is a wall.
 *
 * So this file holds the *shapes* — what a secret mission is, what a photo
 * vault is, what a forfeit is — and every fixture holds the *wording*. It is
 * the same split that made the voice work (`observe()` / `phrase()`), applied
 * to authoring instead of narration:
 *
 * - the engine knows a secret mission is a private question aimed at one
 *   person that resolves later;
 * - only Hockey Night knows that "get Nathan to say 'analytics' out loud" is
 *   funny;
 * - Date Night supplies no starters for dares at all, which is how it has no
 *   dares without anything having to forbid them.
 *
 * A toy is therefore never a component and never a special case in the page.
 * It compiles down to `Prompt`s — the round-1 primitive — and everything
 * downstream of that has no idea a toy box exists.
 */

export interface Toy {
  readonly family: ToyFamily;
  readonly label: string;
  readonly blurb: string;
  /** Roughly how much of the group's attention it will cost. Used to warn, never to block. */
  readonly weight: 1 | 2 | 3;
  /** Someone has to be picked before this means anything. */
  readonly needsTarget?: boolean;
  /** Turns one starter into the question(s) it becomes. */
  readonly build: (input: ToyInput) => Prompt[];
}

export interface ToyInput {
  readonly id: string;
  readonly text: string;
  readonly askedBy: string;
  readonly targetId?: string;
  readonly phaseId: string;
  readonly locksAtPhaseId?: string;
  readonly revealAtPhaseId?: string;
  readonly points: number;
  readonly edge: Edge;
}

const base = (input: ToyInput, family: ToyFamily) => ({
  id: input.id,
  askedBy: input.askedBy,
  phaseId: input.phaseId,
  edge: input.edge,
  family,
});

export const TOYS: Readonly<Record<ToyFamily, Toy>> = {
  prediction: {
    family: "prediction",
    label: "A prediction",
    blurb: "Everyone calls it. Everyone sees who was right.",
    weight: 1,
    build: (input) => [
      {
        ...base(input, "prediction"),
        question: input.text,
        kind: "boolean",
        reveal: "immediate",
        locksAtPhaseId: input.locksAtPhaseId,
        scoring: { points: input.points, label: "Called it" },
      },
    ],
  },

  sealed: {
    family: "sealed",
    label: "A sealed pick",
    blurb: "Nobody sees anybody's answer until it opens.",
    weight: 1,
    build: (input) => [
      {
        ...base(input, "sealed"),
        question: input.text,
        kind: "boolean",
        reveal: "onLock",
        locksAtPhaseId: input.locksAtPhaseId,
        scoring: { points: input.points, label: "Sealed pick" },
      },
    ],
  },

  mission: {
    family: "mission",
    label: "A secret mission",
    blurb: "One person gets it privately. Everyone finds out afterwards.",
    weight: 2,
    needsTarget: true,
    build: (input) => [
      {
        ...base(input, "mission"),
        question: "Did you pull it off?",
        brief: input.text,
        kind: "boolean",
        // The engine — including Passport's own voice — cannot see this.
        audience: { only: input.targetId },
        reveal: "onCue",
        requiresConsent: true,
        scoring: { points: input.points, label: "Mission" },
      },
    ],
  },

  dare: {
    family: "dare",
    label: "A dare",
    blurb: "Opt in first. Always declinable, never announced if you pass.",
    weight: 2,
    needsTarget: true,
    build: (input) => [
      {
        ...base(input, "dare"),
        question: "Did it happen?",
        brief: input.text,
        kind: "boolean",
        audience: { only: input.targetId },
        reveal: "onCue",
        requiresConsent: true,
        scoring: { points: input.points, label: "Dare" },
      },
    ],
  },

  sidequest: {
    family: "sidequest",
    label: "A side quest",
    blurb: "Optional. Anyone can do it. Nobody has to.",
    weight: 1,
    build: (input) => [
      {
        ...base(input, "sidequest"),
        question: input.text,
        kind: "boolean",
        reveal: "immediate",
        resolution: true,
        resolvesAtPhaseId: input.phaseId,
        scoring: { points: input.points, label: "Side quest" },
      },
    ],
  },

  photo: {
    family: "photo",
    label: "A photo challenge",
    blurb: "Everyone submits one. Shows up straight away.",
    weight: 2,
    build: (input) => [
      {
        ...base(input, "photo"),
        question: input.text,
        kind: "photo",
        reveal: "immediate",
        scoring: { points: input.points, label: "Photo" },
      },
    ],
  },

  /**
   * **The vault.** Two questions, and the second one is built out of the
   * answers to the first — the primitive round 2 discovered. Nobody sees a
   * single submission until a human opens it, and then everybody votes at once.
   */
  vault: {
    family: "vault",
    label: "A sealed photo contest",
    blurb: "Everyone submits one, blind. Somebody opens the vault later.",
    weight: 2,
    build: (input) => [
      {
        ...base(input, "vault"),
        question: input.text,
        kind: "photo",
        reveal: "onCue",
      },
      {
        ...base(input, "vault"),
        id: `${input.id}-vote`,
        question: "The vault is open. Vote.",
        kind: "choice",
        reveal: "onCue",
        optionsFrom: { promptId: input.id, as: "submissions" },
        resolvedBy: "vote",
        scoring: { points: input.points, label: "Won the vault" },
      },
    ],
  },

  groupquest: {
    family: "groupquest",
    label: "A group quest",
    blurb: "Everyone gets the credit, or nobody does.",
    weight: 3,
    build: (input) => [
      {
        ...base(input, "groupquest"),
        question: input.text,
        kind: "boolean",
        reveal: "immediate",
        resolution: true,
        resolvesAtPhaseId: input.phaseId,
        scoring: { points: input.points, label: "Together", shared: true },
      },
    ],
  },

  /**
   * **Pick a side, and say now what it costs you to be wrong.**
   *
   * The consequence sits on the *option*, not on the question, which is the
   * whole trick: nobody can end up owing something they did not personally
   * choose, and the engine will not let you answer until you have opted in.
   */
  consequence: {
    family: "consequence",
    label: "A forfeit",
    blurb: "Pick a side. The losing side owes something harmless.",
    weight: 2,
    build: (input) => {
      const [question, forfeit] = splitForfeit(input.text);
      return [
        {
          ...base(input, "consequence"),
          question,
          kind: "choice",
          reveal: "immediate",
          requiresConsent: true,
          locksAtPhaseId: input.locksAtPhaseId,
          options: [
            { id: "a", label: "Yes", consequence: forfeit },
            { id: "b", label: "No", consequence: forfeit },
          ],
        },
      ];
    },
  },

  /**
   * **Who said this?** One person volunteers something about themselves; it
   * becomes a question for everybody else. `authors` multiplies — one
   * submission becomes one question — so a curator adds this once and the
   * group generates the content.
   *
   * The privacy rule that matters: Passport never harvests this. A person
   * types the thing in themselves, knowing exactly what it is for.
   */
  people: {
    family: "people",
    label: "Who said this?",
    blurb: "Everyone volunteers one thing. Guess who wrote which.",
    weight: 2,
    build: (input) => [
      {
        ...base(input, "people"),
        question: input.text,
        kind: "text",
        placeholder: "Something true you're happy for this lot to know.",
        // Sealed from everyone, including Passport, until it becomes a question.
        reveal: "never",
      },
      {
        ...base(input, "people"),
        id: `${input.id}-guess`,
        question: "Who said this?",
        kind: "person",
        reveal: "onCue",
        optionsFrom: { promptId: input.id, as: "authors" },
        scoring: { points: input.points, label: "Knew it" },
      },
    ],
  },

  ask: {
    family: "ask",
    label: "Just ask them something",
    blurb: "No points, no game. You were curious.",
    weight: 1,
    build: (input) => [
      {
        ...base(input, "ask"),
        question: input.text,
        kind: "choice",
        reveal: "immediate",
        options: [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
          { id: "maybe", label: "Ask me later" },
        ],
      },
    ],
  },
};

/** `"Pick a side | the losers wear the other colours"` → question and forfeit. */
function splitForfeit(text: string): [string, string] {
  const [question, forfeit] = text.split("|").map((part) => part.trim());
  return [question, forfeit ?? "Loser buys the first round of something soft."];
}

/**
 * What Passport is willing to suggest right now.
 *
 * Three filters, and each one is a product claim:
 *
 * 1. **the fixture has wording for it** — no starters, no toy, which is why
 *    Date Night has no dares and Light-Up has no forfeits;
 * 2. **it is at or below the ceiling** — the lower of the night's and mine;
 * 3. **the group has appetite for it** — a curator who said "we mostly want
 *    to watch the game" is not offered the three-part ones.
 */
export function offeredToys(
  definition: ExperienceDefinition,
  edge: Edge,
  appetite: "watch" | "some" | "lots",
): { toy: Toy; starters: readonly Starter[] }[] {
  const maxWeight = appetite === "watch" ? 1 : appetite === "some" ? 2 : 3;

  return (Object.keys(TOYS) as ToyFamily[])
    .map((family) => {
      const starters = (definition.starters?.[family] ?? []).filter(
        (starter) => starter.edge <= edge,
      );
      return { toy: TOYS[family], starters };
    })
    .filter(
      ({ toy, starters }) => starters.length > 0 && toy.weight <= maxWeight,
    );
}

/** How many things the group is being asked to do. Used to warn, never to block. */
export function interactionLoad(prompts: readonly Prompt[]): number {
  return prompts.filter((p) => p.reveal !== "never").length;
}
