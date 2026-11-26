/**
 * **A fire that is drawn, not filmed** (M1127).
 *
 * Soft light rising from a bed of embers: a few hundred glowing particles
 * blended additively, white-gold at the root, orange, then a deep ember red
 * as they rise and fade, with the odd spark. It weighs nothing on the wire —
 * no video to fetch on a phone opened from a business card — and it is our
 * own, so there is no licence to keep.
 *
 * It sleeps when it is off screen or the tab is hidden, and with `still` it
 * lets the fire settle for a moment and then holds that one frame (reduced
 * motion, or the visitor's own pause). `onGlow` hears how bright the fire is,
 * a dozen times a second, so the room's light can breathe with it.
 */

/** White-gold to ember: the colours a flame passes through as it rises. */
const STAGES: readonly (readonly [number, number, number])[] = [
  [255, 246, 220],
  [255, 208, 112],
  [255, 150, 52],
  [232, 88, 26],
  [140, 38, 14],
];

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
  spark: boolean;
};

export type Fire = {
  /** Hold the current frame (true) or let it burn again (false). */
  readonly setStill: (still: boolean) => void;
  readonly stop: () => void;
};

/** A soft round glow in one colour, drawn once and stamped many times. */
function sprite([r, g, b]: readonly [number, number, number]) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  return c;
}

/** Slow, smooth wandering in [-1, 1]: sums of sines at unrelated rates. */
function wander(t: number, seed: number) {
  return (
    0.55 * Math.sin(t * 1.7 + seed) +
    0.3 * Math.sin(t * 3.1 + seed * 2.3) +
    0.15 * Math.sin(t * 7.3 + seed * 0.7)
  );
}

export function lightFire(
  canvas: HTMLCanvasElement,
  {
    still: startStill,
    onGlow,
  }: { still: boolean; onGlow?: (glow: number) => void },
): Fire {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setStill: () => {}, stop: () => {} };
  const sprites = STAGES.map(sprite);
  const motes: Mote[] = [];
  let w = 0;
  let h = 0;
  let still = startStill;
  let visible = true;
  let frame = 0;
  let last = 0;
  let clock = Math.random() * 100;
  let owed = 0;
  let glowAt = 0;

  function size() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(spark: boolean) {
    // More flame at the heart of the bed than at its ends.
    const spread = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const x = w / 2 + spread * w * 0.34;
    motes.push({
      x,
      y: h * (0.86 + Math.random() * 0.06),
      vx: 0,
      vy: spark
        ? -h * (0.55 + Math.random() * 0.5)
        : -h * (0.22 + Math.random() * 0.22),
      age: 0,
      life: spark
        ? 1.4 + Math.random() * 1.2
        : (0.55 + Math.random() * 0.6) * (1 - Math.abs(spread) * 0.45),
      size: spark
        ? 1 + Math.random() * 1.2
        : w * (0.045 + Math.random() * 0.05),
      seed: Math.random() * 1000,
      spark,
    });
  }

  function step(dt: number) {
    clock += dt;
    // The fire's breath: how hard it is burning just now.
    const breath = 0.82 + 0.18 * wander(clock * 0.9, 3.7);
    owed += dt * (w * 1.1) * breath;
    while (owed >= 1) {
      spawn(false);
      owed -= 1;
    }
    if (Math.random() < dt * 5) spawn(true);
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.age += dt;
      if (m.age >= m.life || m.y < -10) {
        motes.splice(i, 1);
        continue;
      }
      const sway = wander(clock * 2.2 + m.seed, m.seed);
      if (m.spark) {
        m.vx += sway * w * 0.6 * dt;
      } else {
        // Flames lean into tongues: pulled to the middle, pushed by the draught.
        m.vx += ((w / 2 - m.x) * 1.1 + sway * w * 0.55) * dt;
        m.vy -= h * 0.5 * dt * breath;
      }
      m.vx *= 1 - 1.8 * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    return breath;
  }

  function draw(breath: number) {
    ctx!.globalCompositeOperation = "source-over";
    ctx!.clearRect(0, 0, w, h);
    ctx!.globalCompositeOperation = "lighter";
    // The bed of embers, glowing under everything.
    ctx!.globalAlpha = 0.4 * breath;
    ctx!.drawImage(sprites[3], w * 0.08, h * 0.74, w * 0.84, h * 0.32);
    ctx!.globalAlpha = 0.3 * breath;
    ctx!.drawImage(sprites[2], w * 0.25, h * 0.8, w * 0.5, h * 0.18);
    for (const m of motes) {
      const t = m.age / m.life;
      if (m.spark) {
        const flick = 0.5 + 0.5 * Math.sin(m.age * 40 + m.seed);
        ctx!.globalAlpha = (1 - t) * (0.5 + 0.5 * flick);
        const s = m.size * 3;
        ctx!.drawImage(sprites[1], m.x - s, m.y - s, s * 2, s * 2);
        continue;
      }
      // White only at the root; orange, then ember red, as it climbs.
      const stage =
        t < 0.07 ? 0 : Math.min(STAGES.length - 1, 1 + Math.floor(t * 4.4));
      const s = m.size * (1 - t) ** 0.6 + 0.5;
      ctx!.globalAlpha = 0.34 * (1 - t) ** 1.1;
      // A flame is taller than it is wide, and narrows as it rises.
      ctx!.drawImage(
        sprites[stage],
        m.x - s * 0.8,
        m.y - s * 2,
        s * 1.6,
        s * 4,
      );
    }
    ctx!.globalAlpha = 1;
  }

  function tick(now: number) {
    frame = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    const breath = step(dt);
    draw(breath);
    if (onGlow && now - glowAt > 80) {
      glowAt = now;
      onGlow(breath);
    }
    schedule();
  }

  function schedule() {
    if (!frame && !still && visible && !document.hidden)
      frame = requestAnimationFrame(tick);
  }

  /** Burn for a moment out of sight, then hold one settled frame. */
  function settle() {
    for (let i = 0; i < 90; i++) step(1 / 60);
    draw(1);
    onGlow?.(1);
  }

  size();
  if (still) settle();
  else schedule();

  const resized = new ResizeObserver(() => {
    size();
    if (still) settle();
  });
  resized.observe(canvas);
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = 0;
    schedule();
  });
  seen.observe(canvas);
  const shown = () => {
    last = 0;
    schedule();
  };
  document.addEventListener("visibilitychange", shown);

  return {
    setStill(next) {
      still = next;
      if (still) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
      } else {
        last = 0;
        schedule();
      }
    },
    stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      still = true;
      resized.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", shown);
    },
  };
}
