/**
 * **The night, written down.**
 *
 * Director intent, not immutable copy. Every line here is a fixture so the
 * scene can be re-cut without touching a component, and so a second visit can
 * someday be the same night with one thing different.
 *
 * Timings are in milliseconds and were chosen by feel, then argued with. A
 * beat is roughly the time it takes to read a short line twice.
 */
export const BEAT = 1400;

/** The fixtured world. No API calls in v0 — the world is authored tonight. */
export const CONTEXT = {
  date: "October 24",
  time: "11:47 PM",
  place: "Coldstream",
  temperature: "3°C",
  sky: "cloudy",
  moon: "partly obscured",
  fear: "Creepy",
} as const;

export const ACT_I = {
  lines: [
    { text: CONTEXT.time, hold: BEAT * 1.6 },
    { text: `${CONTEXT.place} is quiet tonight.`, hold: BEAT * 2 },
    {
      text: "Most people are finished with October for tonight.",
      hold: BEAT * 2.2,
    },
    { text: "You're not.", hold: BEAT * 2.6 },
  ],
  /** Then nothing. Long enough that the silence is noticed. */
  silenceAfter: 5200,
};

export const ACT_II = {
  ask: "Headphones?",
  yes: "Good.",
  no: "That's okay.",
  /**
   * Teaching. Sound on one side, then — after long enough that the two are
   * felt as cause and effect rather than one event — something harmless on
   * that same side. Twice, opposite sides, so the rule is learned and not
   * merely noticed.
   */
  lessons: [
    { side: -1 as const, delay: 900, effect: "light-on" as const },
    { side: 1 as const, delay: 1100, effect: "branch" as const },
  ],
  betweenLessons: 6500,
};

export const ACT_III = {
  /**
   * The rule breaks. Sound right. Nothing right. Then something small on the
   * left — the light the scene taught them to look for goes out — and the
   * scene does not mention it.
   */
  soundSide: 1 as const,
  nothingFor: 4200,
  effectSide: -1 as const,
  effect: "light-off" as const,
  /** Let it sit. If they missed it, the night simply continues. */
  settle: 7000,
};

export const ACT_IV = {
  phoneAlone: {
    ask: "Hold the phone in your hand.",
    beforePulse: 5500,
    after: "That was me.",
    afterHold: 3600,
    second: "I'll do it again when it matters.",
  },
  paired: {
    desktopAsk: "I need your phone for this.",
    scanHint: "Open the camera. Point it here.",
    connected: "Good.",
    faceDown: "Put your phone face down beside you.",
    /** Long enough that the phone has stopped being the thing in the room. */
    quietBeforeWake: 24000,
    wakeLine: "I didn't tell you to pick it up.",
    /** Long enough to look back at the screen, and settle. */
    quietBeforeSecondWake: 21000,
    secondWakeLine: "Look at me for a moment.",
    /** How long the phone holds their attention before the desktop moves. */
    attentionWindow: 1800,
    releaseLine: "Okay.",
  },
};

export const ACT_V = {
  ask: "Still awake?",
  then: "Then let's do something with the night.",
  choices: [
    {
      id: "inside",
      label: "Stay inside",
      whisper: "A film. A story. Something warm.",
      reply: "Good. The door stays closed tonight.",
    },
    {
      id: "outside",
      label: "Go outside",
      whisper: "The moon is up. So is something else.",
      reply: "Take a coat. I'll keep the light on.",
    },
    {
      id: "story",
      label: "Tell me something",
      whisper: "There's a place four kilometres from here.",
      reply: "Not tonight. Come back when it's darker.",
    },
    {
      id: "surprise",
      label: "Surprise me",
      whisper: "You already have.",
      reply: "Then don't turn around.",
    },
  ],
  escape: {
    label: "I've had enough",
    reply: "Sleep well. October will still be here.",
  },
};
