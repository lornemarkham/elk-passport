"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Flag,
  HelpCircle,
  Home,
  Minus,
  Pin,
  Plus,
  Shuffle,
  Sparkles,
  Umbrella,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Alternative, DayPlanned, DayStop } from "@/domain/day/build";
import { clockLabel } from "@/domain/day/brief";
import { timelineFor, type Timeline } from "@/domain/day/timeline";
import { ageLine } from "@/domain/discovery/suitability";
import { destinationFor } from "@/domain/experience/destination";
import type { Journey, TravelMode } from "@/lib/routing/journey";
import { shownLeg, travelTotal, type Leg } from "@/lib/routing/legs";
import { dayLegs, unknownsWithTravel } from "@/lib/routing/dayLegs";
import { useTravelLegs } from "@/lib/routing/useTravelLegs";
import { LegLine } from "@/components/maps/LegLine";
import { TravelSummary } from "@/components/maps/TravelSummary";
import { TravelModeSwitch } from "@/components/maps/TravelModeSwitch";

/**
 * **The day, on screen, before it is on paper.**
 *
 * A route, not a table: you leave from somewhere, each stop is a place with a
 * picture and a reason, the moves between them are drawn as moves, and the
 * day ends where it began. The thing a person is deciding is whether *this
 * whole shape* is worth leaving the house for, and a grid of rows does not
 * look like anything worth leaving the house for.
 *
 * ## Two kinds of sentence, kept visibly apart
 *
 * ```
 * ✓  stated   a published price, published hours, a rule, Atlas's rain
 *             reading, Atlas's age verdict, a measured straight-line km
 * ✦  Passport why it is in the day, who it might suit, how long the plan
 *             gives it, the side quest, the rain plan
 * ```
 *
 * The doctrine's discipline (§5): *signals are evidence, inference is
 * inference.* A plan that sets its own guesses in the same type as a
 * publisher's price is a plan that has quietly promoted them.
 *
 * Every stop links to its own entity page, so the evidence behind any of it
 * is one tap away and nothing here has to be taken on faith.
 *
 * ## Travel
 *
 * **Each move is Atlas's routed estimate, or a straight line that says so**
 * (`lib/routing`). The plan's own move buffer is still shown beside it, as a
 * buffer: the routed minutes do not yet replace it in the time budget.
 */
export interface StopControls {
  readonly onKeep: (index: number) => void;
  readonly onSwap: (index: number) => void;
  readonly onChoose: (index: number, id: string) => void;
  readonly onRemove: (index: number) => void;
  readonly onMove: (index: number, by: -1 | 1) => void;
  readonly onTime: (index: number, by: number) => void;
  readonly onRainPlan: (index: number) => void;
  /** Put a set-aside stop back into the day, kept. */
  readonly onRestore?: (id: string) => void;
}

/** A stop the person set aside: not today, still theirs. */
export interface SetAside {
  readonly id: string;
  readonly title: string;
}

export function DayItinerary({
  day,
  controls,
  swapping,
  alternatives = [],
  by = "driving",
  onBy,
  setAside = [],
  onTimeline,
}: {
  readonly day: DayPlanned;
  readonly controls?: StopControls;
  /** The stop whose alternatives are open, if any. */
  readonly swapping?: number;
  readonly alternatives?: readonly Alternative[];
  readonly by?: TravelMode;
  readonly onBy?: (mode: TravelMode) => void;
  /** Stops the person took out of this day. They stay visible, and theirs. */
  readonly setAside?: readonly SetAside[];
  /** Told whenever the day's clock changes, so the page can print or copy it. */
  readonly onTimeline?: (timeline: Timeline | undefined) => void;
}) {
  const { legs, into, home } = useMemo(() => dayLegs(day), [day]);
  const travel = useTravelLegs(legs, by);
  const total = travelTotal(legs, travel.journeys, by);
  const unknowns = unknownsWithTravel(day.unknowns, travel.status, total);
  const planned = day.stops.reduce((sum, stop) => sum + stop.minutes, 0);
  // `useTravelLegs` hands back a fresh `journeys` array on every render, so
  // the clock is keyed on what it *says*: otherwise reporting it to the page
  // re-renders the page, which re-renders this, which reports it again.
  const clock = timelineFor(day, travel.journeys, by);
  const clockKey = JSON.stringify(clock ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const timeline = useMemo(() => clock, [clockKey]);
  useEffect(() => onTimeline?.(timeline), [onTimeline, timeline]);
  const legAt = (i: number | undefined) =>
    i === undefined
      ? undefined
      : { leg: legs[i]!, journey: shownLeg(legs[i]!, travel.journeys[i]) };

  if (day.stops.length === 0) {
    return (
      <p
        data-testid="go-empty"
        className="max-w-[60ch] text-[16px] text-black/60"
      >
        {day.opening}
      </p>
    );
  }

  const town = day.brief.town?.name.replace(/,\s*BC$/, "");

  return (
    <div>
      <h2 className="ghad-display max-w-[20ch] text-[26px] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance text-[#111] sm:text-[40px]">
        {day.title}
      </h2>
      <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-black/60">
        {day.opening}
      </p>

      {day.leftOut && day.leftOut.length > 0 && (
        <div
          data-testid="go-left-out"
          role="status"
          className="mt-4 rounded-xl bg-amber-50 p-3 text-[14px] leading-relaxed text-amber-950 ring-1 ring-amber-200"
        >
          <p className="font-semibold">Couldn&apos;t fit these in</p>
          <ul className="mt-1 flex flex-col gap-1">
            {day.leftOut.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {day.budget && <TimeBar day={day} />}
      {timeline && <Verdict timeline={timeline} />}
      {timeline && <Glance day={day} timeline={timeline} />}
      {day.money && <MoneyLine day={day} />}

      {legs.length > 0 && (
        <div className="mt-5" data-testid="go-travel">
          {onBy && <TravelModeSwitch mode={by} onChange={onBy} />}
          <TravelSummary
            legs={legs}
            answers={travel.journeys}
            status={travel.status}
            mode={by}
            planned={planned}
            onRetry={travel.retry}
          />
        </div>
      )}

      <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-black/45">
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          Stated by the place or by Atlas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles
            className="h-3.5 w-3.5"
            style={{ color: "var(--ghad-accent)" }}
            aria-hidden
          />
          Passport&apos;s suggestion
        </span>
      </p>

      <ol className="relative mt-6">
        {/* The route line: one stroke from the door to the door. */}
        <span
          aria-hidden
          className="absolute top-3 bottom-3 left-[15px] w-[2px] bg-black/10"
        />

        <RouteNode testId="go-start" icon={<Flag className="h-3.5 w-3.5" />}>
          <span className="font-semibold text-[#111]">
            {town ? `Leave from ${town}` : "Leave from wherever you are"}
          </span>
          {day.brief.startAt !== undefined && (
            <span className="text-black/50">
              {" "}
              ·{" "}
              {day.brief.startsNow
                ? `now, about ${clockLabel(day.brief.startAt)}`
                : clockLabel(day.brief.startAt)}
            </span>
          )}
          {!town && (
            <span className="block text-[13px] text-black/45">
              Name a town and the day gets distances and a forecast.
            </span>
          )}
          {day.brief.startAt === undefined && (
            <span
              data-testid="go-no-clock"
              className="block text-[13px] text-black/45"
            >
              Say when you&apos;re leaving — “leave at 10” — and each stop gets
              a time.
            </span>
          )}
        </RouteNode>

        {day.stops.map((stop, index) => (
          <li key={stop.experience.id} className="relative">
            <Move
              stop={stop}
              first={index === 0}
              perMove={day.budget?.perMove}
              arriving={legAt(into[index])}
            />
            <StopCard
              day={day}
              stop={stop}
              index={index}
              {...(controls ? { controls } : {})}
              open={swapping === index}
              alternatives={swapping === index ? alternatives : []}
              {...(timeline?.stops[index]
                ? { when: timeline.stops[index] }
                : {})}
            />
          </li>
        ))}

        {town && (
          <>
            {(day.homeKm !== undefined || home !== undefined) && (
              <li className="list-none" data-testid="go-home-leg">
                <MoveLine
                  {...(day.homeKm !== undefined ? { km: day.homeKm } : {})}
                  {...(day.budget?.perMove
                    ? { perMove: day.budget.perMove }
                    : {})}
                  arriving={legAt(home)}
                />
              </li>
            )}
            <RouteNode testId="go-home" icon={<Home className="h-3.5 w-3.5" />}>
              <span className="font-semibold text-[#111]">Back to {town}</span>
              {day.brief.homeBy !== undefined && (
                <span className="text-black/50">
                  {" "}
                  · by {clockLabel(day.brief.homeBy)}
                </span>
              )}
              {timeline?.home && (
                <span
                  data-testid="go-home-clock"
                  className="block text-[13px] text-black/55"
                >
                  Home about {clockLabel(timeline.home.arrive)}
                  {timeline.home.basis === "allowance"
                    ? " — roads not measured"
                    : ""}
                </span>
              )}
            </RouteNode>
          </>
        )}
      </ol>

      {/* **What the day does not know, printed with the day.** A guide that
          omits this reads exactly like one that checked. */}
      <section
        data-testid="go-unknowns"
        className="mt-6 border-t border-black/10 pt-5"
      >
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
          Worth checking before you go
        </h3>
        <ul className="mt-2 flex flex-col gap-1">
          {unknowns
            .filter((unknown) => !day.leftOut?.includes(unknown))
            .map((unknown) => (
              <li
                key={unknown}
                className="max-w-[64ch] text-[14px] leading-relaxed text-black/55"
              >
                {unknown}
              </li>
            ))}
        </ul>
      </section>

      {setAside.length > 0 && (
        <section
          data-testid="go-set-aside"
          className="mt-6 rounded-2xl bg-black/[0.03] p-4"
        >
          <h3 className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            Not today — still yours
          </h3>
          <p className="mt-1 text-[13px] text-black/55">
            Taken out of this day, not out of what you want.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {setAside.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-[15px] font-semibold text-[#111]">
                  {a.title}
                </span>
                {controls?.onRestore && (
                  <button
                    type="button"
                    data-testid="go-put-back"
                    onClick={() => controls.onRestore?.(a.id)}
                    className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold ring-1 ring-black/20 ring-inset hover:ring-black/50"
                  >
                    Put it back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RouteNode({
  icon,
  children,
  testId,
}: {
  readonly icon: ReactNode;
  readonly children: ReactNode;
  readonly testId: string;
}) {
  return (
    <li data-testid={testId} className="relative flex items-start gap-3 py-2">
      <span
        className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#111] text-white"
        aria-hidden
      >
        {icon}
      </span>
      <p className="pt-1 text-[15px] leading-snug">{children}</p>
    </li>
  );
}

type Arriving = { readonly leg: Leg; readonly journey?: Journey };

function Move({
  stop,
  first,
  perMove,
  arriving,
}: {
  readonly stop: DayStop;
  readonly first: boolean;
  readonly perMove?: number;
  /** The leg arriving here, as Atlas answered it (or a straight line). */
  readonly arriving?: Arriving | undefined;
}) {
  if (stop.km === undefined && !arriving) {
    return first ? null : <MoveLine {...(perMove ? { perMove } : {})} />;
  }
  return (
    <MoveLine
      {...(stop.km !== undefined ? { km: stop.km } : {})}
      long={stop.longMove ?? false}
      {...(perMove ? { perMove } : {})}
      arriving={arriving}
      first={first}
    />
  );
}

/** A move between two points: a measured km and the plan's stated buffer. */
function MoveLine({
  km,
  perMove,
  long = false,
  arriving,
  first,
}: {
  readonly km?: number;
  readonly perMove?: number;
  readonly long?: boolean;
  /** When there is a leg, it speaks for the move: routed, or a straight line. */
  readonly arriving?: Arriving | undefined;
  readonly first?: boolean;
}) {
  const routed = arriving?.journey?.kind === "routed";
  return (
    <div
      data-testid="go-move"
      className="relative flex items-center gap-3 py-1.5 pl-[11px] text-[12px] text-black/45"
    >
      <span
        aria-hidden
        className="relative z-10 h-[10px] w-[10px] rounded-full border-2 border-black/25 bg-white"
      />
      <span>
        {arriving ? (
          <>
            <Check
              className="mr-1 inline h-3 w-3 text-emerald-700"
              aria-label="Stated"
            />
            <LegLine
              leg={arriving.leg}
              journey={arriving.journey}
              {...(first !== undefined ? { first } : {})}
            />
          </>
        ) : (
          km !== undefined && (
            <>
              <Check
                className="mr-1 inline h-3 w-3 text-emerald-700"
                aria-label="Stated"
              />
              {km < 1 ? "under 1 km" : `${Math.round(km)} km`} straight line
            </>
          )
        )}
        {(arriving || km !== undefined) && perMove ? " · " : ""}
        {perMove ? (
          <>
            <Sparkles
              className="mr-1 inline h-3 w-3"
              style={{ color: "var(--ghad-accent)" }}
              aria-label="Suggestion"
            />
            {perMove} min set aside to move
          </>
        ) : null}
        {long && !routed && (
          <span className="ml-1 font-semibold text-amber-800">
            — a long way; the road will take longer than that.
          </span>
        )}
      </span>
    </div>
  );
}

function StopCard({
  day,
  stop,
  index,
  controls,
  open,
  alternatives,
  when,
}: {
  readonly when?: Timeline["stops"][number];
  readonly day: DayPlanned;
  readonly stop: DayStop;
  readonly index: number;
  readonly controls?: StopControls;
  readonly open: boolean;
  readonly alternatives: readonly Alternative[];
}) {
  const href = destinationFor(stop.experience);
  const picture = stop.experience.heroMedia?.src;
  const age =
    day.brief.childAge !== undefined
      ? ageLine(stop.experience, day.brief.childAge)
      : undefined;
  const wet = day.weather?.wet ?? false;
  const last = index === day.stops.length - 1;

  return (
    <article
      data-testid="go-stop"
      id={`stop-${stop.experience.id}`}
      className="relative ml-[44px] scroll-mt-20 rounded-2xl bg-white p-4 ring-1 ring-black/10 sm:p-5"
      style={
        stop.kept
          ? { boxShadow: "inset 3px 0 0 var(--ghad-accent)" }
          : undefined
      }
    >
      <span
        className="ghad-display absolute top-4 -left-[44px] z-10 grid h-8 w-8 place-items-center rounded-full text-[15px] leading-none font-extrabold tabular-nums"
        style={{
          backgroundColor: "var(--ghad-accent)",
          color: "var(--ghad-accent-ink)",
        }}
      >
        {index + 1}
      </span>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr] sm:gap-5">
        {picture ? (
          <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-black/[0.04] sm:aspect-[4/3] sm:w-[200px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline */}
            <img
              src={picture}
              alt=""
              loading={index < 2 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className={picture ? "min-w-0" : "min-w-0 sm:col-span-2"}>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            {index === 0 ? "First" : last ? "And to finish" : "Then"}
            {stop.experience.geography?.locality
              ? ` · ${stop.experience.geography.locality}`
              : ""}
          </p>
          <h3 className="ghad-display mt-1 text-[20px] leading-[1.1] font-extrabold tracking-[-0.03em] text-[#111] sm:text-[24px]">
            {href ? (
              <Link href={href} className="hover:underline">
                {stop.experience.title}
              </Link>
            ) : (
              stop.experience.title
            )}
          </h3>

          {when && (
            <p
              data-testid="go-clock"
              data-basis={when.basis}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-3 py-1 text-[13px] font-semibold text-[#111]"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {when.basis === "allowance" ? "about " : ""}
              {clockLabel(when.arrive)}
              <span className="font-normal text-black/50">
                · until about {clockLabel(when.leave)}
              </span>
            </p>
          )}

          {/* ✦ Passport's own reasoning. */}
          <ul className="mt-2 flex flex-col gap-1">
            <Suggestion testId="go-because">{stop.because}</Suggestion>
            {stop.fit && <Suggestion testId="go-fit">{stop.fit}</Suggestion>}
            {/* **The plan's arithmetic, said as the plan's.** Not a claim
                about how long the place takes — nobody published that. */}
            <Suggestion testId="go-time">
              About {minutes(stop.minutes)} here —{" "}
              {stop.timeSet ? "the time you set" : "your hours, shared out"}.
            </Suggestion>
          </ul>

          {/* ✓ What is stated. */}
          <ul className="mt-2 flex flex-col gap-1" data-testid="go-facts">
            {stop.cost && <Fact>{stop.cost}</Fact>}
            {stop.open && <Fact>{stop.open}</Fact>}
            {stop.hours && <Fact>Published hours: {stop.hours}</Fact>}
            {stop.experience.schedule?.onDate?.reading === "conflicting" && (
              <Doubt testId="go-unconfirmed">
                Sources argue about whether this is open that day — call ahead.
              </Doubt>
            )}
            {age && <Fact>{age}</Fact>}
            {stop.rain === "stands" && (
              <Fact>Atlas: the rain doesn&apos;t stop this.</Fact>
            )}
            {stop.rain === "exposed" && <Fact>Atlas: out in the open.</Fact>}
            {stop.rain === "may-not-run" && (
              <Fact>Atlas: may not run in bad weather.</Fact>
            )}
            {stop.notes.map((note) => (
              <Fact key={note}>{note}</Fact>
            ))}
          </ul>

          {stop.challenge && (
            <p
              data-testid="go-challenge"
              className="mt-3 max-w-[56ch] border-l-2 pl-3 text-[15px] leading-relaxed text-[#111] italic"
              style={{ borderColor: "var(--ghad-accent)" }}
            >
              <span className="mr-1 text-[11px] font-semibold tracking-[0.1em] text-black/45 uppercase not-italic">
                Side quest
              </span>
              {stop.challenge}
            </p>
          )}

          {stop.rainPlan && (
            <div
              data-testid="go-rain-plan"
              className={`mt-3 rounded-xl p-3 text-[14px] leading-relaxed ${wet ? "bg-sky-50 ring-1 ring-sky-200" : "bg-black/[0.03]"}`}
            >
              <p className="flex items-start gap-2">
                <Umbrella
                  className="mt-0.5 h-4 w-4 shrink-0 text-sky-700"
                  aria-hidden
                />
                <span>
                  <span className="font-semibold text-[#111]">
                    {wet ? "Rain plan" : "If the weather turns"}:
                  </span>{" "}
                  {stop.rainPlan.experience.title}
                  {stop.rainPlan.km !== undefined &&
                    ` · ${stop.rainPlan.km < 1 ? "under 1 km" : `${Math.round(stop.rainPlan.km)} km`} from here`}
                  <span className="block text-[13px] text-black/55">
                    <Check
                      className="mr-1 inline h-3 w-3 text-emerald-700"
                      aria-label="Stated"
                    />
                    {stop.rainPlan.because}
                  </span>
                </span>
              </p>
              {controls && (
                <button
                  type="button"
                  data-testid={`go-use-rain-${index + 1}`}
                  onClick={() => controls.onRainPlan(index)}
                  className="mt-2 ml-6 inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-semibold text-sky-900 ring-1 ring-sky-300 ring-inset hover:bg-sky-100"
                >
                  Use the rain plan instead
                </button>
              )}
            </div>
          )}

          {controls && (
            <div
              className="mt-4 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={`Change ${stop.experience.title}`}
            >
              <Control
                testId={`go-keep-${index + 1}`}
                onClick={() => controls.onKeep(index)}
                pressed={stop.kept ?? false}
                label={stop.kept ? "Kept" : "Keep"}
                icon={<Pin className="h-3.5 w-3.5" />}
              />
              <Control
                testId={`go-replace-${index + 1}`}
                onClick={() => controls.onSwap(index)}
                pressed={open}
                label="Swap"
                icon={<Shuffle className="h-3.5 w-3.5" />}
              />
              <Control
                testId={`go-less-${index + 1}`}
                onClick={() => controls.onTime(index, -15)}
                label="Less time"
                icon={<Minus className="h-3.5 w-3.5" />}
                iconOnly
              />
              <Control
                testId={`go-more-${index + 1}`}
                onClick={() => controls.onTime(index, 15)}
                label="More time"
                icon={<Plus className="h-3.5 w-3.5" />}
                iconOnly
              />
              <Control
                testId={`go-up-${index + 1}`}
                onClick={() => controls.onMove(index, -1)}
                label="Earlier"
                icon={<ArrowUp className="h-3.5 w-3.5" />}
                iconOnly
                disabled={index === 0}
              />
              <Control
                testId={`go-down-${index + 1}`}
                onClick={() => controls.onMove(index, 1)}
                label="Later"
                icon={<ArrowDown className="h-3.5 w-3.5" />}
                iconOnly
                disabled={last}
              />
              <Control
                testId={`go-remove-${index + 1}`}
                onClick={() => controls.onRemove(index)}
                label="Remove"
                icon={<X className="h-3.5 w-3.5" />}
                iconOnly
                disabled={day.stops.length <= 1}
              />
            </div>
          )}

          {open && controls && (
            <div
              data-testid="go-alternatives"
              className="mt-3 rounded-xl bg-black/[0.03] p-3"
            >
              <p className="text-[12px] font-semibold tracking-[0.08em] text-black/45 uppercase">
                Instead of {stop.experience.title}
              </p>
              {alternatives.length === 0 ? (
                <p className="mt-2 text-[14px] text-black/55">
                  Nothing else fits what you asked for. Try widening it —
                  &ldquo;go further&rdquo;, or fewer rules.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {alternatives.map((alt) => (
                    <li
                      key={alt.experience.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 ring-1 ring-black/10"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[#111]">
                          {alt.experience.title}
                          {alt.km !== undefined && (
                            <span className="font-normal text-black/45">
                              {" "}
                              ·{" "}
                              {alt.km < 1
                                ? "under 1 km"
                                : `${Math.round(alt.km)} km`}{" "}
                              from here
                            </span>
                          )}
                        </p>
                        <p className="text-[13px] text-black/55">
                          {alt.because}
                          {alt.cost ? ` · ${alt.cost}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid="go-choose"
                        onClick={() =>
                          controls.onChoose(index, alt.experience.id)
                        }
                        className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold"
                        style={{
                          backgroundColor: "var(--ghad-accent)",
                          color: "var(--ghad-accent-ink)",
                        }}
                      >
                        Use this
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Fact({ children }: { readonly children: ReactNode }) {
  return (
    <li className="flex max-w-[62ch] items-start gap-2 text-[14px] leading-relaxed text-black/65">
      <Check
        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-emerald-700"
        aria-label="Stated"
      />
      <span>{children}</span>
    </li>
  );
}

function Doubt({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <li
      data-testid={testId}
      className="flex max-w-[62ch] items-start gap-2 text-[14px] leading-relaxed text-amber-900"
    >
      <HelpCircle
        className="mt-[3px] h-3.5 w-3.5 shrink-0"
        aria-label="Not confirmed"
      />
      <span>{children}</span>
    </li>
  );
}

function Suggestion({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <li
      data-testid={testId}
      className="flex max-w-[62ch] items-start gap-2 text-[15px] leading-relaxed text-black/75"
    >
      <Sparkles
        className="mt-[4px] h-3.5 w-3.5 shrink-0"
        style={{ color: "var(--ghad-accent)" }}
        aria-label="Suggestion"
      />
      <span>{children}</span>
    </li>
  );
}

function Control({
  label,
  icon,
  onClick,
  testId,
  pressed,
  iconOnly = false,
  disabled = false,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
  readonly testId: string;
  readonly pressed?: boolean;
  readonly iconOnly?: boolean;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? label : undefined}
      title={label}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full text-[13px] font-semibold ring-1 transition-colors ring-inset disabled:opacity-30 sm:min-h-9 ${iconOnly ? "w-11 justify-center sm:w-9" : "px-3.5 sm:px-3"} ${pressed ? "bg-[#111] text-white ring-[#111]" : "text-black/65 ring-black/15 hover:ring-black/45"}`}
    >
      <span aria-hidden>{icon}</span>
      {!iconOnly && label}
    </button>
  );
}

/**
 * **Their hours, drawn.** Each stop's share, and the moves as one hatched
 * block — so "four stops in two hours" looks as cramped as it is before
 * anybody has to do the sum.
 */
function TimeBar({ day }: { readonly day: DayPlanned }) {
  const budget = day.budget!;
  const span = Math.max(
    budget.totalMinutes,
    budget.stopMinutes + budget.moveMinutes,
  );
  return (
    <div data-testid="go-time-bar" className="mt-6">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.05]"
        role="img"
        aria-label={`${minutes(budget.stopMinutes)} at stops and ${minutes(budget.moveMinutes)} set aside to move, of ${minutes(budget.totalMinutes)}`}
      >
        {day.stops.map((stop, i) => (
          <span
            key={stop.experience.id}
            className="h-full border-r-2 border-white"
            style={{
              width: `${(stop.minutes / span) * 100}%`,
              backgroundColor: "var(--ghad-accent)",
              opacity: 1 - i * 0.12,
            }}
          />
        ))}
        {budget.moveMinutes > 0 && (
          <span
            className="h-full"
            style={{
              width: `${(budget.moveMinutes / span) * 100}%`,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(0,0,0,.25) 0 3px, transparent 3px 7px)",
            }}
          />
        )}
      </div>
      <p className="mt-2 text-[13px] text-black/55">
        <span className="font-semibold text-[#111]">
          {minutes(budget.totalMinutes)}
        </span>
        {budget.hoursAssumed && " (assumed — say how long you've got)"}:{" "}
        {minutes(budget.stopMinutes)} at {day.stops.length}{" "}
        {day.stops.length === 1 ? "stop" : "stops"}
        {budget.moves > 0 &&
          `, ${minutes(budget.moveMinutes)} set aside to move`}
        .
        {budget.overBy > 0 && (
          <span
            data-testid="go-over"
            className="ml-1 font-semibold text-amber-800"
          >
            That runs {minutes(budget.overBy)} past your hours — trim a stop or
            take some time off one.
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * **Will you be home when you said?** In the person's words, with the doubt
 * attached: on the plan's allowance for the roads (not measured ones) it can
 * only say *tight* or *over*, never *fine*.
 */
function Verdict({ timeline }: { readonly timeline: Timeline }) {
  if (!timeline.verdict || timeline.homeBy === undefined) return null;
  const by = clockLabel(timeline.homeBy);
  const slack = timeline.slack ?? 0;
  const late = Math.abs(slack);
  const text =
    timeline.verdict === "over"
      ? `On what is measured and planned, you're home about ${minutes(late)} after ${by}. Take time off a stop, or drop one.`
      : timeline.verdict === "tight"
        ? timeline.basis === "allowance"
          ? `${slack < 5 ? `Home by ${by} only just works` : `Home by ${by} with about ${minutes(slack)} spare`}, on the plan's own allowance for the roads — nobody has measured them, so it could go either way.`
          : `Home by ${by}, with only ${minutes(slack)} to spare.`
        : `Home by ${by}, with ${minutes(slack)} to spare on Atlas's route times.`;
  return (
    <p
      data-testid="go-verdict"
      data-verdict={timeline.verdict}
      className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[14px] leading-relaxed ${timeline.verdict === "over" ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200" : "bg-black/[0.03] text-black/70"}`}
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

/** **The day in one glance**: where you'd be, when. Each line jumps to its card. */
function Glance({
  day,
  timeline,
}: {
  readonly day: DayPlanned;
  readonly timeline: Timeline;
}) {
  return (
    <ol
      data-testid="go-glance"
      aria-label="The day at a glance"
      className="mt-3 flex flex-col gap-0.5 rounded-xl bg-black/[0.03] p-3 text-[14px]"
    >
      {day.stops.map((stop, i) => {
        const t = timeline.stops[i]!;
        return (
          <li key={stop.experience.id}>
            <a
              href={`#stop-${stop.experience.id}`}
              className="flex min-h-11 items-baseline gap-3 py-2"
            >
              <span className="w-[5.5rem] shrink-0 font-semibold text-[#111] tabular-nums">
                {clockLabel(t.arrive)}
                {t.basis === "allowance" ? "~" : ""}
              </span>
              <span className="min-w-0 truncate text-black/75">
                {stop.experience.title}
              </span>
            </a>
          </li>
        );
      })}
      <li className="pt-1 text-[12px] text-black/45">
        {timeline.basis === "allowance"
          ? "~ means about: that move is the plan's own allowance, not a measured road, so it could be shorter or longer."
          : "Times use Atlas's route estimates between stops."}
        {timeline.fromNow && " Counting from now."}
      </li>
    </ol>
  );
}

/** Published prices, in the publisher's words, never totalled. */
function MoneyLine({ day }: { readonly day: DayPlanned }) {
  const money = day.money!;
  const parts: string[] = [];
  for (const p of money.priced) parts.push(`${p.title}: ${p.cost}`);
  if (money.free.length > 0)
    parts.push(`${money.free.join(", ")}: published as free`);
  if (money.unpublished > 0)
    parts.push(
      `${money.unpublished} ${money.unpublished === 1 ? "publishes" : "publish"} nothing about price`,
    );
  return (
    <p data-testid="go-money" className="mt-2 text-[13px] text-black/55">
      <span className="font-semibold text-[#111]">
        {money.budget === undefined
          ? "Money"
          : money.budget === 0
            ? "Free only"
            : `Your $${money.budget}`}
      </span>
      {" — "}
      {parts.join(" · ")}.
    </p>
  );
}

const minutes = (m: number): string => {
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  const h = `${hours} h`;
  return rest === 0 ? h : `${h} ${rest} min`;
};
