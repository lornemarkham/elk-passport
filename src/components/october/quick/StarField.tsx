"use client";

import { useEffect, useRef } from "react";

/**
 * **A sky to stand under while the thing is explained.**
 *
 * Canvas rather than hundreds of absolutely-positioned divs, because this sits
 * behind seven screens of text on a phone and the browser should not be
 * compositing a thousand layers to do it.
 *
 * ## Restraint, enforced rather than intended
 *
 * The stars do not twinkle — a field of pulsing dots is a screensaver. They
 * sit still and a meteor crosses occasionally, at the rate the subject itself
 * suggests rather than at a rate that looks busy. `prefers-reduced-motion`
 * stops the meteors entirely and leaves the stars, which is the version
 * somebody who gets motion sick should still be allowed to see.
 *
 * Nothing here is a star chart. The positions are random; the only claim this
 * makes is "it is dark and there are stars", which is not a claim.
 */
export function StarField({
  /** Where meteors appear to come from, 0–1 of the canvas. The radiant. */
  radiant,
  /** 0–1. How much of the sky the moon is washing out. */
  moonWash = 0,
  className = "",
}: {
  readonly radiant?: { readonly x: number; readonly y: number };
  readonly moonWash?: number;
  readonly className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const radiantRef = useRef(radiant);
  // Kept in an effect rather than written during render: a ref is not a
  // rendering value, and assigning one in the body is the bug React's own
  // lint rule exists to catch.
  useEffect(() => {
    radiantRef.current = radiant;
  }, [radiant]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let stars: { x: number; y: number; r: number; a: number }[] = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Density by area, so a phone does not get a denser sky than a laptop.
      const count = Math.min(260, Math.round((width * height) / 5200));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() < 0.88 ? 0.6 : 1.2,
        a: 0.25 + Math.random() * 0.5,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    interface Meteor {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
    }
    let meteors: Meteor[] = [];
    let last = performance.now();
    let sinceMeteor = 0;
    let frame = 0;

    const spawn = () => {
      const from = radiantRef.current;
      // From the radiant where there is one, otherwise across the top.
      const ox = from ? from.x * width : Math.random() * width;
      const oy = from ? from.y * height : Math.random() * height * 0.3;
      const angle = from
        ? Math.random() * Math.PI * 2
        : Math.PI * 0.75 + (Math.random() - 0.5) * 0.4;
      const speed = 420 + Math.random() * 320;
      const max = 0.5 + Math.random() * 0.4;
      meteors.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max,
      });
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        context.globalAlpha = star.a * (1 - moonWash * 0.65);
        context.fillStyle = "#e9e6da";
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }

      if (!reduced) {
        sinceMeteor += dt;
        // Roughly one every two and a half seconds. Enough to feel alive,
        // rare enough that catching one still feels like catching one.
        if (sinceMeteor > 2.5) {
          sinceMeteor = 0;
          spawn();
        }
        for (const m of meteors) {
          m.life += dt;
          const px = m.x;
          const py = m.y;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const fade = 1 - m.life / m.max;
          if (fade <= 0) continue;
          context.globalAlpha = Math.max(0, fade) * 0.9;
          context.strokeStyle = "#f3efe4";
          context.lineWidth = 1.4;
          context.beginPath();
          context.moveTo(px, py);
          context.lineTo(m.x, m.y);
          context.stroke();
        }
        meteors = meteors.filter(
          (m) =>
            m.life < m.max &&
            m.x > -80 &&
            m.x < width + 80 &&
            m.y > -80 &&
            m.y < height + 80,
        );
      }

      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [moonWash]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      data-testid="star-field"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
