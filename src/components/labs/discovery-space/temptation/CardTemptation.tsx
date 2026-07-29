"use client";

import type { TemptationKind } from "../types";
import {
  EmberTemptation,
  GlintTemptation,
  RippleTemptation,
  ShootingStarTemptation,
  SteamTemptation,
  WindowGlowTemptation,
} from "./effects";

interface CardTemptationProps {
  /** Which temptation this card supports, if any — undefined renders nothing. */
  kind?: TemptationKind;
  /** Whether this card is the one currently running its event. */
  active: boolean;
  /** Changes every event so the effect always restarts cleanly. */
  instanceId?: number;
  durationMs?: number;
}

/**
 * Purely presentational: renders nothing when inactive, otherwise mounts
 * the effect matching `kind` for exactly one instance. Owns no timers and
 * makes no eligibility decisions — that's `usePeripheralTemptation`'s job.
 *
 * Deliberately a plain conditional mount rather than `AnimatePresence` +
 * `exit`: every effect's own keyframe timeline already fades back to
 * opacity 0 by the time `durationMs` elapses (the exact moment the
 * scheduler flips this card inactive), so there's no exit transition to
 * wait for — and AnimatePresence tracking multiple sibling motion nodes
 * per instance (ember, steam) proved unreliable, leaving stale nodes
 * stuck at opacity 0 instead of unmounting.
 */
export function CardTemptation({
  kind,
  active,
  instanceId,
  durationMs,
}: CardTemptationProps) {
  if (!kind) return null;

  const showing =
    active && instanceId !== undefined && durationMs !== undefined;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      {showing && (
        <EffectByKind
          key={instanceId}
          kind={kind}
          durationMs={durationMs as number}
        />
      )}
    </div>
  );
}

function EffectByKind({
  kind,
  durationMs,
}: {
  kind: TemptationKind;
  durationMs: number;
}) {
  switch (kind) {
    case "ember":
      return <EmberTemptation durationMs={durationMs} />;
    case "shooting-star":
      return <ShootingStarTemptation durationMs={durationMs} />;
    case "window-glow":
      return <WindowGlowTemptation durationMs={durationMs} />;
    case "ripple":
      return <RippleTemptation durationMs={durationMs} />;
    case "steam":
      return <SteamTemptation durationMs={durationMs} />;
    case "glint":
      return <GlintTemptation durationMs={durationMs} />;
    default:
      return null;
  }
}
