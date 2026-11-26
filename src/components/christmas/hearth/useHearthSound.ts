"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * **The fire, if you'd like to hear it** (M1127). Off until the visitor asks,
 * every time — never remembered, never started by anything but their tap.
 *
 * Synthesised, like the original Christmas experiment's ambience
 * (`about/experiment-05-christmas/useFireplaceSound.ts`), so there is no
 * recording to license or download: a low brown-noise breath for the draught
 * in the chimney, and crackles — short bursts of noise through a band-pass,
 * at irregular moments, the odd one a proper pop. It fades in and out rather
 * than switching.
 */
export function useHearthSound() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const ctx = ctxRef.current;
    const master = masterRef.current;
    ctxRef.current = null;
    masterRef.current = null;
    setOn(false);
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    window.setTimeout(() => void ctx.close(), 600);
  }, []);

  const start = useCallback(() => {
    if (ctxRef.current) return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5);

    // The draught: brown noise, low and soft.
    const breath = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = breath.getChannelData(0);
    let level = 0;
    for (let i = 0; i < data.length; i++) {
      level = (level + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = level * 3.5;
    }
    const draught = ctx.createBufferSource();
    draught.buffer = breath;
    draught.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 520;
    const soft = ctx.createGain();
    soft.gain.value = 0.22;
    draught.connect(low).connect(soft).connect(master);
    draught.start();

    // One short burst of noise, reused for every crackle.
    const burst = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const b = burst.getChannelData(0);
    for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1;

    const crackle = () => {
      if (ctxRef.current !== ctx) return;
      const now = ctx.currentTime;
      const pop = Math.random() < 0.07;
      const src = ctx.createBufferSource();
      src.buffer = burst;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = pop
        ? 700 + Math.random() * 900
        : 1500 + Math.random() * 3800;
      band.Q.value = 0.8 + Math.random() * 2.5;
      const env = ctx.createGain();
      const peak = pop ? 0.5 : 0.04 + Math.random() * 0.16;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.002);
      env.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (pop ? 0.09 : 0.012 + Math.random() * 0.04),
      );
      src.connect(band).connect(env).connect(master);
      src.start(now);
      src.stop(now + 0.1);
      // Crackles come in little clusters, with quiet between.
      const wait =
        Math.random() < 0.3
          ? 25 + Math.random() * 60
          : -Math.log(1 - Math.random()) * 260;
      timerRef.current = window.setTimeout(crackle, wait);
    };
    timerRef.current = window.setTimeout(crackle, 300);

    ctxRef.current = ctx;
    masterRef.current = master;
    setOn(true);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      void ctxRef.current?.close();
    },
    [],
  );

  const toggle = useCallback(() => {
    if (ctxRef.current) stop();
    else start();
  }, [start, stop]);

  return { on, toggle };
}
