"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function getAudioContextClass(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

/** Four seconds of real generated noise, looped — the same honest technique as every other synthesized ambience in this project (`october-passport/useSoundscape.ts`), not a recorded sample. */
function buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * A single, real, synthesized fireplace-and-wind ambience — filtered
 * white noise, honestly built with the Web Audio API. Ported from the
 * original standalone `christmas-passport.html` prototype's inline
 * implementation into a proper hook, same tone (420Hz lowpass, 0.05
 * gain), same off-by-default-until-a-real-click discipline every audio
 * feature in this app follows.
 */
export function useFireplaceSound() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    void ctxRef.current?.close();
    ctxRef.current = null;
    sourceRef.current = null;
    setOn(false);
  }, []);

  const start = useCallback(() => {
    if (ctxRef.current) return;
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const source = ctx.createBufferSource();
    source.buffer = buildNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;

    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();

    ctxRef.current = ctx;
    sourceRef.current = source;
    setOn(true);
  }, []);

  function toggle() {
    if (on) stop();
    else start();
  }

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      void ctxRef.current?.close();
    };
  }, []);

  return { on, toggle };
}
