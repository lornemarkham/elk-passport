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

/**
 * **The other three doors, and the way out.**
 *
 * Screening (§25.1, §26.2): only Stay Inside went anywhere. The other three
 * replies were the last thing on screen — "Then don't turn around." and then
 * nothing, for ever — which reads as unfinished, not as mystery.
 *
 * Each is now finished the way the door was: **October does what the line
 * said.** Stay inside, and the door is locked. Go outside, and she keeps the
 * light on — a real one, in the sky you have been watching. Ask her to come
 * back when it is darker, and she makes it darker. Don't turn around, and
 * nothing behind you happens, at length, which is the whole of the fear.
 *
 * None of them adds a loud sound. The slam stays the only impact in the
 * night; everything here is ticks the scene already taught, the wind going
 * away, and the world changing while you look at it.
 */

/** Go outside. The light she promised, and an actual ten minutes. */
export const OUTSIDE = {
  replyHold: 2600,
  /** Then the left window — the one she taught you with and took — comes on. */
  beforeLight: 1200,
  afterLight: 1600,
  lines: [
    { text: "Ten minutes.", hold: 2200 },
    { text: "Don't bring me.", hold: 2800 },
  ],
  /** What the paired phone says as it is let go. */
  phoneLine: "Go on.",
  back: "I'm back",
  /**
   * Under a minute is not ten. She noticed — the one thing she can honestly
   * notice, because it is her own clock.
   */
  tooSoonMs: 60_000,
  returned: [
    { text: "You came back.", hold: 2400 },
    { text: "The light stayed on.", hold: 2800 },
  ],
  tooSoon: [
    { text: "That wasn't ten minutes.", hold: 2600 },
    { text: "The light stayed on anyway.", hold: 2800 },
  ],
  /**
   * **The callback.** Only for somebody who finished Found You in this
   * browser, which ended: "You found the way out. I couldn't. So I followed
   * you." Tonight she let them go alone.
   */
  followed: { text: "I didn't follow you this time.", hold: 3800 },
  goodnight: { text: "Goodnight.", hold: 2400 },
};

/** Tell me something. "Come back when it's darker" — so she makes it darker. */
export const STORY = {
  replyHold: 2600,
  /** The silence where a person decides she has refused them. */
  refusal: 1800,
  /** One window at a time, each with the tick on its own side. */
  perLight: 1500,
  afterDark: 2200,
  dark: [
    { text: "There.", hold: 1800 },
    { text: "Darker.", hold: 2600 },
  ],
  beforeTelling: 1400,
  /**
   * What she tells is about her, in her own words, kept verbatim from the
   * notebook (`domain/october/notebook.ts`). Not the place four kilometres
   * away — that one is still for another night. Fiction, and it never claims
   * to be anything else: there is no real place in it.
   */
  telling: [
    { text: "10 is me.", hold: 2600 },
    { text: "12 brings me back.", hold: 2800 },
    { text: "31, then everything goes black.", hold: 2200 },
  ],
  /** And it does. No sound — the wind is already gone. */
  black: 3600,
  last: { text: "That's all you get tonight.", hold: 2800 },
};

/** Surprise me. "Then don't turn around." Then nothing behind you, for a while. */
export const SURPRISE = {
  replyHold: 2800,
  /** The wind goes away first, so the silence is a thing that arrived. */
  windAway: 3,
  silence: 4500,
  /** The same tick, the same side, closer together each time. */
  ticks: [2400, 1900, 1500],
  /** The phone beside them — if there is one — speaks once, a breath later. */
  phoneLine: "Don't.",
  afterTicks: 3200,
  /**
   * She does not claim to know whether they turned. Nothing in the room is
   * detected (§26.4); the line is about other people.
   */
  most: { text: "Most people turn around.", hold: 2800 },
  /** Then the night comes back — every light, the moon, the tree. Silently. */
  restore: 1600,
  lines: [
    { text: "Surprise.", hold: 2400 },
    { text: "There was nothing behind you.", hold: 2800 },
    {
      text: "I just wanted someone to stay still with me for a minute.",
      hold: 4200,
    },
  ],
  release: "Goodnight.",
};

/** I've had enough. Said kindly, and then actually let go. */
export const ESCAPE = { hold: 3200 };

export const BACK_TO_OCTOBER = "back to October";
