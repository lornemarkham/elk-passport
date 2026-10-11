"use client";

import { MapPin } from "lucide-react";
import type {
  DiscoveryIntentOption,
  IntentKey,
} from "@/domain/discovery/intents";

/**
 * **What Discovery says before it says anything else.**
 *
 * It used to open with the word *Discovery* and the sentence "Search, filter,
 * and save the experiences you want to build your next adventure around" —
 * which describes the controls rather than the day, and told a first-time
 * visitor what the software does instead of what they could do. Measured at
 * 375px, the first actual possibility sat at y=638: an entire phone screen of
 * chrome before a single thing to do.
 *
 * This says the date, says where Passport is looking, and asks the question
 * the page exists to answer. All three are facts already in hand — the clock
 * and `activeScope()` — so none of it required new infrastructure, and none of
 * it is invented when it is missing.
 *
 * ## Why the date is passed in
 *
 * Resolved on the server and handed down, like the scope. A client that reads
 * its own clock during render disagrees with the server's markup and
 * hydrates into a mismatch; a client that reads it in an effect prints the
 * wrong day for a frame. The day a person is planning is not a thing to get
 * wrong for a frame.
 */
export function DiscoveryOpening({
  today,
  where,
  intents,
  selected,
  onSelect,
}: {
  /** Already written out, e.g. `Saturday, October 10`. */
  readonly today: string;
  /** Where Passport is looking, or `undefined` when it is looking everywhere. */
  readonly where?: string;
  readonly intents: readonly {
    readonly intent: DiscoveryIntentOption;
    readonly count: number;
  }[];
  readonly selected: IntentKey | null;
  readonly onSelect: (key: IntentKey | null) => void;
}) {
  return (
    <header>
      <p
        data-testid="discovery-context"
        className="ghad-accent-text flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide uppercase"
      >
        <span className="tabular-nums">{today}</span>
        {where && (
          <>
            <span aria-hidden className="text-black/40">
              ·
            </span>
            <span
              data-testid="active-scope"
              className="inline-flex items-center gap-1"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {where}
            </span>
          </>
        )}
      </p>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-[#111] sm:text-5xl">
        What could you do?
      </h1>
      {/* **"really here" was a claim Passport cannot make.** The corpus holds
          the Kitsilano Farmers Market, the Capilano Suspension Bridge and an
          exhibition at UBC's Museum of Anthropology — four hours away — and
          Atlas states no location for any of them (`location: null`,
          `regionIds: []`), so nothing on this page can tell you. Implying
          local-ness while being unable to check it is the one thing worse
          than saying nothing. Reported to Atlas; until then the page claims
          only what is true. */}
      <p className="mt-2 max-w-xl text-black/60">
        Real places and real dates, from what Atlas can vouch for. What is on
        today comes first.
      </p>

      {/* **Human intent, not Atlas's ontology.** These replace Places / Food &
          business / Things to do / Events / Experiences as the first thing a
          person is offered. The kind chips are not gone — they moved into the
          filters, where "only show me Events" still works for somebody who
          wants it. An intent the pool cannot fill is never offered. */}
      {intents.length > 0 && (
        /* **One row that scrolls on a phone, wrapped on a desktop.**
           Five chips at a 44px tap height wrapped to four rows at 375px — 200
           pixels of controls between somebody and the first thing they could
           do. A scrolling row keeps the tap targets and gives back 156 of
           them. `-mx-4 px-4` lets it bleed to the screen edge so the last chip
           is visibly cut off rather than looking like the end of the list. */
        <div
          role="group"
          aria-label="What do you feel like"
          className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-6 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {intents.map(({ intent, count }) => {
            const on = selected === intent.key;
            return (
              <button
                key={intent.key}
                type="button"
                data-testid={`intent-${intent.key}`}
                data-intent={intent.key}
                aria-pressed={on}
                onClick={() => onSelect(on ? null : intent.key)}
                className={
                  on
                    ? "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#111] px-4 text-sm font-medium whitespace-nowrap text-white"
                    : "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-black/25 px-4 text-sm font-medium whitespace-nowrap text-black/75 transition-colors hover:border-black/55 hover:text-[#111]"
                }
              >
                {intent.label}
                <span
                  className={`text-xs tabular-nums ${on ? "text-white/55" : "text-black/35"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
