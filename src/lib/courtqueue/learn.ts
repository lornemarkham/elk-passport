/**
 * **Learn badminton.** Short, plain lessons and the things a player can
 * choose to practise. Written for this club's drop-in nights: nothing here is
 * a test, a grade or a requirement. No outside links — every diagram is drawn
 * in the app (`LearnDiagrams.tsx`).
 */

export type DiagramId =
  "grip" | "serve" | "footwork" | "clear-drop" | "doubles" | "talk" | "target";

export interface Lesson {
  readonly id: string;
  readonly title: string;
  /** One sentence, shown on the list. */
  readonly gist: string;
  readonly diagram: DiagramId;
  /** Short steps, in the order to try them. */
  readonly points: readonly string[];
  /** One small thing to try at the next game. */
  readonly tryThis: string;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: "grip-serve",
    title: "Grip and serving",
    gist: "A relaxed handshake grip, and a low serve that lands short.",
    diagram: "grip",
    points: [
      "Hold the racket like a handshake: the V between thumb and finger sits on top of the handle.",
      "Keep your fingers loose. Squeeze only when you hit — a tight grip makes a slow, tired arm.",
      "Doubles serve: stand near the front line, racket low, and hit the shuttle below your waist.",
      "Aim for a gentle flight that just clears the net and lands near the short service line.",
      "Serve diagonally into the opposite box. Both feet stay on the floor until you've hit it.",
    ],
    tryThis:
      "Serve ten in a row into the diagonal box. Count only the ones that land short — no pressure, it's just a good game of its own.",
  },
  {
    id: "footwork",
    title: "Footwork",
    gist: "Small, quick steps from the middle, then back to the middle.",
    diagram: "footwork",
    points: [
      "Wait in the middle, knees soft, racket up in front of you, weight on your toes.",
      "Take small side-steps and a last long step (a lunge) to reach a far shuttle.",
      "Push off your front foot to come back to the middle. The step back matters as much as the reach.",
      "Move to the shuttle, don't stretch your arm to it. Feet first, racket second.",
    ],
    tryThis:
      "Between rallies, shadow-step: middle → front corner → middle → back corner. Ten slow ones are plenty.",
  },
  {
    id: "clears-drops",
    title: "Clears and drops",
    gist: "Two shots that look the same until the very end.",
    diagram: "clear-drop",
    points: [
      "A clear is a high, deep shot that lands at the back — it buys you time to get back to the middle.",
      "A drop is a soft shot that falls just over the net — it moves your opponent forward.",
      "Hit both from the same ready position with the racket up and the elbow leading.",
      "Start with the clear. Aim to land it in the last metre of the court.",
      "Then add the drop with a slower finish. The shuttle should die softly on the other side.",
    ],
    tryThis:
      "With a friendly partner, clear to each other for two minutes. Then swap in a drop now and then.",
  },
  {
    id: "doubles",
    title: "Doubles positioning",
    gist: "Side-by-side to defend, front-and-back to attack.",
    diagram: "doubles",
    points: [
      "When the shuttle is going to come low, play front and back: one of you at the net, one at the rear.",
      "When the shuttle is coming hard from the other side, stand side by side and cover your half each.",
      "After you hit, move toward the shape that suits the next shot — don't stay where you hit.",
      "Leave the middle to whoever has the stronger side facing it, and say so (see Communication).",
    ],
    tryThis:
      "Agree before the game: who takes the middle, and when we change shape. Two minutes of talk saves many points.",
  },
  {
    id: "communication",
    title: "Communication",
    gist: "Short words, said early, make partners look psychic.",
    diagram: "talk",
    points: [
      'Say "Mine" or "Yours" early and loudly. Silence is how two people hit the same shuttle.',
      'Say "Switch" or "Go" when you change shape.',
      "Praise a good shot, and shrug off a miss. Nobody plays their best when they're worried.",
      "Learn your partner's name in the first minute, and ask what they enjoy.",
    ],
    tryThis:
      "For one game, call every shuttle out loud. It feels silly for two rallies, then it feels brilliant.",
  },
  {
    id: "consistency",
    title: "Improving consistency",
    gist: "A shot you can repeat beats a shot you can only hope for.",
    diagram: "target",
    points: [
      "Pick a target (a corner, a line) before every hit. A target makes a shot a choice instead of a hope.",
      "Aim for the middle of the court first. A rally that stays alive is practice too.",
      "Slow down by ten percent. Most mistakes come from rushing, not from a lack of ability.",
      "Notice one thing per game — your grip, your feet, your follow-through — rather than fixing everything.",
    ],
    tryThis:
      "Play a rally where the only goal is to keep the shuttle going, and count how long you can.",
  },
];

export interface Technique {
  readonly id: string;
  readonly label: string;
  readonly lesson: string;
}

/** Things a player can mark as "I'm practising this" — for them alone. */
export const TECHNIQUES: readonly Technique[] = [
  {
    id: "handshake-grip",
    label: "A relaxed handshake grip",
    lesson: "grip-serve",
  },
  { id: "low-serve", label: "A low, short serve", lesson: "grip-serve" },
  {
    id: "ready-position",
    label: "Coming back to the middle",
    lesson: "footwork",
  },
  { id: "lunge", label: "The reaching lunge", lesson: "footwork" },
  { id: "overhead-clear", label: "The overhead clear", lesson: "clears-drops" },
  { id: "soft-drop", label: "The soft drop", lesson: "clears-drops" },
  { id: "front-back", label: "Front-and-back in doubles", lesson: "doubles" },
  { id: "calling", label: "Calling Mine / Yours", lesson: "communication" },
  { id: "targets", label: "Picking a target", lesson: "consistency" },
];

export interface Challenge {
  readonly id: string;
  readonly label: string;
}

/** Optional, playful. Nobody sees whether you did them. */
export const CHALLENGES: readonly Challenge[] = [
  {
    id: "meet-three",
    label: "Play with three people you haven't played with before.",
  },
  {
    id: "call-it",
    label: 'Call "Mine" or "Yours" on every shuttle for one whole game.',
  },
  { id: "ten-serves", label: "Land ten low serves in a row in the short box." },
  {
    id: "long-rally",
    label: "Keep one rally going for twenty hits with your partner.",
  },
  { id: "one-drop", label: "Try one soft drop in a game, whatever happens." },
  { id: "thank-someone", label: "Thank somebody for a fun game." },
  {
    id: "ask-tip",
    label: "Ask someone for one tip — or offer one if they'd like it.",
  },
  { id: "new-night", label: "Come to three nights in a row." },
];

export const TECHNIQUE_IDS: ReadonlySet<string> = new Set(
  TECHNIQUES.map((t) => t.id),
);
export const CHALLENGE_IDS: ReadonlySet<string> = new Set(
  CHALLENGES.map((c) => c.id),
);

export type LevelId = "beginner" | "intermediate" | "advanced";

/** Skills worth exploring, by where a player says they are. Suggestions only. */
export const EXPLORE: Readonly<Record<LevelId, readonly string[]>> = {
  beginner: [
    "Getting comfortable with the grip",
    "Serving the shuttle over the net, again and again",
    "Moving back to the middle after each shot",
    "Rallying: keeping it going matters more than winning",
  ],
  intermediate: [
    "A low, short serve and a flick serve to surprise",
    "Clears that reach the back line",
    "Drops that fall close to the net",
    "Rotating front-and-back with a partner",
  ],
  advanced: [
    "Disguise: the same preparation for a clear, a drop and a smash",
    "Reading the shuttle early and attacking the net",
    "Placing the third shot of a rally on purpose",
    "Helping a newer player enjoy a game — it sharpens your own basics",
  ],
};

export const lessonOf = (id: string) => LESSONS.find((l) => l.id === id);
