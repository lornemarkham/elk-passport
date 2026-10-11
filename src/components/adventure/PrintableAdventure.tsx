"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Wordmark } from "@/components/ghad/Wordmark";
import { ThemeProvider } from "@/components/ghad/theme";
import {
  BASIS_LABEL,
  kmLine,
  minutesLine,
  type Basis,
  type PrepItem,
  type PrintableAdventure as Adventure,
  type PrintableStop,
} from "@/lib/analog/printable";
import { PocketCard, RouteSection, WeatherSection } from "./FieldGuide";
import { Box, H2, H3, Rule } from "./paper";

/**
 * **The printable adventure.**
 *
 * Typeset for paper first and a phone second. The phone is for the minute
 * before printing. One column, white ground, black rules, no fills, so a
 * home printer spends its ink on words. Built on the decisions in
 * `components/go/AnalogGuide.tsx` (numbered stops, published-or-not, a
 * map link to open before leaving, a challenge, checkboxes, ruled lines) and
 * adds what a day needs before it starts: a checklist, the time and money at
 * a glance, the route and the weather (`FieldGuide.tsx`), optional side
 * quests, real room to write, and a card to cut out and carry.
 *
 * ## A4 and Letter
 *
 * No `@page size`. The printer's paper wins. The content is a single fluid
 * column inside 14 mm margins, which fits A4's narrower width and Letter's
 * shorter height. Nothing has a fixed height except the ruled lines and the
 * drawing box, and every section refuses to break across a page.
 *
 * ## Type
 *
 * 16 px body on screen, never under 14 px. 11 pt on paper, never under 9 pt.
 * Text is `#111` or `#444` on white. Both clear WCAG AA by a wide margin.
 * The faint greys the rest of the app uses for secondary text don't survive a
 * cheap printer and are not used here.
 */
export function PrintableAdventure({
  adventure,
  backHref = "/go",
}: {
  readonly adventure: Adventure;
  readonly backHref?: string;
}) {
  if (adventure.stops.length === 0) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <p className="mx-auto max-w-[42rem] text-[16px] text-[#444]">
          This adventure has no stops yet.{" "}
          <Link href="/go" className="font-semibold text-[#111] underline">
            Build a day first.
          </Link>
        </p>
      </main>
    );
  }

  const groups: readonly { basis: Basis; heading: string }[] = [
    { basis: "check", heading: "Find out before you leave" },
    { basis: "published", heading: "What the places say" },
    { basis: "suggested", heading: "Bring" },
  ];

  return (
    <ThemeProvider>
      <main
        data-testid="printable-adventure"
        className="adventure min-h-screen bg-white px-5 py-8 text-[16px] text-[#111] sm:px-10 sm:py-14"
      >
        <div className="mx-auto max-w-[46rem]">
          <div className="no-print mb-10 flex flex-col gap-4 border-b border-[#ccc] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[15px] leading-relaxed text-[#444]">
                Print this, fold it, and put your phone away.
              </p>
              <p className="mt-1 text-[14px] text-[#444]">
                Fits A4 or Letter. No background graphics needed.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={backHref}
                className="inline-flex min-h-11 items-center px-2 text-[15px] font-semibold text-[#444] underline-offset-4 hover:text-[#111] hover:underline"
              >
                Back
              </Link>
              <button
                type="button"
                data-testid="guide-print"
                onClick={() => window.print()}
                style={{
                  backgroundColor: "var(--ghad-accent)",
                  color: "var(--ghad-accent-ink)",
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[16px] font-semibold focus-visible:ring-2 focus-visible:ring-[#111] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Print Your Adventure
              </button>
            </div>
          </div>

          <header>
            <div className="flex items-start justify-between gap-6">
              <Wordmark size="normal" lines={2} href="/go" />
              <p className="text-right text-[12px] font-semibold tracking-[0.12em] text-[#444] uppercase">
                Field guide
                {adventure.dateLine && (
                  <>
                    <br />
                    <span className="tracking-normal normal-case tabular-nums">
                      {adventure.dateLine}
                    </span>
                  </>
                )}
              </p>
            </div>

            {adventure.sample && (
              <p
                data-testid="adventure-sample-note"
                className="mt-6 border border-[#111] px-3 py-2 text-[14px] leading-relaxed"
              >
                <strong>Sample adventure.</strong> The places are real. The plan
                is an example built by the same planner as{" "}
                <Link href="/go" className="underline">
                  Go have a day
                </Link>
                , and no hours or prices are published in it, so every stop says
                to check.
              </p>
            )}

            <h1
              data-testid="guide-title"
              className="ghad-display mt-8 text-[30px] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance sm:text-[44px]"
            >
              {adventure.title}
            </h1>
            <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-[#333]">
              {adventure.opening}
            </p>
            {adventure.said && (
              <p className="mt-4 max-w-[60ch] border-l-2 border-[#111] pl-3 text-[15px] leading-relaxed text-[#444] italic">
                You said: {adventure.said}
              </p>
            )}
          </header>

          <AtAGlance adventure={adventure} />

          <RouteSection route={adventure.route} />

          <WeatherSection weather={adventure.weather} />

          <section
            aria-labelledby="prep-heading"
            data-testid="adventure-prep"
            className="mt-10 border-t-2 border-[#111] pt-5"
          >
            <h2 id="prep-heading" className={H2}>
              Before you go
            </h2>
            <div className="mt-3 grid gap-6 sm:grid-cols-3 print:grid-cols-3">
              {groups.map(({ basis, heading }) => {
                const items = adventure.prep.filter((i) => i.basis === basis);
                if (items.length === 0) return null;
                return (
                  <div key={basis}>
                    <h3 className={H3}>{heading}</h3>
                    <ul className="mt-2 flex flex-col gap-2.5">
                      {items.map((item) => (
                        <PrepLine key={item.id} item={item} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="day-heading" className="mt-10">
            <h2
              id="day-heading"
              className={`${H2} border-t-2 border-[#111] pt-5`}
            >
              The day
            </h2>
            <ol className="mt-2">
              {adventure.stops.map((stop) => (
                <Stop key={stop.id} stop={stop} />
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="quests-heading"
            data-testid="adventure-quests"
            className="section mt-8 border-t-2 border-[#111] pt-5"
          >
            <h2 id="quests-heading" className={H2}>
              Side quests
            </h2>
            <p className="mt-1 text-[14px] text-[#444]">
              Optional, all day, anywhere. Tick what you managed.
            </p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 print:grid-cols-2">
              {adventure.sideQuests.map((quest) => (
                <li
                  key={quest.id}
                  className="flex items-start gap-2.5 text-[15px] leading-snug"
                >
                  <Box />
                  {quest.prompt}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="memories-heading"
            data-testid="adventure-memories"
            className="mt-8 border-t-2 border-[#111] pt-5"
          >
            <h2 id="memories-heading" className={H2}>
              What actually happened
            </h2>
            <p className="mt-1 text-[14px] text-[#444]">
              Write on this. That is what it is for.
            </p>
            <div className="section mt-4 grid grid-cols-[auto_1fr] items-end gap-x-3 gap-y-3 text-[14px]">
              <span className="font-semibold">Date</span>
              <Rule />
              <span className="font-semibold">Who came</span>
              <Rule />
            </div>
            {adventure.memoryPrompts.map((prompt) => (
              <div key={prompt} className="section mt-5">
                <p className="text-[15px] font-semibold">{prompt}</p>
                <Rule />
                <Rule />
              </div>
            ))}
            {adventure.childAge !== undefined && adventure.childAge <= 12 && (
              <div className="section mt-6">
                <p className="text-[15px] font-semibold">
                  Draw the best thing you saw
                </p>
                <div
                  aria-hidden
                  data-testid="adventure-draw"
                  className="draw mt-2 h-56 border-2 border-[#111]"
                />
              </div>
            )}
          </section>

          {/* The card sits beside the last words, so it costs no page of its
              own. Half a sheet wide is a pocket's width anyway. */}
          <div className="mt-10 grid gap-8 border-t-2 border-[#111] pt-6 sm:grid-cols-2 print:grid-cols-2">
            <div>
              <p
                data-testid="guide-closing"
                className="ghad-display section text-[20px] leading-[1.15] font-extrabold tracking-[-0.02em] text-balance sm:text-[24px]"
              >
                {adventure.closing}
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-[#444]">
                {adventure.route.attribution.length > 0
                  ? "Travel times are a routing provider's estimate; every other distance is a straight line, not a road."
                  : "Distances are straight lines, not roads. Nothing on this page is a drive time."}{" "}
                Hours, prices and rules appear only where a place has published
                them, in its own words.
              </p>
            </div>
            <PocketCard adventure={adventure} />
          </div>
        </div>

        {/* A plain <style>, not styled-jsx: in the App Router styled-jsx is
            injected on hydration, so a page printed before the script ran
            (or with scripts off) printed its own toolbar. This is in the
            server HTML. */}
        <style>{PRINT_CSS}</style>
      </main>
    </ThemeProvider>
  );
}

const PRINT_CSS = `
  /*
   * Paper is not a small screen. The printer sets the paper size,
   * ink is expensive, and a page break through the middle of a stop
   * makes the guide useless in a car.
   */
  @media print {
    @page {
      margin: 14mm;
    }
    /* Anything pinned to the viewport (the admin pill) would print
       over the top of the words. */
    .no-print,
    body .fixed,
    nav {
      display: none !important;
    }
    html,
    body {
      background: #fff !important;
      color: #000 !important;
    }
    .adventure {
      padding: 0 !important;
      min-height: 0 !important;
      font-size: 11pt;
    }
    .adventure a {
      color: inherit;
      text-decoration: none;
    }
    .adventure .screen-only {
      display: none !important;
    }
    .adventure .print-only {
      display: inline !important;
    }
    .adventure h1 {
      font-size: 26pt !important;
    }
    .adventure h2,
    .adventure h3 {
      break-after: avoid;
    }
    /* Small units only. Avoiding a break inside a whole section pushes
       it to the next page and leaves half a sheet blank. */
    .adventure .section,
    .adventure li {
      break-inside: avoid;
    }
    .adventure .draw {
      height: 45mm;
    }
  }
`;

function PrepLine({ item }: { readonly item: PrepItem }) {
  return (
    <li
      data-testid="adventure-prep-item"
      data-basis={item.basis}
      className="flex items-start gap-2.5"
    >
      <Box />
      <span className="text-[15px] leading-snug">
        <span className="font-semibold">{item.label}</span>
        <span className="sr-only"> ({BASIS_LABEL[item.basis]})</span>
        {item.why && (
          <span className="mt-0.5 block text-[14px] leading-snug text-[#444]">
            {item.why}
          </span>
        )}
      </span>
    </li>
  );
}

function AtAGlance({ adventure }: { readonly adventure: Adventure }) {
  const { time, budget } = adventure;
  return (
    <section
      aria-labelledby="glance-heading"
      data-testid="adventure-glance"
      className="section mt-10 border-t-2 border-[#111] pt-5"
    >
      <h2 id="glance-heading" className={H2}>
        At a glance
      </h2>
      <div className="mt-3 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <h3 className={H3}>Time</h3>
          <p
            data-testid="adventure-time"
            className="mt-1.5 text-[15px] leading-relaxed"
          >
            {time.statedHours !== undefined
              ? `Your ${hoursWord(time.statedHours)}`
              : `You didn't say how long, so this plan assumes ${hoursWord(time.plannedHours)}`}
            , split across {time.stopCount}{" "}
            {time.stopCount === 1 ? "stop" : "stops"}: about{" "}
            {minutesLine(time.minutesPerStop)} each.
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#444]">
            Getting between stops comes out of that time. Passport can&apos;t
            say how much. It has no road routing.
          </p>
          <p
            data-testid="adventure-distance"
            className="mt-1.5 text-[14px] leading-relaxed text-[#444]"
          >
            {time.measuredKm !== undefined
              ? `${kmLine(time.measuredKm)} in straight lines across the measured legs`
              : "No distances measured"}
            {time.unmeasuredLegs > 0 &&
              `${time.measuredKm !== undefined ? ";" : ":"} ${time.unmeasuredLegs} ${
                time.unmeasuredLegs === 1 ? "leg has" : "legs have"
              } no position to measure from`}
            .
          </p>
        </div>
        <div>
          <h3 className={H3}>Money</h3>
          <p
            data-testid="adventure-budget"
            className="mt-1.5 text-[15px] leading-relaxed"
          >
            {budget.statedBudget !== undefined
              ? budget.statedBudget === 0
                ? "You asked for free."
                : `You said about $${budget.statedBudget}, for everybody.`
              : "You didn't set a budget."}
          </p>
          {budget.published.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1 text-[14px] leading-relaxed">
              {budget.published.map((p) => (
                <li key={p.title}>
                  <span className="font-semibold">{p.title}:</span> {p.cost}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#444]">
            {budget.unpublished.length === 0
              ? "Every stop publishes a price. "
              : budget.published.length === 0
                ? "No stop here publishes a price. "
                : `${budget.unpublished.length} of ${
                    budget.published.length + budget.unpublished.length
                  } stops publish no price. `}
            {budget.published.length > 0
              ? "Prices are in each place's own words, so Passport doesn't add them up."
              : "Passport won't guess one."}
          </p>
        </div>
      </div>
    </section>
  );
}

const hoursWord = (h: number) =>
  h === 1 ? "one hour" : h === 0.5 ? "half an hour" : `${h} hours`;

function Stop({ stop }: { readonly stop: PrintableStop }) {
  return (
    <li
      data-testid="guide-stop"
      className="section border-t border-[#111] py-6 first:border-t-0"
    >
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden
          className="ghad-display text-[26px] leading-none font-extrabold tabular-nums"
        >
          {stop.number}
        </span>
        <h3 className="ghad-display text-[22px] leading-[1.08] font-extrabold tracking-[-0.02em] sm:text-[26px]">
          <span className="sr-only">Stop {stop.number}: </span>
          {stop.title}
        </h3>
      </div>

      <p className="mt-1.5 text-[14px] font-semibold text-[#444]">
        {stop.where && <>{stop.where} · </>}About {minutesLine(stop.minutes)}{" "}
        here
        {stop.km !== undefined
          ? ` · ${kmLine(stop.km)} ${stop.number === 1 ? "from the start" : "from the last stop"}, straight line`
          : " · distance not measured"}
      </p>

      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-[#222]">
        {stop.because}
      </p>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[14px] leading-snug">
        <dt className="font-semibold">Cost</dt>
        <dd className="text-[#222]">
          {stop.cost ?? "Not published. Ask, or check their site."}
        </dd>
        <dt className="font-semibold">Open</dt>
        <dd className="text-[#222]" data-testid="adventure-open">
          {stop.open || stop.hours ? (
            <>
              {stop.open}
              {stop.open && stop.hours && " "}
              {stop.hours && <>Published hours: {stop.hours}</>}
              <span className="sr-only"> ({BASIS_LABEL.published})</span>
            </>
          ) : (
            "Hours not published. Worth a call first."
          )}
        </dd>
        {stop.published.map((fact) => (
          <PublishedRow key={fact.label + fact.value} {...fact} />
        ))}
        {stop.rain && (
          <>
            <dt className="font-semibold">Rain</dt>
            <dd className="text-[#222]" data-testid="adventure-stop-rain">
              {stop.rain.line}
              {stop.rain.because && (
                <span className="text-[#444]">
                  {" "}
                  (&ldquo;{stop.rain.because}&rdquo;)
                </span>
              )}
            </dd>
          </>
        )}
        <dt className="font-semibold">Directions</dt>
        <dd className="text-[#222]">
          {stop.directions ? (
            <>
              <a
                className="screen-only underline"
                href={stop.directions}
                target="_blank"
                rel="noreferrer"
              >
                Open the map before you leave
              </a>
              {/* A URL can't be typed off paper. What you'd search for can. */}
              {stop.findBy && (
                <span className="print-only hidden">
                  Search a map for {stop.findBy}
                </span>
              )}
            </>
          ) : (
            "No published location. Ask locally."
          )}
        </dd>
      </dl>

      {stop.notes.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1">
          {stop.notes.map((note) => (
            <li
              key={note}
              className="max-w-[62ch] text-[14px] leading-relaxed text-[#222]"
            >
              <span className="font-semibold">Rule: </span>
              {note}
            </li>
          ))}
        </ul>
      )}

      {stop.alsoHere.length > 0 && (
        <p
          data-testid="adventure-also-here"
          className="mt-2.5 max-w-[62ch] text-[14px] leading-relaxed text-[#444]"
        >
          <span className="font-semibold text-[#111]">
            If there&apos;s time:{" "}
          </span>
          {stop.alsoHere.join(" · ")}
        </p>
      )}

      {stop.challenge && (
        <p
          data-testid="guide-challenge"
          className="mt-3 max-w-[58ch] text-[15px] leading-relaxed italic"
        >
          <span className="font-semibold not-italic">Try this: </span>
          {stop.challenge}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
        {["We went", "Skipped it", "Worth going back"].map((label) => (
          <span key={label} className="inline-flex items-center gap-2">
            <Box />
            {label}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[auto_1fr] items-end gap-x-3 text-[14px]">
        <span className="font-semibold">Notes</span>
        <Rule />
      </div>
    </li>
  );
}

function PublishedRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <>
      <dt className="font-semibold">{label}</dt>
      <dd className="text-[#222]" data-testid="adventure-published">
        {value}
        <span className="sr-only"> ({BASIS_LABEL.published})</span>
      </dd>
    </>
  );
}
