"use client";

import { useEffect, useRef } from "react";
import { PLATE } from "./shelfGeometry";
import { playRunPast, soundReady } from "./sound";

/**
 * **A child standing a long way down the right aisle, and then not.**
 *
 * One appearance, in one place, for about a second. He does not move, he is
 * never closer, and he never comes back. He fades up to a peak of forty per
 * cent and back down to nothing — present enough to be seen, faint enough that
 * the honest first reaction is doubt rather than recognition.
 *
 * The whole of the scare is the join between what you saw and what you then
 * hear, so the two are one sequence rather than two timers that happen to
 * agree. The run is fired by the fade-out's own `transitionend` — the instant
 * the browser finishes taking him to zero, something runs past you on the
 * right and away behind your head. Six quick light steps on carpet, the only
 * loud thing here and the only thing you are certain of. You never see him
 * move. See `sound.ts`.
 *
 * The box is in the plate's own coordinates, with his feet on the aisle's
 * measured floor line, so he is standing on the floor rather than floating in
 * front of it.
 */

export type PresenceVariant = "ghost" | "child";

/** Faint, but actually there. The doubt is the effect, not invisibility. */
const PEAK_OPACITY = 0.4;
const FADE_IN_MS = 450;
const HOLD_MS = 150;
const FADE_OUT_MS = 400;
/** Development timing: near the front so it can be reviewed repeatedly. */
const FIRST_MS = 2500;

const VARIANTS: Record<
  PresenceVariant,
  {
    readonly src: string;
    readonly box: {
      readonly left: number;
      readonly top: number;
      readonly width: number;
      readonly height: number;
    };
    readonly filter: string;
  }
> = {
  child: {
    src: "/october/video-store/presence/child.webp",
    box: { left: 541, top: 245, width: 47, height: 74 },
    // Left near his own exposure on purpose: the opacity is already doing all
    // of the hiding, and pulling the brightness down as well took him below
    // the point where there was anything to doubt.
    filter: "brightness(0.85) saturate(0.5) blur(0.35px)",
  },
  // Kept so the comparison can be reopened; human review chose the child.
  ghost: {
    src: "/october/video-store/presence/figure.webp",
    box: { left: 535, top: 210, width: 59, height: 106 },
    filter: "brightness(0.8) saturate(0.3) blur(0.4px)",
  },
};

export function Presence({
  enabled,
  forced,
  onSeen,
}: {
  readonly enabled: boolean;
  /** `?presence=child` / `?presence=ghost`: deterministic, every refresh. */
  readonly forced: PresenceVariant | null;
  readonly onSeen?: () => void;
}) {
  const shot = useRef<HTMLImageElement>(null);
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  }, [onSeen]);

  const variant = forced ?? "child";

  useEffect(() => {
    if (!enabled && !forced) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let waiting: (() => void) | null = null;

    /**
     * The picture never waits for a click, so the run can come due before the
     * browser will permit a sound. Rather than lose the only thing that pays
     * this off, it is held until the first gesture.
     */
    const runPast = () => {
      if (soundReady()) {
        playRunPast();
        return;
      }
      const go = () => {
        waiting = null;
        timers.push(setTimeout(playRunPast, 90));
      };
      waiting = () => {
        window.removeEventListener("pointerdown", go);
        window.removeEventListener("keydown", go);
      };
      window.addEventListener("pointerdown", go, { once: true });
      window.addEventListener("keydown", go, { once: true });
    };

    const start = forced
      ? FIRST_MS
      : // Rare, and on no schedule a person could learn.
        70000 + Math.random() * 130000;

    /**
     * One sequence owns both the picture and the sound. The fade-out's
     * completion *is* the cue: nothing measures how long it should have taken.
     */
    let phase: "in" | "out" = "in";
    let fired = false;
    let unlisten: (() => void) | null = null;

    const finished = (e?: TransitionEvent) => {
      if (e && e.propertyName !== "opacity") return;
      if (phase !== "out" || fired) return;
      fired = true;
      unlisten?.();
      runPast();
    };

    timers.push(
      setTimeout(() => {
        const el = shot.current;
        // No asset, no apparition — and never a broken image where a person
        // is supposed to be standing.
        if (!el || !el.complete || el.naturalWidth === 0) return;

        el.addEventListener("transitionend", finished);
        unlisten = () => el.removeEventListener("transitionend", finished);

        el.style.transitionDuration = `${FADE_IN_MS}ms`;
        el.style.opacity = String(PEAK_OPACITY);
        seen.current?.();

        timers.push(
          setTimeout(() => {
            phase = "out";
            el.style.transitionDuration = `${FADE_OUT_MS}ms`;
            el.style.opacity = "0";
            // A backstop, not the schedule. If the fade-in never reached its
            // peak — a backgrounded tab, a suspended timeline — then setting
            // zero changes nothing, no transition is generated, and no
            // `transitionend` ever arrives; losing the run would cost the
            // whole beat. Sixty milliseconds past the nominal end, so even
            // this path still lands inside the window the cut needs.
            // Whichever arrives first wins; `fired` makes sure it is once.
            timers.push(setTimeout(() => finished(), FADE_OUT_MS + 60));
          }, FADE_IN_MS + HOLD_MS),
        );
      }, start),
    );

    return () => {
      timers.forEach(clearTimeout);
      unlisten?.();
      waiting?.();
    };
  }, [enabled, forced]);

  if (!enabled && !forced) return null;

  const v = VARIANTS[variant];
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={shot}
      src={v.src}
      alt=""
      aria-hidden
      draggable={false}
      data-presence="far"
      data-variant={variant}
      // Always laid out and always present at zero opacity, so the fade has
      // something to run on. It used to start at `display: none` and be
      // switched on by `onLoad`, which a cached image never fires — so the
      // figure was laid out at zero by zero and could not be seen at all.
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
      className="absolute"
      style={{
        opacity: 0,
        transitionProperty: "opacity",
        transitionTimingFunction: "linear",
        transitionDuration: `${FADE_IN_MS}ms`,
        pointerEvents: "none",
        // Under the room's exposure and the tubes' own wash, which sit at 3,
        // so a change in the light is a change to him too.
        zIndex: 2,
        left: `${(v.box.left / PLATE.width) * 100}%`,
        top: `${(v.box.top / PLATE.height) * 100}%`,
        width: `${(v.box.width / PLATE.width) * 100}%`,
        height: `${(v.box.height / PLATE.height) * 100}%`,
        objectFit: "fill",
        filter: v.filter,
      }}
    />
  );
}
