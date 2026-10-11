"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import {
  readBrief,
  replacedStop,
  reviseBrief,
  type DayBrief,
} from "@/domain/day/brief";
import { buildDay } from "@/domain/day/build";
import { OFFLINE_MODES, modeById } from "./modes";
import { townById } from "@/domain/discovery/towns";
import { DayItinerary } from "./DayItinerary";

/**
 * **"What kind of day do you want?"**
 *
 * One box, six doors, and a day that changes when you talk to it. The
 * conversation is deliberately not a chatbot: there is no assistant persona,
 * no typing indicator and no thread. You say a thing, the day rearranges, and
 * the sentence you said stays visible so you can see what it is working from.
 *
 * ## Where the intelligence is
 *
 * In `readBrief` and `buildDay`, both pure and both tested, both running in
 * the browser against the pool this page was already given. That means no
 * round trip per revision, no spend per revision, and — the part that
 * matters — **no key required for any of it to work**. There is an OpenAI
 * integration in this repository and no credentials configured; a feature
 * that only works with them is a feature that does not work.
 *
 * When a key is configured, `/api/go/read` improves the reading of an unusual
 * sentence and returns the same `DayBrief`. Nothing downstream can tell which
 * read it, and the model never chooses a place: the stops are Atlas subjects
 * picked by evidence, every time.
 */
const REVISIONS = [
  "Make it cheaper",
  "More outdoors",
  "Less driving",
  "Make it weirder",
  "Make it more adventurous",
] as const;

export function GoHaveADay({
  pool,
  today,
  initialSay,
  initialMode,
  childAge,
  townId,
  on,
}: {
  readonly pool: readonly Experience[];
  /** `YYYY-MM-DD` where the subjects are. */
  readonly today: string;
  readonly initialSay?: string;
  readonly initialMode?: string;
  readonly childAge?: number;
  readonly townId?: string;
  readonly on?: string;
}) {
  const seed = initialSay ?? modeById(initialMode)?.says ?? "";
  const [draft, setDraft] = useState(seed);
  const [brief, setBrief] = useState<DayBrief | null>(
    seed ? readBrief(seed, fallbackFrom(childAge, townId, on, today)) : null,
  );
  const [dropped, setDropped] = useState<string[]>([]);
  const [asked, setAsked] = useState<string[]>([]);

  const day = useMemo(
    () => (brief ? buildDay({ pool, brief, without: dropped }) : null),
    [pool, brief, dropped],
  );

  const start = (said: string) => {
    if (!said.trim()) return;
    setDropped([]);
    setAsked([]);
    setBrief(readBrief(said, fallbackFrom(childAge, townId, on, today)));
    setDraft(said);
  };

  const revise = (said: string) => {
    if (!brief || !day) return;
    setAsked((a) => [...a, said]);
    const nth = replacedStop(said);
    if (nth !== undefined) {
      const victim = day.stops[nth - 1]?.experience.id;
      if (victim) setDropped((d) => [...d, victim]);
      return;
    }
    setBrief(reviseBrief(brief, said));
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-12 lg:px-10">
      <p
        className="text-[11px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: "var(--ghad-accent)" }}
      >
        Go offline
      </p>
      <h1 className="ghad-display mt-2 max-w-[18ch] text-[34px] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-[#111] sm:text-[60px]">
        What kind of day do you want?
      </h1>
      <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-black/60">
        Say it however you&apos;d say it to a friend. We&apos;ll build you a day
        out of real places, print it, and then you can leave your phone in the
        glovebox.
      </p>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          start(draft);
        }}
      >
        <input
          data-testid="go-say"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Five hours, $100, with a five-year-old, near Vernon"
          className="min-h-14 flex-1 rounded-full bg-white px-5 text-[16px] text-[#111] ring-1 ring-black/15 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/50 focus:outline-none"
        />
        <button
          type="submit"
          data-testid="go-build"
          style={{
            backgroundColor: "var(--ghad-accent)",
            color: "var(--ghad-accent-ink)",
          }}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 text-[16px] font-semibold"
        >
          Build my day
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </form>

      {/* The six doors. Each is a sentence, read by the same parser — see
          `modes.ts`. */}
      <div className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
          Or pick a shape of day
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OFFLINE_MODES.map((mode) => (
            <li key={mode.id}>
              <button
                type="button"
                data-testid={`go-mode-${mode.id}`}
                onClick={() => start(mode.says)}
                className="group h-full w-full rounded-2xl p-4 text-left ring-1 ring-black/12 transition-colors ring-inset hover:ring-black/40"
              >
                <span
                  aria-hidden
                  className="block h-[3px] w-7"
                  style={{ backgroundColor: "var(--ghad-accent)" }}
                />
                <span className="ghad-display mt-3 block text-[20px] leading-[1.05] font-extrabold tracking-[-0.03em] text-[#111]">
                  {mode.title}
                </span>
                <span className="mt-1 block text-[14px] leading-relaxed text-black/55">
                  {mode.blurb}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {day && brief && (
        <section
          data-testid="go-day"
          className="mt-12 border-t border-black/10 pt-8"
        >
          <DayItinerary day={day} />

          {day.stops.length > 0 && (
            <>
              <div className="mt-8 border-t border-black/10 pt-6">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
                  Not quite? Tell it what to change
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {REVISIONS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      data-testid={`go-revise-${label.toLowerCase().replace(/\W+/g, "-")}`}
                      onClick={() => revise(label)}
                      className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/45"
                    >
                      {label}
                    </button>
                  ))}
                  {day.stops.map((stop, index) => (
                    <button
                      key={stop.experience.id}
                      type="button"
                      data-testid={`go-replace-${index + 1}`}
                      onClick={() =>
                        revise(`replace the ${ordinal(index + 1)} stop`)
                      }
                      className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-black/45 ring-1 ring-black/10 ring-inset hover:text-black/80 hover:ring-black/40"
                    >
                      Swap {ordinal(index + 1)}
                    </button>
                  ))}
                </div>
                {asked.length > 0 && (
                  <p
                    data-testid="go-asked"
                    className="mt-3 text-[13px] text-black/45"
                  >
                    You asked for: {asked.join(" · ")}
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/go/print?${printQuery(
                    brief,
                    day.stops.map((s) => s.experience.id),
                  )}`}
                  data-testid="go-print"
                  style={{
                    backgroundColor: "var(--ghad-accent)",
                    color: "var(--ghad-accent-ink)",
                  }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  Print our adventure
                </Link>
                <Link
                  href="/discovery"
                  className="inline-flex min-h-12 items-center px-5 text-[15px] font-semibold text-black/55 hover:text-[#111]"
                >
                  Keep looking instead
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

const ordinal = (n: number) =>
  ["first", "second", "third", "fourth", "fifth"][n - 1] ?? `${n}th`;

const fallbackFrom = (
  childAge: number | undefined,
  townId: string | undefined,
  on: string | undefined,
  today: string,
): Partial<DayBrief> => ({
  ...(childAge !== undefined ? { childAge } : {}),
  ...(townById(townId) ? { town: townById(townId)! } : {}),
  on: on ?? today,
});

/**
 * The guide's URL carries the **stop ids**, not the sentence.
 *
 * A printed page has to be the day somebody looked at. Re-running the builder
 * from the brief could hand them a different afternoon between pressing print
 * and the paper coming out, which is exactly the kind of small betrayal that
 * stops people trusting a thing they are about to drive somewhere with.
 */
function printQuery(brief: DayBrief, ids: readonly string[]): string {
  const params = new URLSearchParams();
  params.set("stops", ids.join(","));
  params.set("say", brief.said);
  if (brief.hours !== undefined) params.set("hours", String(brief.hours));
  if (brief.childAge !== undefined) params.set("age", String(brief.childAge));
  if (brief.town) params.set("at", brief.town.id);
  if (brief.on) params.set("on", brief.on);
  return params.toString();
}
