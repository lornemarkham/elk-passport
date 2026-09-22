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
  /** A latch turning, then wood taking weight. Behind and to the right. */
  latch: () => void;
  /**
   * One heavy door, in the room. Startling by contrast, not by level: the
   * wind is ducked first so the slam has headroom to be loud *relatively*,
   * and its peak is capped well under the master's ceiling. No clipping, no
   * hearing-damage volume — the shock is composition and expectation.
   */
  slam: () => void;
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

    latch() {
      if (!ctx || !master) return;
      const t = ctx.currentTime;
      // A metal click: very short, bright, quiet. Then wood: a low creak from
      // a slowly sweeping bandpass over noise, 400 ms, settling.
      const click = ctx.createBufferSource();
      click.buffer = noiseBuffer(ctx, 0.03);
      const clickBp = ctx.createBiquadFilter();
      clickBp.type = "bandpass";
      clickBp.frequency.value = 3200;
      clickBp.Q.value = 9;
      const clickEnv = ctx.createGain();
      clickEnv.gain.setValueAtTime(0, t);
      clickEnv.gain.linearRampToValueAtTime(0.16, t + 0.003);
      clickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      const wood = ctx.createBufferSource();
      wood.buffer = noiseBuffer(ctx, 0.5);
      const woodBp = ctx.createBiquadFilter();
      woodBp.type = "bandpass";
      woodBp.frequency.setValueAtTime(420, t + 0.08);
      woodBp.frequency.exponentialRampToValueAtTime(260, t + 0.48);
      woodBp.Q.value = 14;
      const woodEnv = ctx.createGain();
      woodEnv.gain.setValueAtTime(0, t + 0.08);
      woodEnv.gain.linearRampToValueAtTime(0.11, t + 0.16);
      woodEnv.gain.linearRampToValueAtTime(0.07, t + 0.36);
      woodEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      const panner = ctx.createStereoPanner();
      panner.pan.value = 0.6;
      click.connect(clickBp).connect(clickEnv).connect(panner);
      wood.connect(woodBp).connect(woodEnv).connect(panner);
      panner.connect(master);
      click.start(t);
      wood.start(t + 0.08);
      click.stop(t + 0.06);
      wood.stop(t + 0.52);
    },

    slam() {
      if (!ctx || !master || !windGain) return;
      const t = ctx.currentTime;

      // Duck the bed hard and fast so the room goes quiet just before.
      windGain.gain.cancelScheduledValues(t);
      windGain.gain.setValueAtTime(windGain.gain.value, t);
      windGain.gain.linearRampToValueAtTime(0.0, t + 0.12);

      // Body: a sine dropping from 90 Hz to 34 Hz — the door's mass.
      const body = ctx.createOscillator();
      body.type = "sine";
      body.frequency.setValueAtTime(92, t);
      body.frequency.exponentialRampToValueAtTime(34, t + 0.32);
      const bodyEnv = ctx.createGain();
      bodyEnv.gain.setValueAtTime(0, t);
      bodyEnv.gain.linearRampToValueAtTime(0.55, t + 0.008);
      bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      // Impact: broadband noise through two wooden resonances, very short.
      const hit = ctx.createBufferSource();
      hit.buffer = noiseBuffer(ctx, 0.25);
      const res1 = ctx.createBiquadFilter();
      res1.type = "bandpass";
      res1.frequency.value = 180;
      res1.Q.value = 3;
      const res2 = ctx.createBiquadFilter();
      res2.type = "bandpass";
      res2.frequency.value = 640;
      res2.Q.value = 5;
      const hitEnv = ctx.createGain();
      hitEnv.gain.setValueAtTime(0, t);
      hitEnv.gain.linearRampToValueAtTime(0.5, t + 0.004);
      hitEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      // The room: a short feedback delay so the slam has walls to hit.
      const delay = ctx.createDelay(0.4);
      delay.delayTime.value = 0.085;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const tail = ctx.createBiquadFilter();
      tail.type = "lowpass";
      tail.frequency.value = 900;
      delay.connect(feedback).connect(tail).connect(delay);
      const tailOut = ctx.createGain();
      tailOut.gain.value = 0.35;

      // Behind and to the right — the same wall the latch was on.
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0.45;

      // Hard ceiling on the whole event. The master is 0.9; this stays below
      // it so the sum cannot clip even with the tail.
      const ceiling = ctx.createGain();
      ceiling.gain.value = 0.8;

      body.connect(bodyEnv).connect(panner);
      hit.connect(res1).connect(hitEnv).connect(panner);
      hit.connect(res2).connect(hitEnv);
      panner.connect(ceiling);
      panner.connect(delay);
      delay.connect(tailOut).connect(ceiling);
      ceiling.connect(master);

      body.start(t);
      hit.start(t);
      body.stop(t + 0.65);
      hit.stop(t + 0.3);
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
