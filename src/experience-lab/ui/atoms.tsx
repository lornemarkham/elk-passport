"use client";

import type { Participant } from "../core/types";

/**
 * The smallest shared pieces. Everything in the lab is drawn on a dark
 * surface with one accent per person — a participant's hue is the only
 * identity token the prototype has, and it has to work on a leaderboard, a
 * vote bar, an avatar and a feed line without ever becoming a legend.
 */

export function personColor(hue: number, l = 0.72, c = 0.14): string {
  return `oklch(${l} ${c} ${hue})`;
}

export function Avatar({
  person,
  size = 32,
  dim = false,
  ring = false,
}: {
  person: Participant;
  size?: number;
  dim?: boolean;
  ring?: boolean;
}) {
  return (
    <span
      title={person.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `oklch(0.3 0.05 ${person.hue} / ${dim ? 0.35 : 0.9})`,
        border: `1px solid ${personColor(person.hue, 0.6, 0.1)}`,
        opacity: dim ? 0.45 : 1,
        boxShadow: ring ? `0 0 0 2px ${personColor(person.hue)}` : undefined,
      }}
    >
      {person.emoji}
    </span>
  );
}

export function AvatarRow({
  people,
  size = 26,
  max = 8,
}: {
  people: readonly Participant[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center" style={{ gap: 2 }}>
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size={size} />
      ))}
      {people.length > max && (
        <span className="ml-1 text-xs text-white/50">
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

/** Passport speaking. Never styled as a chat bubble — it is the room, not a person in it. */
export function VoiceLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-white/25 py-0.5 pl-3 text-[15px] leading-snug text-white/75 italic">
      {children}
    </p>
  );
}

export function SectionHead({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  if (!title) return null;
  return (
    <div className="mb-3">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-[13px] leading-snug text-white/50">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function Pill({
  children,
  tone = "quiet",
}: {
  children: React.ReactNode;
  tone?: "quiet" | "hot" | "locked";
}) {
  const styles = {
    quiet: "border-white/15 text-white/55",
    hot: "border-amber-300/45 text-amber-200",
    locked: "border-white/10 text-white/35",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap ${styles}`}
    >
      {children}
    </span>
  );
}

export function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}
    >
      {children}
    </div>
  );
}
