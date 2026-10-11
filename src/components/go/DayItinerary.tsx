"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { DayPlanned } from "@/domain/day/build";
import { destinationFor } from "@/domain/experience/destination";
import type { TravelMode } from "@/lib/routing/journey";
import { shownLeg, travelTotal } from "@/lib/routing/legs";
import { dayLegs, unknownsWithTravel } from "@/lib/routing/dayLegs";
import { useTravelLegs } from "@/lib/routing/useTravelLegs";
import { LegLine } from "@/components/maps/LegLine";
import { TravelSummary } from "@/components/maps/TravelSummary";
import { TravelModeSwitch } from "@/components/maps/TravelModeSwitch";

/**
 * **The day, on screen, before it is on paper.**
 *
 * Deliberately a sequence rather than a grid: a day has an order, and the
 * thing a person is deciding is whether *this whole shape* is worth leaving
 * the house for. Every stop links to its own entity page, so the evidence
 * behind any of it is one tap away and nothing here has to be taken on faith.
 *
 * **Travel between stops is Atlas's routed estimate, or a straight line that
 * says so** (`lib/routing`). Each leg is answered on its own, the total adds
 * only what was routed, and the provider is credited wherever a minute shows.
 */
export function DayItinerary({
  day,
  by = "driving",
  onBy,
}: {
  readonly day: DayPlanned;
  readonly by?: TravelMode;
  readonly onBy?: (mode: TravelMode) => void;
}) {
  const { legs, into, home } = useMemo(() => dayLegs(day), [day]);
  const travel = useTravelLegs(legs, by);
  const total = travelTotal(legs, travel.journeys, by);
  const unknowns = unknownsWithTravel(day.unknowns, travel.status, total);
  const planned = day.stops.reduce((sum, stop) => sum + stop.minutes, 0);

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

  return (
    <div>
      <h2 className="ghad-display max-w-[20ch] text-[26px] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance text-[#111] sm:text-[40px]">
        {day.title}
      </h2>
      <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-black/60">
        {day.opening}
      </p>

      {legs.length > 0 && (
        <div className="mt-5">
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

      <ol className="mt-8 flex flex-col">
        {day.stops.map((stop, index) => {
          const href = destinationFor(stop.experience);
          const leg = into[index];
          const picture = stop.experience.heroMedia?.src;
          return (
            <li
              key={stop.experience.id}
              data-testid="go-stop"
              className="grid grid-cols-1 gap-4 border-t border-black/10 py-6 sm:grid-cols-[auto_200px_1fr] sm:gap-6"
            >
              <span
                className="ghad-display text-[28px] leading-none font-extrabold tabular-nums"
                style={{ color: "var(--ghad-accent)" }}
              >
                {index + 1}
              </span>

              {picture ? (
                <div className="aspect-[4/3] w-full overflow-hidden bg-black/[0.04] sm:w-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline */}
                  <img
                    src={picture}
                    alt=""
                    loading={index < 2 ? "eager" : "lazy"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="hidden sm:block sm:w-[200px]" />
              )}

              <div className="min-w-0">
                <h3 className="ghad-display text-[20px] leading-[1.1] font-extrabold tracking-[-0.03em] text-[#111] sm:text-[24px]">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {stop.experience.title}
                    </Link>
                  ) : (
                    stop.experience.title
                  )}
                </h3>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-black/50">
                  {/* **The plan's arithmetic, said as the plan's.** Not a
                      claim about how long the place takes — nobody published
                      that, and "about an hour here" is their own hours
                      divided by their own stops. */}
                  <span>About {minutes(stop.minutes)} here</span>
                  {leg !== undefined && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      <LegLine
                        leg={legs[leg]!}
                        journey={shownLeg(legs[leg]!, travel.journeys[leg])}
                        first={index === 0}
                      />
                    </span>
                  )}
                  {stop.cost && <span>{stop.cost}</span>}
                </p>

                <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-black/70">
                  {stop.because}
                </p>

                {stop.open && (
                  <p className="mt-1.5 text-[14px] text-black/55">
                    {stop.open}
                  </p>
                )}

                {stop.notes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {stop.notes.map((note) => (
                      <li
                        key={note}
                        className="max-w-[62ch] text-[14px] leading-relaxed text-black/55"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                )}

                {stop.challenge && (
                  <p
                    data-testid="go-challenge"
                    className="mt-3 max-w-[56ch] border-l-2 pl-3 text-[15px] leading-relaxed text-[#111] italic"
                    style={{ borderColor: "var(--ghad-accent)" }}
                  >
                    {stop.challenge}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {home !== undefined && (
        <p
          data-testid="go-home-leg"
          className="flex items-center gap-1 border-t border-black/10 py-4 text-[13px] font-semibold text-black/50"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          <LegLine
            leg={legs[home]!}
            journey={shownLeg(legs[home]!, travel.journeys[home])}
          />
        </p>
      )}

      {/* **What the day does not know, printed with the day.** A guide that
          omits this reads exactly like one that checked. */}
      <section
        data-testid="go-unknowns"
        className="mt-2 border-t border-black/10 pt-5"
      >
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
          Worth checking before you go
        </h3>
        <ul className="mt-2 flex flex-col gap-1">
          {unknowns.map((unknown) => (
            <li
              key={unknown}
              className="max-w-[64ch] text-[14px] leading-relaxed text-black/55"
            >
              {unknown}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const minutes = (m: number): string => {
  if (m < 60) return `${m} minutes`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  const h = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return rest === 0 ? h : `${h} ${rest} min`;
};
