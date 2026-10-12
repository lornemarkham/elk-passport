"use client";

import { UNDERNEATH } from "./encounter";

/**
 * **One recording, from nothing, and back to nothing.**
 *
 * An `<audio>` element feeding a gain node, because the fade is the whole
 * idea and iOS ignores `HTMLMediaElement.volume` — a fade written against the
 * element would arrive on an iPhone at full level, which is exactly the
 * impact this is built to avoid. The gain starts at zero and is only ever
 * ramped.
 *
 * `prepare` fetches the file (no sound, no context). `rise` must be called
 * from inside the tap that asked for it, or the browser will refuse to play.
 * Where there is no Web Audio at all, nothing plays: silence is a safe
 * failure here, a sudden full-level recording is not.
 */
export interface Underneath {
  prepare: () => void;
  rise: () => void;
  fall: () => void;
  close: () => void;
  readonly sounding: boolean;
}

export function createUnderneath(): Underneath {
  let el: HTMLAudioElement | null = null;
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let sounding = false;

  const Ctx = (): typeof AudioContext | undefined =>
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext);

  const prepare = () => {
    if (el || !Ctx()) return;
    el = new Audio();
    el.preload = "auto";
    el.loop = true;
    el.src = `/sounds/${encodeURIComponent(UNDERNEATH.file)}`;
  };

  return {
    get sounding() {
      return sounding;
    },

    prepare,

    rise() {
      const C = Ctx();
      if (!C) return;
      prepare();
      if (!el) return;
      try {
        if (!ctx) {
          ctx = new C();
          gain = ctx.createGain();
          gain.gain.value = 0;
          ctx
            .createMediaElementSource(el)
            .connect(gain)
            .connect(ctx.destination);
        }
        void ctx.resume();
        const t = ctx.currentTime;
        gain!.gain.cancelScheduledValues(t);
        gain!.gain.setValueAtTime(0, t);
        gain!.gain.linearRampToValueAtTime(
          UNDERNEATH.level,
          t + UNDERNEATH.rise,
        );
        sounding = true;
        void el.play().catch(() => {
          sounding = false;
        });
      } catch {
        sounding = false;
      }
    },

    fall() {
      if (!ctx || !gain || !el || !sounding) return;
      sounding = false;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + UNDERNEATH.fall);
      const audio = el;
      setTimeout(() => audio.pause(), UNDERNEATH.fall * 1000 + 100);
    },

    close() {
      sounding = false;
      el?.pause();
      if (el) el.src = "";
      void ctx?.close();
      el = null;
      ctx = null;
      gain = null;
    },
  };
}
