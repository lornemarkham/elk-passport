import Link from "next/link";
import { ArrowRight, Info, MapPin, Sparkles } from "lucide-react";
import type { Idea } from "@/domain/christmas/ideas";
import type { PlanIdea, Way } from "@/domain/christmas/ways";
import { cn } from "@/lib/utils";
import styles from "./christmas.module.css";

/**
 * **One way to have a Christmas, as a card** — designed artwork, never a
 * photograph standing in for something it isn't: the way's own colours, a
 * string of lights and its emoji. Real pictures stay on real finds.
 */
export function WayCard({
  way,
  href,
  testId,
  small = false,
}: {
  readonly way: Way;
  readonly href: string;
  readonly testId?: string;
  readonly small?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col justify-end overflow-hidden rounded-[22px] p-3.5 text-white shadow-[0_8px_26px_rgba(8,35,25,0.16)] transition hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#ffd98a] motion-reduce:transition-none sm:p-5",
        small ? "min-h-[6.5rem] pt-12" : "min-h-[9.5rem] pt-16 sm:min-h-48",
      )}
      style={{
        background: `radial-gradient(120% 90% at 85% 10%, color-mix(in srgb, ${way.art.glow} 28%, transparent), transparent 55%), linear-gradient(150deg, ${way.art.from}, ${way.art.to})`,
      }}
      data-testid={testId ?? `way-${way.id}`}
    >
      <span
        className={cn(styles.lights, "absolute inset-x-0 top-0 opacity-80")}
        aria-hidden
      />
      <span
        className={cn(
          "absolute top-5 left-3.5 leading-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-110 motion-reduce:transition-none sm:left-5",
          small ? "top-4 text-2xl" : "text-[2.1rem] sm:text-5xl",
        )}
        aria-hidden
      >
        {way.emoji}
      </span>
      <span className="relative">
        <span
          className={cn(
            "ghad-display block leading-[1.02] font-extrabold tracking-[-0.02em]",
            small ? "text-base" : "text-[1.2rem] sm:text-2xl",
          )}
        >
          {way.label}
        </span>
        {!small && (
          <span className="mt-1 block text-[0.85rem] leading-snug text-white/85 sm:text-base">
            {way.line}
          </span>
        )}
      </span>
    </Link>
  );
}

/** A plan the planner can build at once: a real place per part, or a gap said. */
export function PlanCard({
  plan,
  href,
}: {
  readonly plan: PlanIdea;
  readonly href: string;
}) {
  return (
    <Link
      href={href}
      className={`${styles.ticket} flex h-full items-start gap-3 rounded-[22px] p-4 transition hover:-translate-y-0.5 motion-reduce:transition-none sm:p-5`}
      data-testid="plan-idea"
    >
      <span className="text-3xl leading-none" aria-hidden>
        {plan.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="ghad-display block text-lg leading-tight font-extrabold">
          {plan.title}
        </span>
        <span className="mt-1 block text-sm text-[var(--gh-ink-soft)]">
          {plan.line}
        </span>
        <span className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-extrabold text-[#b3242f]">
          <Sparkles className="h-4 w-4" aria-hidden />
          Make it a plan
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/**
 * **An idea, said as one.** No venue, no time, no price, no streaming
 * service — and the card says it is Passport's idea, not a listing.
 */
export function IdeaCard({
  idea,
  planHref,
  lightsHref,
}: {
  readonly idea: Idea;
  /** The planner, when the idea is an outing it can place. */
  readonly planHref?: string;
  readonly lightsHref?: string;
}) {
  return (
    <article
      className="flex h-full flex-col gap-2 rounded-[22px] bg-white p-4 ring-1 ring-black/5 sm:p-5"
      data-testid="idea-card"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl leading-none" aria-hidden>
          {idea.emoji}
        </span>
        <span className="rounded-full bg-[#f3ead8] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#5b4a2e] uppercase">
          An idea, not a listing
        </span>
      </div>
      <h3 className="ghad-display text-lg leading-tight font-extrabold text-balance">
        {idea.title}
      </h3>
      <p className="text-sm text-[var(--gh-ink-soft)]">{idea.line}</p>
      {idea.careful && (
        <p className="flex gap-1.5 text-sm text-[#5b4a2e]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{idea.careful}</span>
        </p>
      )}
      {(planHref || lightsHref) && (
        <Link
          href={(planHref ?? lightsHref)!}
          className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-1 text-sm font-extrabold text-[#b3242f] underline-offset-4 hover:underline"
          data-testid={planHref ? "idea-plan" : "idea-lights"}
        >
          {planHref ? (
            <>
              <Sparkles className="h-4 w-4" aria-hidden />
              Find real places for it
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" aria-hidden />
              Open the lights map
            </>
          )}
        </Link>
      )}
    </article>
  );
}

/** Where finds are on their way: card-shaped, and said in words. */
export function RowSkeleton({
  label,
  cards = 4,
}: {
  readonly label: string;
  readonly cards?: number;
}) {
  return (
    <div role="status" aria-live="polite" data-testid="row-loading">
      <p className="mb-3 text-sm font-semibold text-[var(--gh-ink-soft)]">
        {label}
      </p>
      <div className="-mx-4 flex gap-4 overflow-hidden px-4 sm:-mx-6 sm:px-6">
        {Array.from({ length: cards }, (_, i) => (
          <div
            key={i}
            className="h-[21rem] w-[17.5rem] shrink-0 animate-pulse rounded-[26px] bg-white ring-1 ring-black/5 motion-reduce:animate-none"
            aria-hidden
          >
            <div className="aspect-[4/3] rounded-t-[26px] bg-[#efe6d4]" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-1/3 rounded bg-[#efe6d4]" />
              <div className="h-5 w-4/5 rounded bg-[#efe6d4]" />
              <div className="h-3 w-2/3 rounded bg-[#efe6d4]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
