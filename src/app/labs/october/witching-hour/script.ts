/**
 * **The night, written down. Director's cut, v0.1.**
 *
 * Every timing here was changed after the first physical screening
 * (bible §25), and the reason is one sentence: _the pauses were longer than
 * the tension they contained._ v0 reached the phone at 53 s and then waited
 * 59 s on timers; on hardware that read as "is this broken?", and "Still
 * awake?" became literal.
 *
 * The rule for this cut: keep silence where it holds anticipation, remove
 * silence that holds nothing. A pause is earned by what came just before it,
 * so the long ones sit **after** a beat that landed — never as filler.
 * Where a wait must exist (the phone leaving the room), the desktop does one
 * quiet thing inside it, so the wait reads as October's and not the software's.
 *
 * Timings in milliseconds. A beat is roughly one slow breath.
 */
export const BEAT = 1200;

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
  /** Enough for the sky to register. Not enough to study it. */
  before: 600,
  lines: [
    { text: CONTEXT.time, hold: 1500 },
    { text: `${CONTEXT.place} is quiet tonight.`, hold: 2000 },
    { text: "Most people are finished with October for tonight.", hold: 2200 },
    { text: "You're not.", hold: 2600 },
  ],
  gap: 360,
  /** The one silence in Act I. It follows "You're not." — it is earned. */
  silenceAfter: 2400,
};

export const ACT_II = {
  ask: "Headphones?",
  yes: "Good.",
  no: "That's okay.",
  /** After the answer, before the first lesson. Short: they just did something. */
  settle: 1100,
  /**
   * Teaching. Sound on one side, then — after long enough to be felt as
   * cause and effect — something harmless on that same side. Twice, opposite
   * sides. Three seconds between is enough for two lessons to be two.
   */
  lessons: [
    { side: -1 as const, delay: 900, effect: "light-on" as const },
    { side: 1 as const, delay: 1000, effect: "branch" as const },
  ],
  betweenLessons: 3000,
};

export const ACT_III = {
  /** Sound right. Nothing right. Then the left light goes out, unmentioned. */
  soundSide: 1 as const,
  nothingFor: 3200,
  effectSide: -1 as const,
  effect: "light-off" as const,
  /** Let it sit — this one is earned by the violation. */
  settle: 3400,
};

export const ACT_IV = {
  phoneAlone: {
    ask: "Hold the phone in your hand.",
    beforePulse: 3200,
    after: "That was me.",
    afterHold: 2400,
    second: "I'll do it again when it matters.",
  },
  paired: {
    desktopAsk: "I need your phone for this.",
    scanHint: "Open the camera. Point it here.",
    connected: "Good.",
    faceDown: "Put your phone face down beside you.",
    /**
     * While the phone is down. Not silence — the desktop does two quiet
     * things in it, so the wait is visibly October's. Long enough for the
     * phone to stop being the thing in the hand; short enough that no
     * iPhone auto-locks inside it even with no wake lock (the minimum
     * auto-lock is 30 s).
     */
    leaveIt: "Leave it there.",
    leaveItAfter: 1800,
    dormancy: 9000,
    wakeLine: "I didn't tell you to pick it up.",
    /**
     * How long the phone holds their attention before the desktop moves.
     * Then the desktop makes one small sound — the hook that brings the eyes
     * back to a world that is already different.
     */
    attentionWindow: 1500,
    hookAfter: 2200,
    putItBack: "Put it back.",
    secondDormancy: 7000,
    secondWakeLine: "Look at me for a moment.",
    releaseLine: "Okay.",
    afterRelease: 1400,
  },
};

export const ACT_V = {
  ask: "Still awake?",
  then: "Then let's do something with the night.",
  choicesAfter: 900,
  choiceStagger: 320,
  choices: [
    {
      id: "inside",
      label: "Stay inside",
      whisper: "A film. A story. Something warm.",
      reply: "Good.\nThe door stays closed tonight.",
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

/**
 * **The door.**
 *
 * Screening finding: after "The door stays closed tonight" the person waited
 * for the door, and nothing happened. The writing had promised it. So:
 *
 *   the reply lands → a beat → a latch, somewhere to the right and behind →
 *   long enough to wonder → ONE heavy door, in the room → silence → "Locked."
 *
 * The person meant "I'll pick an indoor activity." For one moment October
 * hears "you are staying inside." Then it hands them something useful.
 *
 * "Locked." is kept after trying the cut without it: the slam alone reads as
 * an effect; the word turns it into the joke.
 */
export const DOOR = {
  replyHold: 2400,
  beforeLatch: 1300,
  /** Latch to slam. The anticipation. Longer than feels comfortable to write. */
  latchToSlam: 2600,
  silenceAfter: 2400,
  locked: "Locked.",
  lockedHold: 2000,
  /** Then the surface. Short — do not leave them staring at trees again. */
  beforeSurface: 900,
};
