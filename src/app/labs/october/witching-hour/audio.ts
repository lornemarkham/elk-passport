"use client";

/**
 * **Sound that points.**
 *
 * Everything here is synthesised — the project holds no recorded samples, and
 * a room tone built from filtered noise is more honest than a stock "spooky
 * wind" anyway. Three sounds only:
 *
 *   wind    a bed. Present so silence has something to be the absence of.
 *   tick    a small dry event, panned hard to one side. The attention cue.
 *   thump   one low pulse. What the phone does when it wants to be picked up,
 *           on every platform — vibration exists on Android and not on iOS,
 *           and a rule that only half the audience can feel is not a rule.
 *
 * A browser will not start an AudioContext without a gesture. `unlock()` is
 * called from the one tap the scene asks for ("Headphones?"), and everything
 * after that is free.
 */
export interface Sound {
  unlock: () => Promise<void>;
  wind: (level: number, seconds?: number) => void;
  tick: (pan: -1 | 1) => void;
  thump: () => void;
  close: () => void;
  readonly ready: boolean;
}

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let windGain: GainNode | null = null;
  let master: GainNode | null = null;

  function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
    const buffer = c.createBuffer(
      1,
      Math.floor(c.sampleRate * seconds),
      c.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  return {
    get ready() {
      return ctx !== null && ctx.state === "running";
    },

    async unlock() {
      if (ctx) {
        if (ctx.state === "suspended") await ctx.resume();
        return;
      }
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      await ctx.resume();

      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      // Wind: brown-ish noise through a low-pass that wanders very slowly, so
      // it never quite repeats and never draws attention to itself.
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 6);
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 320;
      lp.Q.value = 0.4;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 110;
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start();
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      src.connect(lp).connect(windGain).connect(master);
      src.start();
    },

    wind(level, seconds = 4) {
      if (!ctx || !windGain) return;
      const t = ctx.currentTime;
      windGain.gain.cancelScheduledValues(t);
      windGain.gain.setValueAtTime(windGain.gain.value, t);
      windGain.gain.linearRampToValueAtTime(level, t + seconds);
    },

    tick(pan) {
      if (!ctx || !master) return;
      // A dry, woody event: a 60 ms burst of band-passed noise. Quiet on
      // purpose — the point is that it is *somewhere*, not that it is loud.
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 0.08);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800;
      bp.Q.value = 6;
      const env = ctx.createGain();
      const t = ctx.currentTime;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.22, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan * 0.9;
      src.connect(bp).connect(env).connect(panner).connect(master);
      src.start(t);
      src.stop(t + 0.1);
    },

    thump() {
      if (!ctx || !master) return;
      // 48 Hz sine with a fast decay: felt in headphones more than heard.
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const t = ctx.currentTime;
      osc.frequency.setValueAtTime(52, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.25);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.7, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(env).connect(master);
      osc.start(t);
      osc.stop(t + 0.45);
    },

    close() {
      void ctx?.close();
      ctx = null;
    },
  };
}

/** One physical pulse, only where the platform actually has one. Never faked. */
export function pulse(): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return false;
  }
  try {
    return navigator.vibrate([220]);
  } catch {
    return false;
  }
}
