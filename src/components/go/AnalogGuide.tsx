"use client";

import { Printer } from "lucide-react";
import type { DayPlanned, DayStop } from "@/domain/day/build";
import { Wordmark } from "@/components/ghad/Wordmark";
import { ThemeProvider } from "@/components/ghad/theme";
import type { Journey, TravelMode } from "@/lib/routing/journey";
import type { TravelStatus } from "@/lib/routing/useTravelTimes";
import { shownLeg, travelTotal, type Leg } from "@/lib/routing/legs";
import { dayLegs, unknownsWithTravel } from "@/lib/routing/dayLegs";
import { LegLine } from "@/components/maps/LegLine";
import { TravelSummary } from "@/components/maps/TravelSummary";

/**
 * **The analog adventure guide.**
 *
 * A keepsake, not a spreadsheet — which in practice means it is typeset for
 * paper rather than screenshotted from a web page. Ink-economical, one column,
 * generous margins, real rules, and room to write on.
 *
 * ## What it carries, and why each thing is on it
 *
 * ```
 * the title          so it is YOUR day and not "Itinerary (1)"
 * the sentence       what you asked for, quoted back, so you can tell
 * each stop          name, town, address where published, what to do there
 * travel             Atlas's routed time per leg and in all, credited to
 *                    its provider; a straight line, labelled, where none
 * what is published  hours and prices, where a place has actually said
 * what is not        printed, because paper cannot look it up later
 * a challenge        something to do that is not looking at a phone
 * checkboxes         the point of paper
 * notes              the other point of paper
 * a closing line     so it ends like a day and not like a receipt
 * ```
 *
 * ## The map
 *
 * There is no offline map here and the page does not pretend otherwise. A
 * tiled map needs a provider, a key and a licence — a paid external API, which
 * this mission says not to add without identifying the cost first. What a
 * person can actually use is on the paper instead: the town, the published
 * address, a straight-line bearing-free distance, and **a map link to open
 * before leaving**, which is when a phone is still the right tool.
 */
export function AnalogGuide({
  day,
  travel,
}: {
  readonly day: DayPlanned;
  /**
   * What Atlas said about each leg when the page was rendered, aligned with
   * `dayLegs(day).legs`. Asked once on the server: paper does not refresh.
   */
  readonly travel?: {
    readonly mode: TravelMode;
    readonly status: TravelStatus;
    readonly journeys: readonly (Journey | undefined)[];
  };
}) {
  const { legs, into, home } = dayLegs(day);
  const mode = travel?.mode ?? "driving";
  const status = travel?.status ?? "idle";
  const journeys = travel?.journeys ?? legs.map(() => undefined);
  const total = travelTotal(legs, journeys, mode);
  const unknowns = unknownsWithTravel(day.unknowns, status, total);
  const planned = day.stops.reduce((sum, stop) => sum + stop.minutes, 0);
  const legAt = (i: number | undefined) =>
    i === undefined
      ? undefined
      : { leg: legs[i]!, journey: shownLeg(legs[i]!, journeys[i]) };

  if (day.stops.length === 0) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <p className="mx-auto max-w-[42rem] text-[16px] text-black/60">
          This guide has no stops. Go back and build a day first.
        </p>
      </main>
    );
  }

  return (
    <ThemeProvider>
      {/* White, not the app's textured ground: this page is a sheet of paper
          that happens to be on a screen for a moment. */}
      <main className="guide min-h-screen bg-white px-6 py-10 text-[#111] sm:px-10 sm:py-14">
        <div className="mx-auto max-w-[46rem]">
          {/* The one control, and it is gone the moment the paper exists. */}
          <div className="no-print mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-6">
            <p className="text-[14px] text-black/55">
              Print this, fold it, and put your phone away.
            </p>
            <button
              type="button"
              data-testid="guide-print"
              onClick={() => window.print()}
              style={{
                backgroundColor: "var(--ghad-accent)",
                color: "var(--ghad-accent-ink)",
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-semibold"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
          </div>

          <header>
            <div className="flex items-start justify-between gap-6">
              <Wordmark size="normal" lines={2} href="/go" />
              <p className="text-right text-[11px] font-semibold tracking-[0.12em] text-black/45 uppercase">
                Adventure guide
                {day.brief.on && (
                  <>
                    <br />
                    <span className="tabular-nums">{day.brief.on}</span>
                  </>
                )}
              </p>
            </div>

            <h1
              data-testid="guide-title"
              className="ghad-display mt-8 text-[32px] leading-[0.98] font-extrabold tracking-[-0.04em] text-balance sm:text-[44px]"
            >
              {day.title}
            </h1>
            <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-black/70">
              {day.opening}
            </p>
            {day.brief.said && (
              <p className="mt-4 max-w-[54ch] border-l-2 border-black/20 pl-3 text-[14px] leading-relaxed text-black/50 italic">
                You said: {day.brief.said}
              </p>
            )}
            <TravelSummary
              legs={legs}
              answers={journeys}
              status={status}
              mode={mode}
              planned={planned}
            />
          </header>

          <ol className="mt-10">
            {day.stops.map((stop, index) => (
              <Stop
                key={stop.experience.id}
                stop={stop}
                index={index}
                arriving={legAt(into[index])}
              />
            ))}
          </ol>

          {home !== undefined && (
            <p
              data-testid="guide-home-leg"
              className="border-t-2 border-black/80 py-4 text-[13px] font-semibold text-black/60"
            >
              <LegLine leg={legs[home]!} journey={legAt(home)!.journey} />
            </p>
          )}

          <section className="mt-10 break-inside-avoid border-t-2 border-black/80 pt-5">
            <h2 className="ghad-display text-[18px] font-extrabold tracking-[-0.02em] uppercase">
              Check before you go
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {unknowns.map((unknown) => (
                <li
                  key={unknown}
                  className="text-[14px] leading-relaxed text-black/70"
                >
                  {unknown}
                </li>
              ))}
              <li className="text-[14px] leading-relaxed text-black/70">
                Phone charged and in a pocket, for getting home rather than for
                looking things up.
              </li>
            </ul>
          </section>

          <section className="mt-8 break-inside-avoid">
            <h2 className="ghad-display text-[18px] font-extrabold tracking-[-0.02em] uppercase">
              What actually happened
            </h2>
            <p className="mt-1 text-[13px] text-black/45">
              Write on this. That is what it is for.
            </p>
            <div className="mt-3" aria-hidden>
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="block h-8 border-b border-black/20" />
              ))}
            </div>
          </section>

          <p
            data-testid="guide-closing"
            className="ghad-display mt-10 border-t-2 border-black/80 pt-6 text-[20px] leading-[1.15] font-extrabold tracking-[-0.02em] text-balance sm:text-[24px]"
          >
            {day.closing}
          </p>
        </div>
        <style jsx global>{`
          /**
           * Paper is not a small screen. Ink is expensive, margins are set by
           * the printer, and a page break through the middle of a stop makes
           * the guide useless in a car.
           */
          @media print {
            .no-print {
              display: none !important;
            }
            @page {
              margin: 14mm;
            }
            html,
            body {
              background: #fff !important;
            }
            .guide {
              max-width: none;
              padding: 0 !important;
              font-size: 11pt;
            }
            .guide a {
              text-decoration: none;
              color: inherit;
            }
            /* The URL, printed once, so the link is usable off a page. */
            .guide .print-url::after {
              content: " (" attr(data-url) ")";
              font-size: 9pt;
              color: #555;
              word-break: break-all;
            }
            .break-inside-avoid {
              break-inside: avoid;
            }
          }
        `}</style>
      </main>
    </ThemeProvider>
  );
}

function Stop({
  stop,
  index,
  arriving,
}: {
  readonly stop: DayStop;
  readonly index: number;
  readonly arriving?: { readonly leg: Leg; readonly journey?: Journey };
}) {
  const geography = stop.experience.geography;
  const where = geography?.locality ?? stop.experience.venue?.locality;
  const point = geography?.coordinates;
  const mapHref = point
    ? `https://www.google.com/maps/search/?api=1&query=${point[1]},${point[0]}`
    : where
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${stop.experience.title}, ${where}`,
        )}`
      : undefined;

  return (
    <li
      data-testid="guide-stop"
      className="break-inside-avoid border-t-2 border-black/80 py-6"
    >
      <div className="flex items-baseline gap-3">
        <span className="ghad-display text-[26px] leading-none font-extrabold tabular-nums">
          {index + 1}
        </span>
        <h2 className="ghad-display text-[22px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[26px]">
          {stop.experience.title}
        </h2>
      </div>

      <p className="mt-1.5 text-[13px] font-semibold text-black/60">
        {where && <>{where} · </>}About {Math.round(stop.minutes / 15) * 15}{" "}
        minutes here
        {arriving && (
          <>
            {" · "}
            <LegLine
              leg={arriving.leg}
              journey={arriving.journey}
              first={index === 0}
            />
          </>
        )}
      </p>

      <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-black/75">
        {stop.because}
      </p>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="font-semibold text-black/50">Cost</dt>
        <dd className="text-black/75">
          {stop.cost ?? "Not published — ask at the door."}
        </dd>
        <dt className="font-semibold text-black/50">Open</dt>
        <dd className="text-black/75">
          {stop.open ?? "Hours not published — worth a call first."}
        </dd>
        {mapHref && (
          <>
            <dt className="font-semibold text-black/50">Directions</dt>
            <dd className="text-black/75">
              <a
                className="print-url underline"
                data-url={mapHref}
                href={mapHref}
                target="_blank"
                rel="noreferrer"
              >
                Open the map before you leave
              </a>
            </dd>
          </>
        )}
      </dl>

      {stop.notes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {stop.notes.map((note) => (
            <li
              key={note}
              className="max-w-[58ch] text-[13px] leading-relaxed text-black/60"
            >
              — {note}
            </li>
          ))}
        </ul>
      )}

      {stop.challenge && (
        <p
          data-testid="guide-challenge"
          className="mt-3 max-w-[52ch] text-[14px] leading-relaxed italic"
        >
          <span className="font-semibold not-italic">Try this: </span>
          {stop.challenge}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-black/55">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 w-4 border-2 border-black/70"
          />
          We went
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 w-4 border-2 border-black/70"
          />
          Worth going back
        </span>
      </div>
    </li>
  );
}
