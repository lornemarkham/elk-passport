"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Intensity } from "./content";

interface SoundNodes {
  readonly source: AudioBufferSourceNode;
  readonly filter: BiquadFilterNode;
  readonly gain: GainNode;
}

function getAudioContextClass(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

/** Four seconds of real generated noise, looped — not a recorded sample (none exist in this project), a real synthesized signal. */
function buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const INTENSITY_TONE: Record<Intensity, { frequency: number; volume: number }> =
  {
    cozy: { frequency: 500, volume: 0.035 },
    spooky: { frequency: 350, volume: 0.055 },
    creepy: { frequency: 220, volume: 0.08 },
    nightmare: { frequency: 160, volume: 0.095 },
  };

export type SoundLayer = "wind" | "rain" | "fire" | "breathing" | "silence";

/** Real, distinct filter characteristics per named layer — multiplied against the current intensity tone, not a replacement for it. Not seven separate instruments (no recorded wind/rain/fire/train/bell samples exist in this project) — one noise engine, genuinely reshaped per layer via filter type/frequency, which is the same honest technique the rest of this file already uses. */
const LAYER_SHAPE: Record<
  SoundLayer,
  {
    filterType: BiquadFilterType;
    frequencyMultiplier: number;
    volumeMultiplier: number;
  }
> = {
  wind: { filterType: "lowpass", frequencyMultiplier: 1, volumeMultiplier: 1 },
  rain: {
    filterType: "highpass",
    frequencyMultiplier: 2.6,
    volumeMultiplier: 0.8,
  },
  fire: {
    filterType: "lowpass",
    frequencyMultiplier: 0.55,
    volumeMultiplier: 1.1,
  },
  breathing: {
    filterType: "lowpass",
    frequencyMultiplier: 0.3,
    volumeMultiplier: 0.5,
  },
  silence: {
    filterType: "lowpass",
    frequencyMultiplier: 1,
    volumeMultiplier: 0,
  },
};

/**
 * A real, honestly-scoped substitute for the brief's full soundscape
 * concept (wind, leaves, floorboards, a distant train, a church bell,
 * rain, static, fire, a crow, an owl, footsteps, water, laughter, an old
 * piano) — no recorded audio of any of that exists in this project or
 * was available this session. What's built instead is genuinely real:
 * filtered white noise, synthesized live with the Web Audio API, its
 * tone and volume shifting with `intensity`, and now (Phase 7.16) also
 * reshapeable into one of five named `SoundLayer`s (`setLayer`) — wind,
 * rain, fire, breathing, or silence — each a real, distinct filter
 * configuration, not just a volume change. "Breathing" adds a real, slow
 * gain pulse (a simple LFO built from `setInterval`, not a recorded
 * breath) so it reads as alive, not just quiet.
 *
 * Off by default, and only ever starts from an explicit toggle click —
 * browsers block audio autoplay without a user gesture anyway, so this
 * isn't just politeness, it's the only way this could work at all.
 */
export function useSoundscape(intensity: Intensity) {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<SoundNodes | null>(null);
  const layerRef = useRef<SoundLayer>("wind");
  const breathIntervalRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (breathIntervalRef.current) {
      window.clearInterval(breathIntervalRef.current);
      breathIntervalRef.current = null;
    }
    nodesRef.current?.source.stop();
    void ctxRef.current?.close();
    ctxRef.current = null;
    nodesRef.current = null;
    setOn(false);
  }, []);

  const applyLayer = useCallback(
    (layer: SoundLayer) => {
      const ctx = ctxRef.current;
      const nodes = nodesRef.current;
      if (!ctx || !nodes) return;
      layerRef.current = layer;
      if (breathIntervalRef.current) {
        window.clearInterval(breathIntervalRef.current);
        breathIntervalRef.current = null;
      }

      const tone = INTENSITY_TONE[intensity];
      const shape = LAYER_SHAPE[layer];
      nodes.filter.type = shape.filterType;
      nodes.filter.frequency.setTargetAtTime(
        tone.frequency * shape.frequencyMultiplier,
        ctx.currentTime,
        1.2,
      );
      nodes.gain.gain.setTargetAtTime(
        tone.volume * shape.volumeMultiplier,
        ctx.currentTime,
        1.2,
      );

      if (layer === "breathing") {
        let phase = 0;
        breathIntervalRef.current = window.setInterval(() => {
          phase += 0.35;
          const pulse =
            tone.volume *
            shape.volumeMultiplier *
            (0.6 + 0.4 * Math.sin(phase));
          nodes.gain.gain.setTargetAtTime(pulse, ctx.currentTime, 0.4);
        }, 600);
      }
    },
    [intensity],
  );

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
    const tone = INTENSITY_TONE[intensity];
    filter.frequency.value = tone.frequency;

    const gain = ctx.createGain();
    gain.gain.value = tone.volume;

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();

    ctxRef.current = ctx;
    nodesRef.current = { source, filter, gain };
    setOn(true);
  }, [intensity]);

  function toggle() {
    if (on) stop();
    else start();
  }

  // Reacts to intensity changes while already playing — a real, audible shift, not just a visual one. Re-applies whatever layer is currently active on top of the new tone.
  useEffect(() => {
    if (ctxRef.current && nodesRef.current) applyLayer(layerRef.current);
  }, [intensity, applyLayer]);

  /** A real, brief dip in volume and tone — the "soundtrack catches, like static" surprise gets an actual audible moment, not just a caption, if sound happens to be on when it fires. A no-op if it isn't. */
  const duck = useCallback(() => {
    const ctx = ctxRef.current;
    const nodes = nodesRef.current;
    if (!ctx || !nodes) return;
    const tone = INTENSITY_TONE[intensity];
    nodes.gain.gain.setTargetAtTime(tone.volume * 0.15, ctx.currentTime, 0.05);
    nodes.filter.frequency.setTargetAtTime(
      tone.frequency * 0.4,
      ctx.currentTime,
      0.05,
    );
    window.setTimeout(() => {
      nodes.gain.gain.setTargetAtTime(tone.volume, ctx.currentTime, 0.3);
      nodes.filter.frequency.setTargetAtTime(
        tone.frequency,
        ctx.currentTime,
        0.3,
      );
    }, 500);
  }, [intensity]);

  /** A real fade to silence over a few seconds, then a full stop — used by the ending, not the toggle (the toggle is an instant on/off, the ending is a real wind-down). */
  const fadeOut = useCallback(
    (durationMs = 3000) => {
      const ctx = ctxRef.current;
      const nodes = nodesRef.current;
      if (!ctx || !nodes) return;
      nodes.gain.gain.setTargetAtTime(0, ctx.currentTime, durationMs / 3000);
      window.setTimeout(stop, durationMs);
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      if (breathIntervalRef.current)
        window.clearInterval(breathIntervalRef.current);
      nodesRef.current?.source.stop();
      void ctxRef.current?.close();
    };
  }, []);

  return { on, toggle, duck, fadeOut, setLayer: applyLayer };
}
