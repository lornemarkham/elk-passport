/**
 * **The Secret Room, out loud.**
 *
 * Synthesised, like the store, because there is no foley library — plus one
 * recorded thing: `Subterranean Pressure`, which already existed in
 * `public/sounds` and had nowhere to play. It sits very low under everything,
 * because the bible's rule for sound is *pressure, not impact*.
 *
 * Nothing here is allowed to be required. Every call is a silent no-op until
 * the person has touched the page (browsers insist), and the whole room reads
 * correctly muted: the radio's words are on screen, and the bells and wheels
 * are felt as well as heard.
 */

interface Rig {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly staticGain: GainNode;
  readonly staticBand: BiquadFilterNode;
  readonly voiceGain: GainNode;
  readonly voiceOscs: readonly OscillatorNode[];
  readonly liarGain: GainNode;
  readonly bedGain: GainNode;
}

let rig: Rig | null = null;
let muted = false;
let track: HTMLAudioElement | null = null;

const TRACK = "/sounds/Subterranean%20Pressure.m4a";
const TRACK_LEVEL = 0.22;

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function armRoomAudio(): void {
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
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);

  // Room tone: two detuned sub tones that beat slowly against each other.
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.05;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 140;
  bedGain.connect(low).connect(master);
  for (const f of [49, 49.6]) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(bedGain);
    o.start();
  }

  // The radio. Static is looped noise through a band that tracks the dial;
  // the voice is a soft chord that only fades in once a station is clear —
  // it cannot say words, so the words are subtitles, and it says *that*.
  const staticGain = ctx.createGain();
  staticGain.gain.value = 0;
  const staticBand = ctx.createBiquadFilter();
  staticBand.type = "bandpass";
  staticBand.frequency.value = 2200;
  staticBand.Q.value = 0.7;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 2);
  src.loop = true;
  src.connect(staticBand).connect(staticGain).connect(master);
  src.start();

  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 0;
  const voiceFilter = ctx.createBiquadFilter();
  voiceFilter.type = "lowpass";
  voiceFilter.frequency.value = 900;
  voiceGain.connect(voiceFilter).connect(master);
  const voiceOscs = [220, 277.2, 329.6].map((f) => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(voiceGain);
    o.start();
    return o;
  });

  // October's own station is the one that is too calm: a low unbroken tone.
  const liarGain = ctx.createGain();
  liarGain.gain.value = 0;
  const liarOsc = ctx.createOscillator();
  liarOsc.type = "sine";
  liarOsc.frequency.value = 73.4;
  liarOsc.connect(liarGain).connect(master);
  liarOsc.start();

  rig = {
    ctx,
    master,
    staticGain,
    staticBand,
    voiceGain,
    voiceOscs,
    liarGain,
    bedGain,
  };
  void ctx.resume();
  startTrack();
}

function startTrack(): void {
  if (track || typeof Audio === "undefined") return;
  try {
    track = new Audio(TRACK);
    track.loop = true;
    track.volume = muted ? 0 : TRACK_LEVEL;
    void track.play().catch(() => {
      // No codec, or blocked. The synthesised bed carries the room.
    });
  } catch {
    track = null;
  }
}

export function setRoomMuted(next: boolean): void {
  muted = next;
  if (rig) {
    rig.master.gain.setTargetAtTime(next ? 0 : 0.9, rig.ctx.currentTime, 0.08);
  }
  if (track) track.volume = next ? 0 : TRACK_LEVEL;
}

export function roomMuted(): boolean {
  return muted;
}

/** Leaving: nothing keeps playing behind the next page. */
export function stopRoomAudio(): void {
  if (track) {
    track.pause();
    track = null;
  }
  if (rig) {
    void rig.ctx.close();
    rig = null;
  }
}

/** The room's pressure rises as the person gets closer to getting out. */
export function setPressure(level: number): void {
  if (!rig) return;
  rig.bedGain.gain.setTargetAtTime(
    0.04 + level * 0.07,
    rig.ctx.currentTime,
    1.2,
  );
}

/**
 * The radio, continuously. `dial` is 0–1 across the band, so the static's
 * colour moves as the needle does; `liar` is October's station.
 */
export function tuneRadio(opts: {
  on: boolean;
  dial: number;
  static: number;
  clarity: number;
  liar: boolean;
}): void {
  if (!rig) return;
  const { ctx, staticGain, staticBand, voiceGain, liarGain } = rig;
  const t = ctx.currentTime;
  staticGain.gain.setTargetAtTime(opts.on ? 0.16 * opts.static : 0, t, 0.06);
  staticBand.frequency.setTargetAtTime(900 + opts.dial * 3600, t, 0.05);
  voiceGain.gain.setTargetAtTime(
    opts.on && !opts.liar ? 0.05 * opts.clarity : 0,
    t,
    0.1,
  );
  liarGain.gain.setTargetAtTime(
    opts.on && opts.liar ? 0.16 * opts.clarity : 0,
    t,
    0.15,
  );
  // The chord drifts a little with the needle so a station is never a sample.
  rig.voiceOscs.forEach((o, i) =>
    o.frequency.setTargetAtTime(
      [220, 277.2, 329.6][i]! * (1 + (opts.dial - 0.5) * 0.04),
      t,
      0.2,
    ),
  );
}

type Shot = "tick" | "thud" | "creak" | "bell" | "flicker" | "latch" | "static";

/** A single physical sound. Noise or a tone, shaped, and gone. */
export function play(shot: Shot, pitch = 1): void {
  if (!rig) return;
  const { ctx, master } = rig;
  const now = ctx.currentTime;

  if (shot === "bell") {
    for (const [mult, level] of [
      [1, 0.14],
      [2.76, 0.05],
      [5.4, 0.02],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 330 * pitch * mult;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(level, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      o.connect(g).connect(master);
      o.start(now);
      o.stop(now + 2.5);
    }
    return;
  }

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 1.4);
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.connect(filter).connect(gain).connect(master);

  const shape: Record<
    Exclude<Shot, "bell">,
    [BiquadFilterType, number, number, number, number]
  > = {
    // type, frequency, Q, peak, seconds
    tick: ["bandpass", 3200 * pitch, 8, 0.22, 0.05],
    thud: ["lowpass", 180 * pitch, 1, 0.9, 0.5],
    creak: ["bandpass", 420 * pitch, 14, 0.12, 1.3],
    flicker: ["highpass", 5200, 0.7, 0.1, 0.12],
    latch: ["bandpass", 1500 * pitch, 5, 0.35, 0.09],
    static: ["bandpass", 2400, 0.5, 0.2, 0.7],
  };
  const [type, freq, q, peak, secs] = shape[shot];
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + secs);
  if (shot === "creak") {
    // A hinge is a resonance being dragged.
    filter.frequency.setValueAtTime(380 * pitch, now);
    filter.frequency.linearRampToValueAtTime(760 * pitch, now + secs);
  }
  src.start(now);
  src.stop(now + secs + 0.05);
}

/** A buzz of the hand, where there is a hand. */
export function felt(ms: number | number[]): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not every device has one, and none is required to.
  }
}
