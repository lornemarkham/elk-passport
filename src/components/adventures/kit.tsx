import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { AdventureStage } from "@/lib/adventures/present";
import { cn } from "@/lib/utils";

/**
 * **The handful of pieces Saved, Adventures and the guide share** — so the
 * three read as one product with Discovery: its display face, its pill
 * actions, its accent, on the journal palette (`--gh-*`, globals.css).
 * Thumb-sized by default (48 px), because these are phone pages first.
 */

/** Small uppercase line above a heading. */
export function Eyebrow({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <p
      className={cn(
        "ghad-accent-text text-xs font-bold tracking-[0.14em] uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** A section: an eyebrow, a big confident heading, and a line under it. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  action,
}: {
  readonly id: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly children?: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2
          id={id}
          className="ghad-display mt-1 text-[1.75rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-[var(--gh-ink)] sm:text-4xl"
        >
          {title}
        </h2>
        {children && (
          <p className="mt-2 max-w-xl text-base text-[var(--gh-ink-soft)]">
            {children}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

const PILL =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

const VARIANTS = {
  /** The one thing to do on the page. */
  primary:
    "bg-[var(--gh-ink)] text-white hover:bg-black focus-visible:outline-[var(--gh-ink)]",
  /** Decided, confirmed, go. */
  forest:
    "bg-[var(--gh-forest)] text-white hover:brightness-110 focus-visible:outline-[var(--gh-forest)]",
  /** Everything else. */
  quiet:
    "border-2 border-[var(--gh-ink)]/15 bg-white text-[var(--gh-ink)] hover:border-[var(--gh-ink)]/40 focus-visible:outline-[var(--gh-ink)]",
  /** On a photograph or a dark band. */
  light:
    "bg-white text-[var(--gh-ink)] hover:bg-[var(--gh-cream)] focus-visible:outline-white",
} as const;

export type PillVariant = keyof typeof VARIANTS;

export const pillClass = (variant: PillVariant = "quiet", extra?: string) =>
  cn(PILL, VARIANTS[variant], extra);

export function PillLink({
  variant = "quiet",
  className,
  ...props
}: ComponentProps<typeof Link> & { readonly variant?: PillVariant }) {
  return <Link {...props} className={pillClass(variant, className)} />;
}

const STAGE_STYLE: Readonly<Record<AdventureStage, string>> = {
  today: "bg-[var(--gh-sun)] text-[var(--gh-ink)]",
  upcoming: "bg-[var(--gh-forest)] text-white",
  draft: "bg-white text-[var(--gh-ink)]",
  done: "bg-[var(--gh-sand)] text-[var(--gh-ink)]",
};

/** Where an adventure is: today, coming, a draft, done. */
export function StatusBadge({
  stage,
  label,
  className,
}: {
  readonly stage: AdventureStage;
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <span
      data-testid="adventure-status"
      data-stage={stage}
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold tracking-wide",
        STAGE_STYLE[stage],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Initials for the people going — never more than who you can see. */
export function PeopleDots({
  names,
  className,
}: {
  readonly names: readonly string[];
  readonly className?: string;
}) {
  if (names.length === 0) return null;
  const shown = names.slice(0, 4);
  return (
    <span
      className={cn("inline-flex items-center", className)}
      aria-label={`${names.length} going: ${names.join(", ")}`}
    >
      {shown.map((name, i) => (
        <span
          key={`${name}-${i}`}
          aria-hidden
          className="-ml-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--gh-sand)] text-xs font-bold text-[var(--gh-ink)] first:ml-0"
        >
          {initials(name)}
        </span>
      ))}
      {names.length > shown.length && (
        <span aria-hidden className="ml-1.5 text-sm font-semibold">
          +{names.length - shown.length}
        </span>
      )}
    </span>
  );
}

export function initials(name: string): string {
  const words = name
    .replace(/[@.].*$/, "")
    .split(/[\s_-]+/)
    .filter(Boolean);
  return (
    (words.length > 1
      ? `${words[0]![0]}${words[1]![0]}`
      : (words[0] ?? "?").slice(0, 2)
    ).toUpperCase() || "?"
  );
}

/** One hue per day, in order, so a weekend reads as two days. */
export const DAY_TONES = [
  { bg: "var(--gh-forest)", ink: "#ffffff" },
  { bg: "var(--gh-lake)", ink: "#ffffff" },
  { bg: "var(--gh-berry)", ink: "#ffffff" },
  { bg: "var(--gh-sun)", ink: "var(--gh-ink)" },
] as const;

export const toneFor = (index: number) => DAY_TONES[index % DAY_TONES.length]!;
