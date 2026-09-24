/**
 * **The store, out loud.**
 *
 * Everything here is **synthesised**, not recorded. That is a compromise and
 * it is worth naming: this project has no foley library, and a library cue
 * dropped in unlistened-to would be worse than nothing. What noise-through-a-
 * filter can do honestly is *physical transients* — a case hitting a board, a
 * shoe compressing carpet, cloth shifting — because those are broadband
 * impulses shaped by a resonance and an envelope, which is exactly what this
 * builds. What it cannot do is anything with a voice or a tone in it, so
 * nothing here has one. No stings, no drones, no musical cues.
 *
 * Recorded foley would be better and should replace this. The shapes below are
 * the brief for it.
 */

interface Voice {
  readonly ctx: AudioContext;
  readonly out: GainNode;
}

let rig: Voice | null = null;

/**
 * Browsers will not make a sound until the person has done something. The
 * context is built on the first click or key and resumed thereafter; before
 * that, every call here is a silent no-op rather than an error.
 */
export function armSound(): void {
  if (rig) {
    void rig.ctx.resume();
    return;
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  rig = { ctx, out };
  void ctx.resume();
}

export function soundReady(): boolean {
  return rig !== null && rig.ctx.state === "running";
}

/** A short burst of noise, which is what every physical sound starts as. */
function noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

interface Shape {
  /** Where the energy sits. */
  readonly hz: number;
  readonly q: number;
  readonly type: BiquadFilterType;
  /** Seconds. */
  readonly attack: number;
  readonly decay: number;
  readonly level: number;
}

/** Hard plastic onto an old wooden board. A click, then the board. */
const THUD: readonly Shape[] = [
  {
    hz: 2600,
    q: 0.7,
    type: "highpass",
    attack: 0.0006,
    decay: 0.028,
    level: 0.5,
  },
  { hz: 320, q: 3.2, type: "bandpass", attack: 0.0015, decay: 0.15, level: 1 },
  {
    hz: 118,
    q: 5.5,
    type: "bandpass",
    attack: 0.002,
    decay: 0.26,
    level: 0.55,
  },
];
/** Cases knocking against each other in their cavities. */
const RATTLE: readonly Shape[] = [
  {
    hz: 1700,
    q: 1.4,
    type: "bandpass",
    attack: 0.001,
    decay: 0.045,
    level: 0.5,
  },
];
/** A child's shoe on carpet. Almost no attack, and gone immediately. */
const SNEAKER: readonly Shape[] = [
  { hz: 380, q: 0.8, type: "lowpass", attack: 0.005, decay: 0.07, level: 0.8 },
  {
    hz: 2200,
    q: 1.1,
    type: "bandpass",
    attack: 0.003,
    decay: 0.035,
    level: 0.22,
  },
];
/** Fabric moving against itself. */
const CLOTH: readonly Shape[] = [
  { hz: 2900, q: 0.8, type: "bandpass", attack: 0.03, decay: 0.14, level: 0.4 },
];
/** A case sliding on a board. */
const SLIDE: readonly Shape[] = [
  {
    hz: 1500,
    q: 0.9,
    type: "bandpass",
    attack: 0.03,
    decay: 0.16,
    level: 0.35,
  },
];

function strike(
  ctx: AudioContext,
  into: AudioNode,
  at: number,
  shapes: readonly Shape[],
  gain: number,
) {
  for (const s of shapes) {
    const src = noise(ctx, s.attack + s.decay + 0.02);
    const filter = ctx.createBiquadFilter();
    filter.type = s.type;
    filter.frequency.value = s.hz;
    filter.Q.value = s.q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, s.level * gain),
      at + s.attack,
    );
    env.gain.exponentialRampToValueAtTime(0.0001, at + s.attack + s.decay);
    src.connect(filter).connect(env).connect(into);
    src.start(at);
    src.stop(at + s.attack + s.decay + 0.02);
  }
}

/** Where a sound happens on the shelf, as a gentle left–right placement. */
function shelfSpot(ctx: AudioContext, x: number): AudioNode {
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, (x - 0.5) * 1.5));
  return pan;
}

/** The tape being taken and hitting the board, plus its neighbours. */
export function playImpact(x: number, force: number): void {
  if (!soundReady() || !rig) return;
  const { ctx, out } = rig;
  const spot = shelfSpot(ctx, x);
  spot.connect(out);
  const now = ctx.currentTime + 0.012;
  strike(ctx, spot, now, THUD, 0.85 * force);
  // Neighbours, a few milliseconds behind and unevenly spaced.
  for (const [delay, level] of [
    [0.035, 0.3],
    [0.061, 0.19],
    [0.094, 0.13],
    [0.148, 0.08],
  ] as const) {
    strike(ctx, spot, now + delay, RATTLE, level * force);
  }
}

export function playSlide(x: number, force: number): void {
  if (!soundReady() || !rig) return;
  const { ctx, out } = rig;
  const spot = shelfSpot(ctx, x);
  spot.connect(out);
  strike(ctx, spot, ctx.currentTime + 0.01, SLIDE, 0.5 * force);
}

/** Somewhere in the room, in metres: +x right, −z in front, +z behind. */
function somewhere(
  ctx: AudioContext,
  x: number,
  y: number,
  z: number,
): PannerNode {
  const p = ctx.createPanner();
  p.panningModel = "HRTF";
  p.distanceModel = "inverse";
  p.refDistance = 1.2;
  p.rolloffFactor = 0.7;
  p.positionX.value = x;
  p.positionY.value = y;
  p.positionZ.value = z;
  return p;
}

/**
 * **A child running past you in the dark.**
 *
 * Six quick light steps on carpet with cloth between them, fired into one
 * `PannerNode` whose position is automated from where he was last seen, down
 * the listener's right side, past their head and behind it, where it stops.
 *
 * Every element of this is a thing that happened: a shoe compressing carpet,
 * a sleeve against a side. There is no swoosh, no sting and no processing —
 * the horror is entirely in the fact that you can hear where he went and you
 * did not see him go.
 *
 * HRTF convolves against a real head-related transfer function, so on
 * headphones this genuinely passes behind the head rather than being the
 * left/right volume trick a stereo panner would give.
 */
export function playRunPast(): void {
  if (!soundReady() || !rig) return;
  const { ctx, out } = rig;
  const T = 1.0;
  const t0 = ctx.currentTime + 0.01;

  const panner = somewhere(ctx, 2.2, 0, -2.6);
  panner.connect(out);
  const path: readonly (readonly [number, number, number, number])[] = [
    [0.0, 2.2, 0.0, -2.6],
    [0.34, 1.4, 0.0, -0.8],
    [0.58, 0.75, 0.04, 0.12],
    [0.8, 0.5, 0.05, 1.1],
    [T, 0.4, 0.03, 2.2],
  ];
  const [px, py, pz] = [panner.positionX, panner.positionY, panner.positionZ];
  px.setValueAtTime(path[0]![1], t0);
  py.setValueAtTime(path[0]![2], t0);
  pz.setValueAtTime(path[0]![3], t0);
  for (const [at, x, y, z] of path.slice(1)) {
    px.linearRampToValueAtTime(x, t0 + at);
    py.linearRampToValueAtTime(y, t0 + at);
    pz.linearRampToValueAtTime(z, t0 + at);
  }

  // A child's stride, not an adult's: about 160ms, and never quite even.
  for (const [at, level] of [
    [0.02, 0.3],
    [0.18, 0.34],
    [0.35, 0.36],
    [0.5, 0.36],
    [0.67, 0.32],
    [0.83, 0.26],
  ] as const) {
    strike(ctx, panner, t0 + at, SNEAKER, level);
  }
  for (const [at, level] of [
    [0.1, 0.1],
    [0.43, 0.12],
    [0.75, 0.1],
  ] as const) {
    strike(ctx, panner, t0 + at, CLOTH, level);
  }
}
