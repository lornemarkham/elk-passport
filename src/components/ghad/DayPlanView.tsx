import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { DayPlan } from "@/domain/day/plan";
import { planDateLine } from "@/domain/day/plan";
import { TravelFromHere } from "./TravelFromHere";

/**
 * **The plan, which is a page of facts and the gaps between them.**
 *
 * This is the end of the first vertical slice: find something, open it, say
 * *let's do this*, and get the few things somebody actually needs before
 * leaving — where it is, what day they picked, what they would be doing,
 * whether Atlas knows it is open, how far, what a publisher said about
 * practicalities, what the rules are, and a way to get directions.
 *
 * It is **not** an itinerary. There is no schedule, no sequence, no "9:30 —
 * leave the house", because Passport knows a stated duration for 17 of 2,680
 * subjects and anything else would be filled in by a language model with no
 * evidence behind it.
 *
 * ## What is still unknown is printed, under its own heading
 *
 * The plan ends with the list of headings it could not fill. A plan that
 * quietly drops them looks exactly like a plan that checked, and that is the
 * difference between a product somebody can trust with a Sunday and one they
 * cannot.
 */
export function DayPlanView({
  plan,
  description,
  picture,
  coordinates,
  entityHref,
  back,
}: {
  readonly plan: DayPlan;
  /** Atlas's own description, where it says the description is worth printing. */
  readonly description?: string;
  readonly picture?: string;
  readonly coordinates?: readonly [number, number];
  /** The subject's own page, so the evidence behind this is one click away. */
  readonly entityHref: string;
  readonly back: string;
}) {
  const known = plan.facts.filter((fact) => fact.value);
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-10">
      <Link
        href={back}
        data-testid="day-back"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black/45 transition-colors hover:text-black/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Keep looking
      </Link>

      <p
        className="mt-6 text-[11px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: "var(--ghad-accent)" }}
      >
        Your day
      </p>
      <h1 className="ghad-display mt-2 text-[32px] leading-[0.98] font-extrabold tracking-[-0.04em] text-balance text-[#111] sm:text-[52px]">
        {plan.title}
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[15px] text-black/55">
        {plan.where && <span>{plan.where}</span>}
        {plan.where && plan.on && (
          <span aria-hidden className="text-black/25">
            ·
          </span>
        )}
        {plan.on && (
          <span data-testid="day-date" className="tabular-nums">
            {planDateLine(plan.on)}
          </span>
        )}
      </p>

      {picture && (
        <div className="mt-6 aspect-[16/9] w-full overflow-hidden bg-black/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline. The corpus publishes from dozens of hosts (BC Parks' object store among them) and `next/image` throws on any that is not listed in next.config, which is a 500 on a plan page over a photograph. `PossibilityCard` made the same call for the same reason. */}
          <img src={picture} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {description && (
        <p className="mt-6 max-w-[62ch] text-[16px] leading-relaxed text-black/70">
          {description}
        </p>
      )}

      <ul className="mt-8">
        {known.map((fact, index) => (
          <li
            key={`${fact.label}-${index}`}
            data-testid="day-fact"
            className="border-t border-black/10 py-4"
          >
            <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
              {fact.label}
            </p>
            <p
              className={
                "mt-1.5 max-w-[68ch] text-[16px] leading-relaxed " +
                (fact.against ? "text-black/55" : "text-[#111]")
              }
            >
              {/* **What argues against the plan is said first, not hidden.**
                  A plan that knows the market is shut on a Sunday and prints
                  it third is a plan that got somebody into a car. */}
              {fact.against && (
                <span
                  data-testid="day-against"
                  className="mr-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] uppercase ring-1 ring-black/15 ring-inset"
                >
                  Against this day
                </span>
              )}
              {fact.value}
            </p>
            {fact.because && (
              <p className="mt-2 max-w-[68ch] border-l-2 border-black/10 pl-3 text-[14px] leading-relaxed text-black/45 italic">
                “{fact.because}”
              </p>
            )}
          </li>
        ))}

        {/* The distance is the one fact the server cannot know; see
            `TravelFromHere`. It replaces the unknown heading rather than
            adding a second one. */}
        <li className="border-t border-black/10 py-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            How far
          </p>
          <div className="mt-1.5">
            <TravelFromHere {...(coordinates ? { coordinates } : {})} />
          </div>
        </li>
      </ul>

      {plan.restrictions.length > 0 && (
        <section data-testid="day-restrictions" className="mt-8">
          <h2 className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            Rules and conditions
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {plan.restrictions.map((rule) => (
              <li
                key={rule}
                className="max-w-[68ch] text-[15px] leading-relaxed text-[#111]"
              >
                {rule}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* **The gaps, printed.** Everything above is what Atlas states; this is
          what it does not, named rather than left as white space. */}
      {plan.unknowns.filter((label) => label !== "How far").length > 0 && (
        <section data-testid="day-unknowns" className="mt-8">
          <h2 className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            Still unknown
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {plan.facts
              .filter((fact) => fact.unknown && fact.label !== "How far")
              .map((fact) => (
                <li
                  key={fact.label}
                  className="max-w-[68ch] text-[15px] leading-relaxed text-black/55"
                >
                  <span className="font-semibold text-[#111]">
                    {fact.label}.
                  </span>{" "}
                  {fact.unknown}
                </li>
              ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3 border-t border-black/10 pt-6">
        {plan.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            data-testid="day-link"
            style={{
              backgroundColor: "var(--ghad-accent)",
              color: "var(--ghad-accent-ink)",
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-[15px] font-semibold"
          >
            {link.label}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        ))}
        <Link
          href={entityHref}
          data-testid="day-entity"
          className="inline-flex min-h-11 items-center px-5 text-[15px] font-semibold text-black/60 ring-1 ring-black/15 transition-colors ring-inset hover:text-[#111]"
          style={{ borderRadius: 9999 }}
        >
          Everything Atlas knows
        </Link>
      </div>
    </div>
  );
}
