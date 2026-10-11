"use client";

import Link from "next/link";
import { ArrowRight, Printer, Shuffle } from "lucide-react";
import { OFFLINE_MODES } from "@/components/go/modes";
import {
  PHONE_PLACES,
  STAKES,
  challengeById,
  defaultPact,
  redeal,
  stakeSentence,
  type Pact,
} from "@/lib/detox/pact";
import { leave, newOuting, postcard, withPact } from "@/lib/detox/outing";
import { updateOffline, useOffline } from "@/lib/detox/store";
import { PhoneAway } from "./PhoneAway";
import { PostcardView } from "./PostcardView";

/**
 * **Go Offline — the front door.**
 *
 * Technology helps people find an adventure, then gets out of the way. This
 * page is the "gets out of the way" half made into something a person would
 * actually want to do: it explains the idea in three steps, hands planning
 * and printing to the routes that already do them, and adds the one thing
 * they don't have — a pact to make the phone-free part a game.
 *
 * ## What it reuses, and does not rebuild
 *
 * - **Planning** is `/go`. The doors are `OFFLINE_MODES` from
 *   `src/components/go/modes.ts`, linked as `/go?mode=…`, which `GoHaveADay`
 *   already reads as its opening sentence. No second parser, no second list.
 * - **Printing** is `/go/print` and `AnalogGuide`, reached from the day `/go`
 *   builds. Nothing here typesets paper.
 *
 * ## Tone
 *
 * No guilt, no lecture, no screen-time number. The phone is not the villain;
 * it just isn't invited today.
 */
export function GoOffline() {
  const { current, past } = useOffline();
  const pact: Pact = current?.pact ?? defaultPact();
  const out = Boolean(current?.leftAt);

  const setPact = (next: Pact) =>
    updateOffline((state) => ({
      ...state,
      current: state.current ? withPact(state.current, next) : newOuting(next),
    }));

  const goNow = () =>
    updateOffline((state) => ({
      ...state,
      current: leave(state.current ?? newOuting(pact), new Date()),
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

      {/* ── The hero ────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_280px]">
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--ghad-accent)" }}
          >
            Go offline
          </p>
          <h1 className="ghad-display mt-2 text-[44px] leading-[0.9] font-extrabold tracking-[-0.05em] text-[#111] sm:text-[84px]">
            Plan it.
            <br />
            Print it.
            <br />
            <span style={{ color: "var(--ghad-accent)" }}>Go.</span>
          </h1>
          <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-black/65">
            We find you a day made of real places and put it on paper. Then the
            phone goes in the glovebox and the rest is up to you, a full tank,
            and whoever&apos;s in the passenger seat.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#plan"
              data-testid="offline-start"
              style={{
                backgroundColor: "var(--ghad-accent)",
                color: "var(--ghad-accent-ink)",
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold"
            >
              Find us a day
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#pact"
              className="inline-flex min-h-12 items-center px-5 text-[15px] font-semibold text-black/55 hover:text-[#111]"
            >
              We&apos;ve already got a plan
            </a>
          </div>
        </div>
        <PhoneAway />
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section
        aria-labelledby="offline-how"
        className="mt-16 border-t border-black/10 pt-8"
      >
        <h2 id="offline-how" className="sr-only">
          How it works
        </h2>
        <ol className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span
                className="ghad-display text-[28px] leading-none font-extrabold tabular-nums"
                style={{ color: "var(--ghad-accent)" }}
              >
                {index + 1}
              </span>
              <h3 className="ghad-display mt-3 text-[22px] leading-[1.05] font-extrabold tracking-[-0.03em] text-[#111]">
                {step.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-black/60">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 1. Plan it ─────────────────────────────────────────────── */}
      <section
        id="plan"
        aria-labelledby="offline-plan"
        className="mt-16 scroll-mt-20 border-t border-black/10 pt-8"
      >
        <SectionHead
          id="offline-plan"
          step="Plan it"
          title="Pick a shape of day"
          lede="Each one builds a real day out of real places. You can change it in your own words, then print it from there."
        />
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OFFLINE_MODES.map((mode) => (
            <li key={mode.id}>
              <Link
                href={`/go?mode=${encodeURIComponent(mode.id)}`}
                data-testid={`offline-door-${mode.id}`}
                className="group block h-full rounded-2xl p-4 ring-1 ring-black/12 transition-colors ring-inset hover:ring-black/40"
              >
                <span
                  aria-hidden
                  className="block h-[3px] w-7 transition-[width] group-hover:w-12"
                  style={{ backgroundColor: "var(--ghad-accent)" }}
                />
                <span className="ghad-display mt-3 block text-[20px] leading-[1.05] font-extrabold tracking-[-0.03em] text-[#111]">
                  {mode.title}
                </span>
                <span className="mt-1 block text-[14px] leading-relaxed text-black/55">
                  {mode.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex flex-wrap items-center gap-x-2 text-[14px] text-black/55">
          <Printer className="h-4 w-4" aria-hidden />
          Or{" "}
          <Link
            href="/go"
            className="font-semibold text-[#111] underline underline-offset-4"
          >
            say it in your own words
          </Link>
          . Print it, then come back here to make it interesting.
        </p>
      </section>

      {/* ── 2. The pact ────────────────────────────────────────────── */}
      <section
        id="pact"
        aria-labelledby="offline-pact"
        className="mt-16 scroll-mt-20 border-t border-black/10 pt-8"
      >
        <SectionHead
          id="offline-pact"
          step="Make it interesting"
          title="The pact"
          lede="Decide it together before anyone gets in the car. It's more fun with something on the line."
        />

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
                style={{ transform: `rotate(${TILT[index % TILT.length]}deg)` }}
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
      </section>

      {/* ── 3. Go ──────────────────────────────────────────────────── */}
      <section
        aria-labelledby="offline-go"
        className="mt-16 border-t-2 border-black/80 pt-8"
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
          {stakeSentence(pact.stake)} Remember the three cards — reading them
          once is the last thing the phone has to do today.
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

const STEPS = [
  {
    title: "Plan it",
    body: "Say what kind of day you want, or pick a door. You get real places, and an honest note about anything we couldn't find out.",
  },
  {
    title: "Print it",
    body: "One sheet: the stops, a little challenge at each, and room to scribble. Fold it. It doesn't need charging.",
  },
  {
    title: "Go",
    body: "Make the pact, put the phones away, and have the day. Come back after and tell us how it went — if you feel like it.",
  },
] as const;

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
