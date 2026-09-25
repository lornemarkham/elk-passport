"use client";

import { useEffect, useRef } from "react";
import { SURVIVE_MS } from "./script";

/**
 * **Keep it alight.** Thirty seconds, one candle, and a room that wants it out.
 *
 * ## Why this game and not a shooting gallery
 *
 * One degree of freedom: the pointer's *angle* around the flame, nothing else.
 * You are cupping a hand around a candle and turning it to meet whatever is
 * coming. That does three useful things at once — it is instantly legible with
 * no instructions, it plays identically with a mouse and a thumb (on a phone
 * you keep your finger out at the edge, so it never covers the flame), and it
 * makes the light in the room *be* the health bar. As the flame takes hits it
 * shrinks, and the room goes dark around you. Nothing has to be explained.
 *
 * ## Fairness
 *
 * Every draught is visible from the moment it exists and travels inward along
 * a straight line, so the telegraph and the attack are the same object. The
 * ramp shortens that flight from 950ms to 560ms and tightens the gaps, and
 * after fourteen seconds they start arriving in pairs far enough apart that
 * you have to actually swing. Nothing is random that you cannot see coming.
 *
 * Three hits and it is out. Losing costs a couple of seconds and a dry remark.
 */

const LIVES = 3;
/** How much of the circle the cupped hand covers: ±0.58 rad, about 66°. */
const SHIELD_HALF = 0.58;
const FIRST_GUST = 2200;

/** Everything about a draught, from the moment it becomes visible. */
interface Gust {
  angle: number;
  /** Timestamps in elapsed-ms. */
  born: number;
  arrives: number;
  done: boolean;
  /** Set on arrival so the puff can be drawn for a moment afterwards. */
  blocked?: boolean;
}

const TAU = Math.PI * 2;

/** Smallest absolute angle between two headings. */
function delta(a: number, b: number): number {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
}

export function CandleGame({
  reduced,
  onWin,
  onLose,
}: {
  readonly reduced: boolean;
  readonly onWin: () => void;
  readonly onLose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aim = useRef(-Math.PI / 2);
  const done = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let unit = 0;

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h * 0.55;
      unit = Math.min(w, h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    // Angle only. Where the pointer is does not matter; which way it lies from
    // the flame is the whole input.
    const point = (e: PointerEvent) => {
      aim.current = Math.atan2(e.clientY - cy, e.clientX - cx);
    };
    window.addEventListener("pointermove", point, { passive: true });
    window.addEventListener("pointerdown", point, { passive: true });

    const gusts: Gust[] = [];
    let lives = LIVES;
    /** Momentary crouch of the flame, 0..1, after a block or a hit. */
    let duck = 0;
    let nextAt = FIRST_GUST;
    let start = 0;
    let raf = 0;

    const schedule = (t: number) => {
      const ramp = Math.min(t / SURVIVE_MS, 1);
      const flight = 950 - 390 * ramp;
      const gap = 1500 - 860 * ramp;

      const a = Math.random() * TAU;
      gusts.push({ angle: a, born: t, arrives: t + flight, done: false });

      // Past the halfway mark they come in pairs, far enough apart that one
      // hand cannot cover both — you have to choose one and swing for the
      // other.
      if (t > 14_000 && Math.random() < 0.42) {
        const away = a + (Math.random() < 0.5 ? -1 : 1) * (1.7 + Math.random());
        gusts.push({
          angle: away,
          born: t + 360,
          arrives: t + flight + 360,
          done: false,
        });
      }
      nextAt = t + gap;
    };

    const frame = (now: number) => {
      if (done.current) return;
      if (!start) start = now;
      const t = now - start;
      const life = lives / LIVES;

      if (t >= nextAt) schedule(t);

      for (const g of gusts) {
        if (g.done || t < g.arrives) continue;
        g.done = true;
        g.blocked = delta(g.angle, aim.current) < SHIELD_HALF;
        duck = g.blocked ? 0.35 : 1;
        if (!g.blocked) lives -= 1;
      }

      if (lives <= 0) {
        done.current = true;
        onLose();
        return;
      }
      if (t >= SURVIVE_MS) {
        done.current = true;
        onWin();
        return;
      }

      duck = Math.max(0, duck - 0.028);

      // ------------------------------------------------------------- draw
      ctx.clearRect(0, 0, w, h);

      const flicker = reduced ? 0 : Math.sin(t / 90) * 0.5 + Math.sin(t / 37);
      const strength = life * (1 - duck * 0.62) * (1 + flicker * 0.03);

      // The light the candle throws. This is the health bar: as the flame is
      // knocked down, the room genuinely goes dark.
      const pool = unit * (0.2 + 0.36 * life) * (1 - duck * 0.4);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, pool);
      glow.addColorStop(0, `rgba(255,186,96,${0.3 * strength + 0.06})`);
      glow.addColorStop(0.45, `rgba(214,128,44,${0.12 * strength})`);
      glow.addColorStop(1, "rgba(120,60,16,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      // How much time is left, as a hairline that closes around the flame.
      const ring = unit * 0.3;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        ring,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * (t / SURVIVE_MS),
      );
      ctx.strokeStyle = "rgba(233,230,218,0.16)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draughts, travelling in.
      for (const g of gusts) {
        if (g.done) continue;
        const p = (t - g.born) / (g.arrives - g.born);
        const from = unit * 0.4;
        const to = unit * 0.17;
        const r = from + (to - from) * p;
        const dx = Math.cos(g.angle);
        const dy = Math.sin(g.angle);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 3; i++) {
          const back = r + i * unit * 0.045;
          ctx.beginPath();
          ctx.moveTo(cx + dx * back, cy + dy * back);
          ctx.lineTo(
            cx + dx * (back + unit * 0.035),
            cy + dy * (back + unit * 0.035),
          );
          ctx.strokeStyle = `rgba(196,216,236,${(0.34 - i * 0.1) * (0.3 + p * 0.7)})`;
          ctx.lineWidth = 2 - i * 0.5;
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // The cupped hand: three arcs stacked so the ends taper instead of
      // stopping, which is the difference between a hand and a pie chart.
      const sr = unit * 0.16;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const half = SHIELD_HALF * (1 - i * 0.22);
        ctx.beginPath();
        ctx.arc(cx, cy, sr + i * 1.5, aim.current - half, aim.current + half);
        ctx.strokeStyle = `rgba(255,203,132,${0.26 - i * 0.06})`;
        ctx.lineWidth = unit * (0.028 - i * 0.006);
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      // The candle.
      const cw = unit * 0.026;
      const ch = unit * 0.075;
      ctx.fillStyle = "rgba(238,228,206,0.92)";
      ctx.fillRect(cx - cw / 2, cy + ch * 0.18, cw, ch);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(cx - cw / 2, cy + ch * 0.18, cw * 0.32, ch);

      // The flame. It leans away from whatever just hit it.
      const fh = unit * 0.05 * (0.42 + 0.58 * life) * (1 - duck * 0.6);
      const lean = duck * 0.4 * Math.cos(aim.current + Math.PI);
      const fy = cy + ch * 0.18 - fh * 0.35;
      const fx = cx + lean * fh;
      const fl = ctx.createRadialGradient(fx, fy, 0, fx, fy, fh * 1.7);
      fl.addColorStop(0, `rgba(255,252,238,${0.95 * (1 - duck * 0.4)})`);
      fl.addColorStop(0.35, `rgba(255,198,104,${0.8 * (1 - duck * 0.4)})`);
      fl.addColorStop(1, "rgba(214,110,20,0)");
      ctx.fillStyle = fl;
      ctx.beginPath();
      ctx.ellipse(fx, fy, fh * 0.85, fh * 1.6, lean * 0.5, 0, TAU);
      ctx.fill();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", point);
      window.removeEventListener("pointerdown", point);
    };
  }, [reduced, onWin, onLose]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="Keep the candle alight for thirty seconds."
    />
  );
}
