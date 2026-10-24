import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { AdventureGlance, AdventureSummary } from "@/lib/adventures/store";
import { kindLabel } from "@/lib/adventures/kinds";
import {
  adventureStatus,
  whenLabel,
  type AdventureStatus,
} from "@/lib/adventures/present";
import { Picture } from "./Picture";
import { pillClass, StatusBadge } from "./kit";

const NO_GLANCE: AdventureGlance = {
  stops: [],
  ideas: [],
  undecided: 0,
  people: 1,
};

/**
 * **An adventure, as something to look forward to.** Its picture is the
 * first stop's (else the first idea's), with that picture's own label; then
 * where, when, who and where the plan stands. The whole card opens it.
 *
 * `hero` is Saved's _Your next adventure_: bigger, and with the one action
 * that matters — _Continue planning_ (or _Open today's plan_).
 */
export function AdventureCard({
  adventure,
  glance = NO_GLANCE,
  cover,
  today,
  hero = false,
}: {
  readonly adventure: AdventureSummary;
  readonly glance?: AdventureGlance;
  readonly cover?: Experience;
  readonly today: string;
  readonly hero?: boolean;
}) {
  const status: AdventureStatus = adventureStatus(
    adventure,
    { stops: glance.stops.length, undecided: glance.undecided },
    today,
  );
  const when = whenLabel(adventure.startsOn, adventure.endsOn);
  const href = `/adventures/${adventure.id}`;
  const facts = (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <li className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4" aria-hidden />
        {when ?? "No date yet"}
      </li>
      {adventure.destinationLabel && (
        <li className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4" aria-hidden />
          {adventure.destinationLabel}
        </li>
      )}
      <li className="inline-flex items-center gap-1.5">
        <Users className="h-4 w-4" aria-hidden />
        {glance.people === 1 ? "Just you so far" : `${glance.people} going`}
      </li>
    </ul>
  );

  if (hero)
    return (
      <article
        data-testid="next-adventure"
        className="relative isolate overflow-hidden rounded-[28px] bg-[var(--gh-forest)] text-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]"
      >
        <Picture
          experience={cover}
          priority
          fallbackTitle=""
          className="absolute inset-0 -z-10 h-full w-full"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/5" />
        <div className="flex min-h-[26rem] flex-col justify-end p-6 sm:min-h-[30rem] sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge stage={status.stage} label={status.label} />
            <span className="text-sm font-semibold text-white/85">
              {kindLabel(adventure.kind)}
            </span>
          </div>
          <h3 className="ghad-display mt-3 text-4xl leading-[0.98] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {adventure.title}
            </Link>
          </h3>
          <div className="text-white/90">{facts}</div>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Link
              href={href}
              data-testid="continue-planning"
              className={pillClass("light", "min-h-14 px-6 text-lg")}
            >
              {status.stage === "today"
                ? "Open today's plan"
                : status.stage === "done"
                  ? "Look back"
                  : "Continue planning"}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </div>
      </article>
    );

  return (
    <article
      data-testid="adventure-card"
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--gh-line)] bg-white transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.5)]"
    >
      <Picture
        experience={cover}
        fallbackTitle={adventure.title}
        className="aspect-[16/10] w-full"
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            stage={status.stage}
            label={status.label}
            className={
              status.stage === "draft"
                ? "border border-[var(--gh-line)]"
                : undefined
            }
          />
          <span className="text-xs font-semibold text-[var(--gh-ink-soft)]">
            {kindLabel(adventure.kind)}
            {adventure.role === "participant" ? " · Joined" : ""}
          </span>
        </div>
        <h3 className="ghad-display mt-2 text-2xl leading-tight font-extrabold tracking-[-0.02em] text-[var(--gh-ink)]">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {adventure.title}
          </Link>
        </h3>
        <div className="text-[var(--gh-ink-soft)]">{facts}</div>
      </div>
    </article>
  );
}
