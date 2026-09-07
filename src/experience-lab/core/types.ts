/**
 * The Experience Lab's primitives.
 *
 * ## What this is trying to find out
 *
 * Passport's bet is that "a hockey night", "a powder day", "a date" and
 * "we have three free hours" are the *same object* wearing different
 * clothes — a living, shared space a group inhabits before, during and
 * after something happens. This file is the current best guess at that
 * object. Every type here is a **hypothesis**, not settled architecture;
 * `src/experience-lab/README.md` records which ones survived contact with
 * fixtures that are deliberately nothing like hockey.
 *
 * ## The two rules that kept it honest
 *
 * 1. **Nothing in here may name a sport, a season, or a mood.** The
 *    moment a field would have to say `homeTeam`, the primitive was wrong.
 * 2. **Competitiveness is a property of a question, not of the system.**
 *    A vote and a prediction are the same shape; one of them awards
 *    points. That single decision is what stops Date Night from being
 *    Hockey Night with softer labels.
 */

/** A person in the experience. No auth — see README on what this becomes. */
export interface Participant {
  readonly id: string;
  readonly name: string;
  /** Stand-in for an avatar. Deliberately not an image: identity has to survive a fixture with no photographs. */
  readonly emoji: string;
  /** OKLCH hue, 0–360. Gives each person a consistent colour across leaderboard, feed and picks. */
  readonly hue: number;
  /** One line of self-description the group can see. The seed of a real Passport profile. */
  readonly vibe?: string;
  /** True for people the fixture pretends are already in. False = they join in front of you. */
  readonly present: boolean;
}

/**
 * A stage of the experience, declared by the fixture rather than by an enum.
 *
 * An enum was the first attempt and it broke on the second fixture: "We have
 * three hours" has no countdown and no build-up, and a date has no leaderboard
 * phase to lock picks into. What every experience *does* have is an ordered
 * list of moments where the page should become about something else.
 */
export interface Phase {
  readonly id: string;
  /**
   * **How much of the room Passport is allowed to have.**
   *
   * Round 2's other structural addition, and the one most likely to matter
   * long-term. `quiet` means the real thing is happening and the page shrinks
   * to almost nothing; `burst` means there is a natural gap — an
   * intermission, a lift queue, waiting for a table — and a small amount of
   * play is welcome; `open` is before and after, where Passport can have as
   * much attention as it earns.
   *
   * Defaults to `open`, so every existing phase behaves exactly as it did.
   */
  readonly attention?: "open" | "quiet" | "burst";
  /** What the group sees. "Before", "Puck drop", "Tomorrow morning". */
  readonly label: string;
  /** Passport's one-line answer to "what is this page for right now?". */
  readonly headline: string;
  /** Minutes relative to the experience anchor. Negative = before it starts. */
  readonly offsetMinutes: number;
}

export type PromptKind =
  "choice" | "person" | "number" | "pair" | "boolean" | "text" | "photo";

/**
 * **How far this is allowed to go.**
 *
 * Round 2's most important safety primitive, and deliberately a scale rather
 * than a flag. Two separate ceilings apply and the *lower one wins*:
 *
 * - the **curator's** ceiling, set once for the night;
 * - each **participant's own** ceiling, set when they join.
 *
 * A person is never offered something above their own line, and never has to
 * decline in front of anybody to avoid it — declining in public is itself the
 * embarrassment the setting exists to prevent. Nothing shows who set what.
 */
export type Edge = 0 | 1 | 2 | 3;

export const EDGE_LABELS: Readonly<Record<Edge, string>> = {
  0: "Keep it cute",
  1: "Game for some fun",
  2: "Get weird",
  3: "No dignity",
};

/**
 * The kinds of toy the lab is testing. Naming the family is what lets the toy
 * box group ideas and lets a fixture supply its own wording for each — the
 * engine knows the shapes, a fixture knows the jokes.
 */
export type ToyFamily =
  | "prediction"
  | "sealed"
  | "mission"
  | "dare"
  | "sidequest"
  | "photo"
  | "vault"
  | "groupquest"
  | "consequence"
  | "people"
  | "ask";

export interface PromptOption {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly emoji?: string;
  /** Where this option came from. A suggestion added by a person is the point. */
  readonly addedBy?: string;
  /**
   * What you are signing up for by choosing this.
   *
   * "Pick a side. The losing side wears the other team's colours in the
   * postgame photo." The consequence lives on the *option* rather than on the
   * question, which turned out to be the whole trick: you cannot end up owing
   * something you did not personally pick.
   */
  readonly consequence?: string;
}

export type ResponseValue =
  string | readonly string[] | number | boolean | readonly [number, number];

/**
 * **The primitive that turned out to matter most.**
 *
 * A pregame vote, a score prediction, a stupid dare, a photo challenge, a
 * "where are we going now?" decision and a date-night "pick one of these
 * three" are all one thing: *a question put to the group, and what came
 * back*. They differ only in four switches:
 *
 * - `scoring` — present makes it a competition, absent makes it a decision.
 * - `reveal` — whether you see other people's answers before you commit.
 * - `privacy` — whether an answer is ever attributed in public.
 * - `openToSuggestions` — whether the group can change the question itself.
 *
 * Those four switches are the whole difference between Hockey Night and
 * Date Night. Nothing else in the engine had to change.
 */
export interface Prompt {
  readonly id: string;
  readonly question: string;
  /** Undefined = Passport asked it. A participant id = a person did, which reads completely differently. */
  readonly askedBy?: string;
  readonly kind: PromptKind;
  readonly options?: readonly PromptOption[];
  /** Labels for a `pair` answer, e.g. ["Canucks", "Flames"] or ["Runs", "Falls"]. */
  readonly pairLabels?: readonly [string, string];
  readonly unit?: string;
  readonly placeholder?: string;
  /**
   * `immediate` = a vote you watch happen. `onLock` = sealed until its lock
   * phase. `never` = private forever. `onCue` = sealed until a human opens it.
   *
   * `onCue` is the round-2 addition and the reason is worth recording: phases
   * are a clock, and "open the vault when everyone's back with a beer" is not
   * a time. Reveal timing turned out to be a thing somebody in the room
   * decides, not a thing the schedule decides.
   */
  readonly reveal: "immediate" | "onLock" | "never" | "onCue";
  /** Present = bragging rights are at stake. Absent = this is just a decision. */
  readonly scoring?: PromptScoring;
  /** The truth. Authored up front by a fixture, but withheld until `resolvesAtPhaseId`. */
  readonly resolution?: ResponseValue;
  /**
   * **Who decides the answer.**
   *
   * `world` (the default) is a prediction: something happened, and you were
   * right or you were not. `vote` is the group deciding — best photo, run of
   * the day, funniest thing anyone said — where there is no external truth and
   * the plurality *is* the truth.
   *
   * Round 1 recorded "can a vote be a resolution?" as an open question,
   * because Powder Day wanted to crown a run of the day and the engine could
   * only grade against the world. The answer turned out to be yes, and cheap:
   * a voted resolution is derived from the responses, so everything downstream
   * — scoring, awards, `settled`, the share card — works unchanged. A tie
   * stays unresolved, because "we could not agree" is a real outcome and
   * inventing a winner is not.
   */
  readonly resolvedBy?: "world" | "vote";
  /**
   * When the answer becomes known. Absent means "as soon as it is written".
   *
   * Splitting *having* a resolution from *knowing* it is what makes the
   * leaderboard genuinely empty before the thing happens and genuinely alive
   * during it, without any of the fixtures having to simulate a clock.
   */
  readonly resolvesAtPhaseId?: string;
  /** Which phase this belongs to. */
  readonly phaseId: string;
  /** Answers stop being accepted when this phase begins. */
  readonly locksAtPhaseId?: string;
  /** Anyone may add an option. This is how a group changes its own night. */
  readonly openToSuggestions?: boolean;
  /** Anyone may ask a question like this one. The single most fun affordance found. */
  readonly hint?: string;

  // ---- Round 2 ----

  /**
   * Who this question is for.
   *
   * `only` is a secret mission — one person sees it, and `observe()` cannot
   * see it either, because a mission Passport narrates is not a secret.
   * `except` is "who said this?", where the one person who must not be asked
   * is the person who wrote it. Both are enforced in the engine rather than in
   * a component.
   */
  readonly audience?: { readonly only?: string; readonly except?: string };
  /**
   * This question's options are other people's answers.
   *
   * The genuinely new primitive of round 2. "Vote on the photos" and "who
   * said this?" are both a question whose content did not exist when the
   * question was written. `submissions` turns each answer into an option;
   * `authors` turns the people who answered into the options and the real
   * author into the correct answer.
   */
  readonly optionsFrom?: {
    readonly promptId: string;
    readonly as: "submissions" | "authors";
  };
  /** You have to opt in before this can bind you. Dares and consequences. */
  readonly requiresConsent?: boolean;
  /** How far this goes. Filtered against the lower of the two ceilings. */
  readonly edge?: Edge;
  /** Which toy this came out of. Presentation and grouping only. */
  readonly family?: ToyFamily;
  /** Free text shown above the question — the mission briefing, the story. */
  readonly brief?: string;
}

export interface PromptScoring {
  readonly points: number;
  /**
   * Everybody scores if anybody completes it. Cooperative quests, where the
   * point is that the group did a thing together and no one person owns it.
   */
  readonly shared?: boolean;
  /** Extra credit for getting part of it right, e.g. the winner but not the score. */
  readonly partial?: { readonly points: number; readonly label: string };
  /** Shown next to the question so the stakes are legible without a rules screen. */
  readonly label?: string;
}

export interface Response {
  readonly promptId: string;
  readonly participantId: string;
  readonly value: ResponseValue;
  readonly at: string;
}

/**
 * Something that happened, in order. The feed during the experience and the
 * memory afterwards are the same list read at two different times — which is
 * why "the experience is over" never needs to delete anything.
 */
export interface Moment {
  readonly id: string;
  readonly at: string;
  readonly kind:
    "voice" | "join" | "photo" | "note" | "result" | "award" | "decision";
  /** Undefined = Passport said it. */
  readonly by?: string;
  readonly text?: string;
  readonly emoji?: string;
  /** Emoji → participant ids. Reactions are the lowest-effort way to be present. */
  readonly reactions?: Readonly<Record<string, readonly string[]>>;
  /** Marks a moment worth keeping in the recap. */
  readonly keepsake?: boolean;
}

/**
 * A block on the page. Reused deliberately from the existing Passport page
 * composition idea (`src/lib/passport/composition.ts`): sections in an order,
 * holding decisions and no facts. Here a block also declares *when* it exists.
 */
export type BlockKind =
  | "promptGroup"
  | "leaderboard"
  | "feed"
  | "roster"
  | "panel"
  | "recap"
  | "runItBack";

export interface Block {
  readonly id: string;
  readonly kind: BlockKind;
  /**
   * `deck` shows one question at a time. Round 1 found that seven prediction
   * cards in a column read as a form; this is the contained experiment in
   * fixing that without touching anything else on the page.
   */
  readonly present?: "list" | "deck";
  readonly title?: string;
  readonly subtitle?: string;
  /** Phases in which this block is on the page at all. */
  readonly phaseIds: readonly string[];
  /** For `promptGroup`. */
  readonly promptIds?: readonly string[];
  /** For `panel` — arbitrary lines of fixture content, e.g. ski conditions. */
  readonly lines?: readonly PanelLine[];
  /** Lets a group invent its own question inside this group. */
  readonly inviteOwnPrompt?: { readonly cta: string; readonly hint: string };
}

export interface PanelLine {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}

/** Fixture-supplied names for engine-derived outcomes. Who wins is computed; what they're called is authored. */
export interface Award {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
  readonly basis: "top" | "bottom" | "mostExact" | "boldest" | "quietest";
  readonly blurb: string;
}

/**
 * How Passport talks. Not a persona and not a chat bot — a register the
 * derived commentary is phrased in. The *observation* is computed from the
 * shape of the group's answers; only the wording comes from here.
 */
export type VoiceTone = "rowdy" | "warm" | "intimate" | "hype";

export interface ExperienceDefinition {
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly kicker: string;
  readonly emoji: string;
  /** Two OKLCH-ish CSS colours for the poster wash. A fixture's identity is mostly this. */
  readonly palette: readonly [string, string];
  /** ISO. Everything temporal is relative to this. */
  readonly anchorAt: string;
  readonly whereLine?: string;
  readonly hostId: string;
  /**
   * Wording for each toy family, supplied by the fixture.
   *
   * Same split that made the voice work: the engine knows the *shape* of a
   * secret mission, only a fixture knows that "get Nathan to say 'analytics'
   * out loud" is funny. A fixture with no starters for a family simply does
   * not offer that toy, which is how Date Night has no dares without anything
   * having to forbid them.
   */
  readonly starters?: Partial<Record<ToyFamily, readonly Starter[]>>;
  /** The slug this experience's "run it back" creates. */
  readonly nextEditionOf?: string;
  /**
   * What the invite says. Defaults to "<host> invited you to <title>", which
   * is right for a group and wrong for two people — a date is not something
   * you are invited to by name.
   */
  readonly inviteLine?: string;
  readonly tone: VoiceTone;
  readonly phases: readonly Phase[];
  readonly participants: readonly Participant[];
  readonly prompts: readonly Prompt[];
  readonly blocks: readonly Block[];
  readonly awards: readonly Award[];
  /** Answers the fixture pretends were already given, so a page is never empty on arrival. */
  readonly seedResponses: readonly Response[];
  readonly seedMoments: readonly Moment[];
  /** What a previous edition left behind. The whole of "tradition" so far. */
  readonly lineage?: Lineage;
  /** One line explaining what this fixture exists to disprove. Lab-only. */
  readonly labNote: string;
}

/**
 * One idea Passport can offer. Rerollable, editable, and never compulsory —
 * the round-1 finding was that the best question is the one Passport did not
 * write, so these exist to get a person over the blank page, not to be the
 * answer.
 */
export interface Starter {
  readonly text: string;
  readonly edge: Edge;
  /** Needs a person picked before it means anything. */
  readonly needsTarget?: boolean;
  /** Overrides the family default. */
  readonly points?: number;
}

export interface Lineage {
  readonly previousLabel: string;
  readonly defendingChampionId?: string;
  readonly standing: readonly {
    readonly participantId: string;
    readonly points: number;
  }[];
  readonly callback: string;
  /** Things the last edition left lying around. Derived when a next edition is created. */
  readonly receipts?: readonly string[];
}

/**
 * What the curator told Passport about the night.
 *
 * Deliberately four taps and an optional sentence. It is not onboarding and
 * it is not a profile — its entire job is to decide which toys Passport
 * offers and how hard it pushes, and if it ever stops visibly doing that it
 * should be deleted rather than expanded.
 */
export interface Brief {
  readonly audience: string;
  readonly vibe: string;
  readonly edge: Edge;
  readonly appetite: "watch" | "some" | "lots";
  readonly note?: string;
}

/** Everything a person has done here. The only thing that is persisted. */
export interface ExperienceState {
  readonly slug: string;
  readonly meId: string | null;
  readonly joinedIds: readonly string[];
  readonly responses: readonly Response[];
  readonly moments: readonly Moment[];
  readonly addedOptions: readonly {
    readonly promptId: string;
    readonly option: PromptOption;
  }[];
  readonly addedPrompts: readonly Prompt[];
  /** momentId → emoji → participant ids. Kept beside moments so a seeded moment can be reacted to without editing a fixture. */
  readonly reactions: Readonly<
    Record<string, Readonly<Record<string, readonly string[]>>>
  >;
  /** Someone who opened the link and chose not to be anybody. Still allowed to watch. */
  readonly lurking: boolean;
  /** What the curator said this night is. Null until they say. */
  readonly brief: Brief | null;
  /** My own ceiling, which can only ever be lower than the night's. */
  readonly myEdge: Edge | null;
  /** Prompts a human has opened. See `reveal: "onCue"`. */
  readonly cues: readonly string[];
  /** Prompts I have personally opted into. Nothing binds me without this. */
  readonly consented: readonly string[];
  /** Toys I was offered and passed on, so they are not offered again. */
  readonly declined: readonly string[];
  /** Lab time machine. Null = real clock. */
  readonly nowOverride: string | null;
}
