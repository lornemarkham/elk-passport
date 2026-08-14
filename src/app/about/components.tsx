"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

/**
 * Reveal-on-scroll — the whole page's pacing mechanism. "Allow silence,
 * then impact, then silence, then impact" is implemented here and
 * nowhere else: everything that should arrive rather than just appear
 * wraps in this, once, instead of every section hand-rolling its own
 * animation.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const SIZE_CLASSES = {
  massive: "text-[13vw] leading-[0.92] md:text-[10vw]",
  huge: "text-[9vw] leading-[0.95] md:text-[6.5vw]",
  large: "text-5xl leading-[1.05] md:text-7xl",
  medium: "text-3xl leading-tight md:text-5xl",
} as const;

/** Editorial, film-title typography — the thing that carries emotion on
 * this page instead of paragraphs doing it. Fraunces is already the
 * app's own `--font-heading`; this just gives it room to be huge. */
export function BigLine({
  children,
  size = "huge",
  className = "",
}: {
  children: ReactNode;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <p
      className={`font-heading font-medium tracking-tight text-balance ${SIZE_CLASSES[size]} ${className}`}
    >
      {children}
    </p>
  );
}

/** A full-bleed act — the unit this whole page is built from. `tone`
 * picks light or dark (dusk/ember vs. paper/moss — both already real
 * theme colors, not invented for this page), so the page can breathe
 * between registers the way the brief's own act structure asks for. */
export function ActShell({
  tone = "light",
  children,
  className = "",
  id,
}: {
  tone?: "light" | "dark";
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={
        tone === "dark"
          ? `relative overflow-hidden bg-[#171208] text-[#f3ead9] ${className}`
          : `relative overflow-hidden bg-[#f7ecd3] text-[#241a10] ${className}`
      }
    >
      {children}
    </section>
  );
}

/**
 * A placeholder that admits it's a placeholder — deliberately, not
 * apologetically. No public/ imagery exists yet for this page (checked
 * before building), and the brief is explicit: an elegant placeholder
 * beats a random stock photo. `src`, once real imagery exists, is the
 * only thing that needs to change — the frame, caption, and aspect ratio
 * stay put.
 */
export function ImageSlot({
  label,
  aspect = "aspect-[4/5]",
  src,
  alt,
  className = "",
}: {
  label: string;
  aspect?: string;
  src?: string;
  alt?: string;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`overflow-hidden rounded-md ${aspect} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- brand mood-board page, arbitrary future image sources */}
        <img
          src={src}
          alt={alt ?? label}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`flex ${aspect} items-end overflow-hidden rounded-md border border-current/15 bg-gradient-to-br from-current/10 via-current/[0.03] to-current/10 p-3 ${className}`}
    >
      <span className="text-[10px] font-medium tracking-[0.15em] uppercase opacity-40">
        {label} — photo pending
      </span>
    </div>
  );
}

/** Same idea as `ImageSlot`, for a future film. Nothing autoplays,
 * nothing is embedded yet — this is a labeled space waiting for a real
 * cut, with the treatment's own beats visible so the placeholder is
 * useful on its own, not just an empty box. */
export function VideoSlot({
  title,
  beats,
}: {
  title: string;
  beats: readonly string[];
}) {
  return (
    <div className="flex aspect-video flex-col justify-between rounded-md border border-current/15 bg-gradient-to-br from-current/10 via-current/[0.03] to-current/10 p-6">
      <div className="flex items-center gap-2 text-xs font-medium tracking-[0.15em] uppercase opacity-50">
        <Play className="h-3.5 w-3.5" />
        film — unreleased
      </div>
      <div>
        <p className="font-heading text-2xl md:text-3xl">{title}</p>
        <p className="mt-2 text-sm opacity-60">{beats.join(" · ")}</p>
      </div>
    </div>
  );
}
