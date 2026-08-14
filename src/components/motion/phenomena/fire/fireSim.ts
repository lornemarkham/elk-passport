import { NoiseField } from "../../primitives/noise";

export interface FireSimOptions {
  /** Grid resolution — deliberately tiny (see Fire.tsx). This is what
   * keeps the simulation cheap enough to run several instances at once;
   * the organic look comes from upscaling + blur, not from resolution. */
  width: number;
  height: number;
  seed: number;
}

/**
 * The flame's actual physics: a classic per-cell "heat propagates upward
 * and decays" simulation (the technique behind most cheap procedural fire
 * effects going back to demoscene-era ASCII fire), with one deliberate
 * change — every place the classic version reaches for `Math.random()`
 * per cell per frame, this reaches for a continuously-varying noise field
 * instead. Per-cell independent randomness is exactly what reads as
 * "pixel jitter" once scaled up; sampling a noise field that varies
 * smoothly across neighboring cells and across time is what makes
 * neighboring flame cells agree with each other frame to frame, which is
 * the actual definition of "continuous" motion rather than "flickering."
 *
 * Framework-free and stateful by design (mutates its own `heat` buffer in
 * place) — this is meant to be driven from a `requestAnimationFrame` tick,
 * not React state.
 */
export class FireSim {
  readonly width: number;
  readonly height: number;
  private heat: Float32Array;
  private readonly noise: NoiseField;

  constructor({ width, height, seed }: FireSimOptions) {
    this.width = width;
    this.height = height;
    this.heat = new Float32Array(width * height);
    this.noise = new NoiseField(seed);
  }

  /**
   * Advances the simulation by one frame.
   * @param elapsedSeconds total time since this instance started — the
   *   noise field's time axis, so successive frames sample nearby (but
   *   never identical) points.
   * @param intensity 0–1 — how hot the base is right now. This is the one
   *   knob hover/attention needs: turning the fire "up" is turning this
   *   up, not a separate animation.
   */
  step(elapsedSeconds: number, intensity: number): void {
    const { width, height, heat, noise } = this;

    // Base row: heat injection, spatially coherent across neighboring
    // columns via noise rather than each column rolling independently.
    for (let x = 0; x < width; x++) {
      const n = noise.get01(x * 0.35, 0, elapsedSeconds * 1.6);
      const base = 0.5 + n * 0.4 + intensity * 0.35;
      heat[(height - 1) * width + x] = Math.min(1, base);
    }

    // Propagate upward: each cell inherits (a decayed, slightly
    // horizontally-drifted) heat from the cell below it. The drift and
    // decay amounts are themselves noise samples, not per-cell dice
    // rolls, so a flame's "lean" this frame agrees with its lean last
    // frame instead of teleporting between unrelated random offsets.
    for (let y = 0; y < height - 1; y++) {
      const below = y + 1;
      for (let x = 0; x < width; x++) {
        const drift = noise.get01(
          x * 0.5,
          below * 0.5,
          elapsedSeconds * 2.2 + 100,
        );
        const offsetX = Math.max(
          0,
          Math.min(width - 1, x + Math.round((drift - 0.5) * 2)),
        );
        const decayNoise = noise.get01(
          x * 0.7,
          below * 0.7,
          elapsedSeconds * 1.1 + 200,
        );
        const decay = 0.035 + decayNoise * 0.05 + (1 - intensity) * 0.02;
        const sourceHeat = heat[below * width + offsetX];
        heat[y * width + x] = Math.max(0, sourceHeat - decay);
      }
    }
  }

  get(x: number, y: number): number {
    return this.heat[y * this.width + x] ?? 0;
  }
}
