"use client";

import Link from "next/link";
import { ArrowRight, Printer, Shuffle } from "lucide-react";
import type { OfflineDay } from "@/lib/detox/day";
import {
  PHONE_PLACES,
  STAKES,
  challengeById,
  defaultPact,
  redeal,
  stakeSentence,
  type Pact,
} from "@/lib/detox/pact";
import {
  leave,
  newOuting,
  postcard,
  withDay,
  withPact,
} from "@/lib/detox/outing";
import { updateOffline, useOffline } from "@/lib/detox/store";
import { PhoneAway } from "./PhoneAway";
import { PostcardView } from "./PostcardView";

/**
 * **Go Offline — the moment planning is finished.**
 *
 * GO HAVE A DAY goes *say it → build it → print it → go offline → come back*.
 * This is the fourth step, not a second front door: it does not plan, offer
 * its own doors into a planner, or print. A day arrives here with the same
 * query `/go/print` reads, and the page says the one thing nothing else
 * says — **that's the plan; there is nothing left to decide on a screen.**
 *
 * Then, in order:
 *
 * - **What stays on the phone.** The stops and their towns, kept locally
 *   when the phones go away, for if the paper blows away. Not the guide.
 * - **The pact, if anybody wants one.** Optional, and closed until somebody
 *   opens it. Skipping it costs nothing and leaves nothing behind.
 * - **"Phones away."** One button.
 *
 * ## What it reuses, and does not rebuild
 *
 * - **Planning** is `/go`. Arriving with no day gets one link there.
 * - **Printing** is `/go/print`, linked with the day's own query.
 *
 * ## Tone
 *
 * No guilt, no lecture, no screen-time number, no notification. The phone is
 * not the villain; it just isn't invited today.
 */
export function GoOffline({
  day: arrived,
  unreachable = false,
}: {
  /** The day handed over from planning, if one was. */
  readonly day?: OfflineDay;
  /** A day was handed over, but its details could not be read just now. */
  readonly unreachable?: boolean;
}) {
  const { current, past } = useOffline();
  const pact = current?.pact;
  const out = Boolean(current?.leftAt);
  // A day handed over wins; otherwise the one already kept, if any.
  const day = arrived ?? current?.day;

  const setPact = (next: Pact | undefined) =>
    updateOffline((state) => ({
      ...state,
      current: withPact(state.current ?? newOuting(), next),
    }));

  const goNow = () =>
    updateOffline((state) => ({
      ...state,
      current: leave(withDay(state.current ?? newOuting(), day), new Date()),
    }));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-12 lg:px-10">
      {out && (
        <Link
          href="/detox/back"
          data-testid="offline-out-banner"
          className="mb-8 flex items-center justify-between gap-3 rounded-2xl px-5 py-4 ring-2 ring-inset"
          style={
            { "--tw-ring-color": "var(--ghad-accent)" } as React.CSSProperties
          }
        >
          <span className="text-[15px] font-semibold text-[#111]">
            You&apos;re out there. Or back already? Tell us how it went.
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--ghad-accent)" }}
            aria-hidden
          />
        </Link>
      )}

      {/* ── Planning is finished ────────────────────────────────────── */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_280px]">
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--ghad-accent)" }}
          >
            Go offline
          </p>
          {day || unreachable ? (
            <>
              <h1 className="ghad-display mt-2 text-[44px] leading-[0.9] font-extrabold tracking-[-0.05em] text-[#111] sm:text-[84px]">
                That&apos;s
                <br />
                <span style={{ color: "var(--ghad-accent)" }}>the plan.</span>
              </h1>
              <p
                data-testid="offline-done"
                className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-black/65"
              >
                Planning&apos;s done. There&apos;s nothing left to decide on a
                screen — the rest gets decided out there.
              </p>
              {day ? (
                <PlanKept day={day} />
              ) : (
                <p
                  data-testid="offline-unreachable"
                  className="mt-6 max-w-[54ch] text-[15px] leading-relaxed text-black/55"
                >
                  We couldn&apos;t look the stops up just now, so there&apos;s
                  no copy on this phone. The paper has all of it.
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="ghad-display mt-2 text-[44px] leading-[0.9] font-extrabold tracking-[-0.05em] text-[#111] sm:text-[84px]">
                Got a
                <br />
                <span style={{ color: "var(--ghad-accent)" }}>plan?</span>
              </h1>
              <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-black/65">
                This is where planning stops. Build a day and print it first —
                or bring one you made yourself, on paper or in your head.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/go"
                  data-testid="offline-plan-first"
                  style={{
                    backgroundColor: "var(--ghad-accent)",
                    color: "var(--ghad-accent-ink)",
                  }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold"
                >
                  Go have a day
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#go"
                  className="inline-flex min-h-12 items-center px-5 text-[15px] font-semibold text-black/55 hover:text-[#111]"
                >
                  We&apos;ve already got one
                </a>
              </div>
            </>
          )}
        </div>
        <PhoneAway />
      </section>

      {/* ── The pact, if anybody wants one ─────────────────────────── */}
      <section
        id="pact"
        aria-labelledby="offline-pact"
        className="mt-16 scroll-mt-20 border-t border-black/10 pt-8"
      >
        <SectionHead
          id="offline-pact"
          step="Optional"
          title="Make it interesting?"
          lede={
            pact
              ? "Decide it together before anyone gets in the car. It's more fun with something on the line."
              : "Where the phones go, what the first one to crack owes, and three things to pull off out there. Skip it and nothing changes."
          }
        />

        {!pact ? (
          <button
            type="button"
            data-testid="offline-make-pact"
            onClick={() => setPact(defaultPact())}
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-[#111] ring-1 ring-black/20 ring-inset hover:ring-black/50"
          >
            Make a pact
          </button>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
              <fieldset>
                <legend className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
                  Where are the phones going?
                </legend>
                <div className="mt-3 flex flex-col gap-2">
                  {PHONE_PLACES.map((place) => (
                    <Choice
                      key={place.id}
                      name="offline-phone"
                      testId={`offline-phone-${place.id}`}
                      checked={pact.phone === place.id}
                      onChange={() => setPact({ ...pact, phone: place.id })}
                      label={place.label}
                      line={place.line}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
                  Whoever reaches for a phone first…
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STAKES.map((stake) => {
                    const on = pact.stake === stake.id;
                    return (
                      <button
                        key={stake.id}
                        type="button"
                        aria-pressed={on}
                        data-testid={`offline-stake-${stake.id}`}
                        onClick={() => setPact({ ...pact, stake: stake.id })}
                        style={
                          on
                            ? {
                                backgroundColor: "var(--ghad-accent)",
                                color: "var(--ghad-accent-ink)",
                              }
                            : undefined
                        }
                        className={`inline-flex min-h-11 items-center rounded-full px-4 text-left text-[14px] font-semibold ${
                          on
                            ? ""
                            : "text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/45"
                        }`}
                      >
                        …{stake.owes}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
                  Three things to pull off out there
                </p>
                <button
                  type="button"
                  data-testid="offline-redeal"
                  onClick={() => setPact(redeal(pact))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/45"
                >
                  <Shuffle className="h-4 w-4" aria-hidden />
                  Deal again
                </button>
              </div>
              <ul
                data-testid="offline-hand"
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {pact.challenges.map((id, index) => (
                  <li
                    key={id}
                    data-testid="offline-card"
                    className="flex min-h-36 flex-col justify-between rounded-2xl bg-[#111] p-5 text-white"
                    style={{
                      transform: `rotate(${TILT[index % TILT.length]}deg)`,
                    }}
                  >
                    <span className="ghad-display text-[19px] leading-[1.15] font-extrabold tracking-[-0.02em]">
                      {challengeById(id)?.line}
                    </span>
                    <span
                      className="mt-4 text-[11px] font-semibold tracking-[0.12em] uppercase"
                      style={{ color: "var(--ghad-accent)" }}
                    >
                      Card {index + 1} of {pact.challenges.length}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              data-testid="offline-drop-pact"
              onClick={() => setPact(undefined)}
              className="mt-8 inline-flex min-h-11 items-center text-[14px] font-semibold text-black/50 underline underline-offset-4 hover:text-[#111]"
            >
              No pact after all
            </button>
          </>
        )}
      </section>

      {/* ── Go ───────────────────────────────────────────────────────── */}
      <section
        id="go"
        aria-labelledby="offline-go"
        className="mt-16 scroll-mt-20 border-t-2 border-black/80 pt-8"
      >
        <h2
          id="offline-go"
          className="ghad-display text-[30px] leading-[1] font-extrabold tracking-[-0.04em] text-[#111] sm:text-[44px]"
        >
          Got the paper? Then go.
        </h2>
        <p
          data-testid="offline-stake-sentence"
          className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-black/60"
        >
          {pact
            ? `${stakeSentence(pact.stake)} Remember the three cards — reading them once is the last thing the phone has to do today.`
            : "Nothing to remember. That's what the paper is for."}
        </p>
        <Link
          href="/detox/out"
          data-testid="offline-go"
          onClick={goNow}
          style={{
            backgroundColor: "var(--ghad-accent)",
            color: "var(--ghad-accent-ink)",
          }}
          className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-full px-8 text-[17px] font-semibold"
        >
          Phones away
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <p className="mt-3 text-[13px] text-black/45">
          No reminders, no check-ins. We won&apos;t buzz you; come back when
          you&apos;re back.
        </p>
      </section>

      {/* ── The fridge ─────────────────────────────────────────────── */}
      {past.length > 0 && (
        <section
          aria-labelledby="offline-fridge"
          data-testid="offline-fridge"
          className="mt-16 border-t border-black/10 pt-8"
        >
          <h2
            id="offline-fridge"
            className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase"
          >
            On the fridge
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((outing, index) => (
              <li key={outing.back?.at ?? index}>
                <PostcardView
                  card={postcard(outing, new Date())}
                  {...(outing.back ? { date: outing.back.at } : {})}
                  small
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * The day that was printed, said back as a short list — and what this phone
 * will keep of it. Names and towns only: everything else is on the paper.
 */
function PlanKept({ day }: { readonly day: OfflineDay }) {
  return (
    <div className="mt-7">
      <ol data-testid="offline-plan" className="flex flex-col gap-1.5">
        {day.stops.map((stop, index) => (
          <li
            key={stop.id}
            data-testid="offline-plan-stop"
            className="flex items-baseline gap-3 text-[17px] text-[#111]"
          >
            <span
              className="ghad-display w-5 shrink-0 font-extrabold tabular-nums"
              style={{ color: "var(--ghad-accent)" }}
            >
              {index + 1}
            </span>
            <span>
              <span className="font-semibold">{stop.name}</span>
              {stop.where && (
                <span className="text-black/50"> · {stop.where}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p
        data-testid="offline-kept-note"
        className="mt-5 max-w-[54ch] text-[14px] leading-relaxed text-black/50"
      >
        When the phones go away we keep these names and towns on this phone, in
        case the paper blows away. Nothing is sent anywhere.
      </p>
      <Link
        href={`/go/print${day.print ? `?${day.print}` : ""}`}
        data-testid="offline-print-again"
        className="mt-3 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold text-[#111] underline underline-offset-4"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Haven&apos;t printed it yet?
      </Link>
    </div>
  );
}

/** A dealt hand should look dealt. */
const TILT = [-1.5, 1, -0.5] as const;

function SectionHead({
  id,
  step,
  title,
  lede,
}: {
  readonly id: string;
  readonly step: string;
  readonly title: string;
  readonly lede: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: "var(--ghad-accent)" }}
      >
        {step}
      </p>
      <h2
        id={id}
        className="ghad-display mt-2 text-[28px] leading-[1] font-extrabold tracking-[-0.04em] text-[#111] sm:text-[40px]"
      >
        {title}
      </h2>
      <p className="mt-3 max-w-[58ch] text-[16px] leading-relaxed text-black/60">
        {lede}
      </p>
    </div>
  );
}

function Choice({
  name,
  testId,
  checked,
  onChange,
  label,
  line,
}: {
  readonly name: string;
  readonly testId: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly label: string;
  readonly line: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-inset ${
        checked ? "ring-2" : "ring-1 ring-black/12 hover:ring-black/40"
      }`}
      style={
        checked
          ? ({ "--tw-ring-color": "var(--ghad-accent)" } as React.CSSProperties)
          : undefined
      }
    >
      <input
        type="radio"
        name={name}
        data-testid={testId}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4"
        style={{ accentColor: "var(--ghad-accent)" }}
      />
      <span>
        <span className="block text-[16px] font-semibold text-[#111]">
          {label}
        </span>
        <span className="block text-[14px] leading-relaxed text-black/55">
          {line}
        </span>
      </span>
    </label>
  );
}
