import Link from "next/link";
import type { ReactNode } from "react";

/**
 * **Conference's design kit.** Charcoal, warm white and slate; one editorial
 * serif (`cf-display`, `cf-serif`) for names and headlines and the app's sans
 * for everything else. The organiser's colour is a detail — a rule, a dot,
 * the current tab — never a banner.
 *
 * Tokens live in `globals.css` (`--color-cf-*`). Every conference screen
 * builds from these pieces so that the overview, arrivals, agenda, explore
 * and people read as one product.
 */

export const btn = {
  primary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-cf-ink px-4 text-[14px] font-semibold text-white transition hover:bg-cf-graphite active:scale-[0.98] disabled:opacity-40",
  secondary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-cf-line bg-white px-4 text-[14px] font-semibold text-cf-ink transition hover:border-cf-ink/30 active:scale-[0.98] disabled:opacity-40",
  quiet:
    "inline-flex min-h-10 items-center gap-1.5 rounded-full px-1 text-[14px] font-semibold text-cf-ink underline-offset-4 transition hover:underline",
} as const;

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`cf-eyebrow text-cf-mist ${className}`.trim()}>{children}</p>
  );
}

/** A white card on warm paper. */
export function Panel({
  children,
  className = "",
  as: As = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
} & Record<`data-${string}`, string>) {
  return (
    <As
      className={`border-cf-line bg-cf-card rounded-2xl border shadow-[0_1px_2px_rgba(23,24,27,0.04)] ${className}`.trim()}
      {...rest}
    >
      {children}
    </As>
  );
}

/** A panel's head: an eyebrow, a serif title, and at most one way onward. */
export function PanelHead({
  eyebrow,
  title,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  action?: { href: string; label: string } | null;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="cf-serif text-cf-ink mt-1 text-[21px] leading-tight">
          {title}
        </h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="text-cf-slate hover:text-cf-ink shrink-0 pb-0.5 text-[13px] font-semibold underline-offset-4 hover:underline"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

const TINTS = [
  ["#e7ecef", "#33414d"],
  ["#e8eee8", "#2f4a3a"],
  ["#f0e9df", "#5a4426"],
  ["#ece8f0", "#463a57"],
  ["#e5ecee", "#24484f"],
  ["#f1e6e4", "#5b3530"],
] as const;

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "·";

/**
 * A person as a monogram. Nobody uploads a photograph to a conference, and
 * Passport doesn't fetch one from anywhere else, so the initials of the name
 * they chose are the avatar. Same name, same colour, on every screen.
 */
export function Avatar({
  name,
  size = 36,
  you = false,
  ring = false,
  dark = false,
  className = "",
}: {
  name: string;
  size?: number;
  you?: boolean;
  ring?: boolean;
  /** On a charcoal surface (the arrivals board). */
  dark?: boolean;
  className?: string;
}) {
  const [bg, fg] = dark
    ? you
      ? ["#f7f5f0", "#17181b"]
      : ["rgba(255,255,255,0.12)", "#ffffff"]
    : you
      ? ["#17181b", "#ffffff"]
      : TINTS[hash(name) % TINTS.length];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none ${ring ? "ring-2 ring-white" : ""} ${className}`.trim()}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.38),
        letterSpacing: "0.02em",
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping monograms, then "+n" for the rest (or for people not named). */
export function AvatarStack({
  names,
  more = 0,
  size = 30,
  max = 5,
}: {
  names: readonly string[];
  more?: number;
  size?: number;
  max?: number;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length + more;
  return (
    <span className="inline-flex items-center">
      {shown.map((n, i) => (
        <Avatar
          key={`${n}-${i}`}
          name={n}
          size={size}
          ring
          className={i ? "-ml-1.5" : ""}
        />
      ))}
      {rest > 0 ? (
        <span
          className={`bg-cf-sand text-cf-slate inline-flex items-center justify-center rounded-full font-semibold ring-2 ring-white ${shown.length ? "-ml-1.5" : ""}`}
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.36),
          }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

export type Tone = "live" | "neutral" | "quiet" | "accent" | "warn";

const TONE: Record<Tone, string> = {
  live: "bg-[#e7f3ec] text-cf-sage",
  neutral: "bg-cf-sand text-cf-graphite",
  quiet: "bg-transparent text-cf-mist ring-1 ring-cf-line",
  accent: "bg-cf-ink text-white",
  warn: "bg-[#fbefe1] text-[#8a4b12]",
};

export function Pill({
  tone = "neutral",
  children,
  dot = false,
  className = "",
  ...rest
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
} & Record<`data-${string}`, string>) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap ${TONE[tone]} ${className}`.trim()}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full bg-current ${tone === "live" ? "cf-pulse" : ""}`}
        />
      ) : null}
      {children}
    </span>
  );
}

/**
 * An empty state that still looks finished: what this is for, in one line,
 * and the next step (only when there is one this person can take).
 */
export function EmptyNote({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string } | null;
  className?: string;
}) {
  return (
    <div
      className={`border-cf-line bg-cf-paper/60 rounded-xl border border-dashed px-5 py-5 ${className}`.trim()}
    >
      <p className="text-cf-ink text-[15px] font-semibold">{title}</p>
      {children ? (
        <p className="text-cf-slate mt-1 text-[14px] leading-relaxed">
          {children}
        </p>
      ) : null}
      {action ? (
        <Link href={action.href} className={`${btn.secondary} mt-4`}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** The top of a conference screen, under the conference bar. */
export function PageHead({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-5 pb-1 sm:px-8 sm:pt-12 sm:pb-2">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1 className="cf-display text-cf-ink mt-1.5 text-[28px] leading-[1.05] sm:mt-2 sm:text-[44px] sm:leading-[1.02]">
        {title}
      </h1>
      {lede ? (
        <p className="text-cf-slate mt-2 max-w-[60ch] text-[14px] leading-relaxed sm:mt-3 sm:text-[16px]">
          {lede}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export const wrap = "mx-auto max-w-[1180px] px-4 sm:px-8";
