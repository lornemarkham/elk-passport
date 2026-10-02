"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { Possibility } from "@/lib/labs/october/possibility";
import {
  byFit,
  closingSoon,
  fitFor,
  sayOnce,
  type Context,
} from "@/lib/labs/october/fit";
import { weekdayLabel, dayLabel } from "@/lib/labs/october/possibility";
import {
  FILTERS,
  GROUP_LABEL,
  type Days,
  type FilterGroup,
} from "@/lib/labs/october/filters";
import {
  EMPTY,
  isEmpty,
  merge,
  subtract,
  toggle,
  weight,
  type DiscoveryIntent,
} from "@/lib/labs/discovery/intent";
import { compose, resolve } from "@/lib/labs/discovery/engine";
import {
  NOTHING,
  opening,
  PHRASES,
  SECTIONS,
  phraseById,
} from "@/lib/labs/october/voice";
import type { Weather } from "@/lib/labs/october/fit";
import { Lead, Row, Tile } from "./cards";
import { TrustMe } from "./TrustMe";

const PAGE = 20;

/**
 * **One surface, four ways in, one engine.**
 *
 * The four experiments each proved something and each would have become a
 * separate product. This is the composition instead:
 *
 * - **A's editorial opening** is what you get when you have asked for nothing.
 *   A claim about the evening, a lead with a photograph, and the world cut
 *   into temporal promises rather than content types.
 * - **B's phrases** sit under it as a row of wishes. Choosing one does not
 *   navigate — it fills in the same `DiscoveryIntent` a chip would, and the
 *   page below reshapes.
 * - **C's Trust Me** is a panel over the top, two questions and then cards,
 *   whose every answer is an intent patch and whose deck is this engine.
 * - **D's search and filters** are one icon and one link, revealed when
 *   wanted. Same intent, same results.
 *
 * ## Why the page has two states and not four
 *
 * `isEmpty(intent)` is the whole of the mode logic. Nothing asked for →
 * October talks. Anything asked for → one honest list, because sections are a
 * way of making an undifferentiated world legible and a filtered world is
 * already legible. There is no tab, no route and no second component tree.
 *
 * ## Progressive disclosure
 *
 * The brief's balance: inspiration first, power on request. Search is an icon
 * until pressed. Filters are a line at the foot until opened. Neither is ever
 * more than one press away, and neither is on screen when nobody asked.
 */
export function OctoberDiscovery({
  possibilities,
  ctx,
  days,
  weather,
  areaName,
  signedIn,
  kept,
}: {
  readonly possibilities: readonly Possibility[];
  readonly ctx: Context;
  readonly days: Days;
  readonly weather: Weather;
  readonly areaName?: string;
  readonly signedIn: boolean;
  readonly kept: readonly string[];
}) {
  const [intent, setIntent] = useState<DiscoveryIntent>(EMPTY);
  useRememberedIntent(intent, setIntent);
  const [panel, setPanel] = useState<"none" | "filters">("none");
  const [trusting, setTrusting] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const keptSet = useMemo(() => new Set(kept), [kept]);

  const rank = useMemo(() => byFit(ctx), [ctx]);
  const resolved = useMemo(
    () => resolve({ pool: possibilities, intent, days, rank }),
    [possibilities, intent, days, rank],
  );

  const change = (next: DiscoveryIntent) => {
    setIntent(next);
    setShown(PAGE);
  };
  const clear = () => {
    setIntent(EMPTY);
    setPanel("none");
    setShown(PAGE);
  };

  const arriving = isEmpty(intent);
  const phrase = PHRASES.find((p) => said(intent, p.id));
  const open = opening(weather);

  // The hero must carry a photograph: it is the one position where an empty
  // frame reads as a broken product rather than as a deliberate treatment.
  const lead = arriving
    ? (resolved.results.find((p) => p.availability.tonight && p.image) ??
      resolved.results.find((p) => p.image))
    : undefined;

  const sections = arriving
    ? compose(resolved, days.today, SECTIONS, {
        skip: lead ? new Set([lead.id]) : undefined,
      })
    : [];

  const once = sayOnce();

  return (
    <>
      {/* ------------------------------------------------------- the opening */}
      {arriving ? (
        <header data-testid="opening" className="mb-8">
          <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
            {dateLine(days.today)}
            {areaName ? ` · ${areaName}` : ""}
          </p>
          <h1 className="font-heading mt-2 text-4xl leading-[1.05] tracking-tight text-balance text-[#f3efe4] sm:text-6xl">
            {open.headline}
          </h1>
          {open.under ? (
            <p className="mt-3 max-w-lg leading-relaxed text-[#e9e6da]/50">
              {open.under}
            </p>
          ) : null}
        </header>
      ) : (
        <header data-testid="asked" className="mb-6">
          {/* **October does not go away when you refine.** Filtering used to
              replace the whole page with a utilitarian results screen — the
              date, the sky and the claim all vanished the moment somebody
              pressed a phrase. The opening stays; it just stops being a
              headline and becomes a line. The hero is what collapses, because
              a full-width photograph above every filtered list is a screen of
              scrolling before the answer. */}
          <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
            {dateLine(days.today)}
            {areaName ? ` · ${areaName}` : ""}
          </p>
          <p className="font-heading mt-1 mb-4 text-xl text-[#f3efe4]/80">
            {open.headline}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-9 items-center gap-1.5 text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da] hover:underline"
            >
              ← October
            </button>
            {chips(intent).map((c) => (
              <span
                key={c.key}
                data-testid="asked-chip"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#d09a4e]/45 bg-[#d09a4e]/10 px-3 text-[13px] text-[#f0c88a]"
              >
                {c.label}
                <button
                  type="button"
                  onClick={() => change(c.without(intent))}
                  aria-label={`Remove ${c.label}`}
                  className="text-[#f0c88a]/60 hover:text-[#f0c88a]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ))}
          </div>
          {phrase ? (
            <p className="mt-3 text-lg text-[#d09a4e]/90">{phrase.answers}</p>
          ) : null}
        </header>
      )}

      {/* ------------------------------------------------------- the lead */}
      {lead ? (
        <section className="mb-10">
          <Lead
            p={lead}
            saved={keptSet.has(lead.id)}
            signedIn={signedIn}
            because={once(fitFor(lead, ctx).because)}
          />
        </section>
      ) : null}

      {/* -------------------------------------------------- what do you feel */}
      <section
        data-testid="phrases"
        className="rounded-xl border border-[#e9e6da]/10 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-heading text-xl text-[#f3efe4]">
            {arriving ? "I want to —" : "Or —"}
          </h2>
          <button
            type="button"
            data-testid="trust-me-open"
            onClick={() => setTrusting(true)}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm text-[#d09a4e] underline-offset-4 hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Not sure? Trust me
          </button>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PHRASES.map((p) => {
            const on = said(intent, p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  data-testid="phrase"
                  data-phrase={p.id}
                  aria-pressed={on}
                  onClick={() =>
                    change(
                      on ? subtract(intent, p.means) : merge(intent, p.means),
                    )
                  }
                  className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] transition-colors ${
                    on
                      ? "border-[#d09a4e] bg-[#d09a4e]/15 text-[#f0c88a]"
                      : "border-[#e9e6da]/15 text-[#e9e6da]/65 hover:border-[#e9e6da]/35 hover:text-[#e9e6da]"
                  }`}
                >
                  {p.says}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------- search and the filters */}
      <section className="mt-4">
        {/* **Search is a field, not a link to a field.** Both of these used
            to be quiet text links under the phrase box and both were missed in
            real use. A search box that looks like a search box, and one
            obvious button beside it, is still progressive disclosure — the
            thirteen filters stay behind the button. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <label className="flex flex-1 items-center gap-3 rounded-lg border border-[#e9e6da]/15 px-4 py-3 transition-colors focus-within:border-[#d09a4e]/60">
            <Search
              className="h-4 w-4 shrink-0 text-[#e9e6da]/35"
              aria-hidden
            />
            <input
              autoFocus
              value={intent.query ?? ""}
              onChange={(e) => change({ ...intent, query: e.target.value })}
              placeholder="Search anything — pumpkin, haunted, draconids"
              aria-label="Search everything"
              className="min-w-0 flex-1 bg-transparent text-[#e9e6da] placeholder:text-[#e9e6da]/30 focus:outline-none"
            />
            {intent.query ? (
              <button
                type="button"
                onClick={() => change({ ...intent, query: "" })}
                aria-label="Clear search"
                className="shrink-0 text-[#e9e6da]/35 hover:text-[#e9e6da]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </label>

          <button
            type="button"
            data-testid="open-filters"
            onClick={() =>
              setPanel((p) => (p === "filters" ? "none" : "filters"))
            }
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm transition-colors ${
              panel === "filters"
                ? "border-[#d09a4e] bg-[#d09a4e]/10 text-[#f0c88a]"
                : "border-[#e9e6da]/15 text-[#e9e6da]/70 hover:border-[#d09a4e]/50 hover:text-[#e9e6da]"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Browse &amp; filter all
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${panel === "filters" ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>

        {weight(intent) > 0 ? (
          <button
            type="button"
            onClick={clear}
            className="mt-2 text-sm text-[#d09a4e] underline-offset-4 hover:underline"
          >
            Clear everything
          </button>
        ) : null}

        {panel === "filters" ? (
          <div
            data-testid="filters"
            className="mt-3 flex flex-col gap-2 rounded-xl border border-[#e9e6da]/10 p-4"
          >
            {(["when", "feel", "doing", "looking", "where"] as const).map(
              (group) => (
                <FilterRow
                  key={group}
                  group={group}
                  intent={intent}
                  onChange={change}
                  extra={
                    group === "when" ? (
                      <label className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#e9e6da]/15 px-3 text-[13px] text-[#e9e6da]/55 focus-within:border-[#d09a4e]/60">
                        <span className="shrink-0">Pick a date</span>
                        <input
                          type="date"
                          value={intent.on ?? ""}
                          min="2026-10-01"
                          max="2026-10-31"
                          onChange={(e) =>
                            change({
                              ...intent,
                              on: e.target.value || undefined,
                            })
                          }
                          className="bg-transparent text-[#e9e6da] focus:outline-none"
                        />
                      </label>
                    ) : null
                  }
                />
              ),
            )}
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------- the results */}
      {arriving ? (
        <div className="mt-12 flex flex-col gap-12">
          {sections.map((s) => (
            <section key={s.id} data-testid="section" data-section={s.id}>
              <h2 className="font-heading text-2xl text-[#f3efe4]">
                {s.title}
              </h2>
              {s.line ? (
                <p className="mt-0.5 text-sm text-[#e9e6da]/40">{s.line}</p>
              ) : null}
              {s.id === "closing" || s.id === "whenever" ? (
                <div className="mt-4 flex flex-col gap-2">
                  {s.items.map((p) => (
                    <Row
                      key={p.id}
                      p={p}
                      saved={keptSet.has(p.id)}
                      signedIn={signedIn}
                      note={
                        s.id === "closing"
                          ? closingNote(p, days.today)
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {s.items.map((p) => (
                    <Tile
                      key={p.id}
                      p={p}
                      saved={keptSet.has(p.id)}
                      signedIn={signedIn}
                      because={once(fitFor(p, ctx).because)}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-sm text-[#e9e6da]/55" data-testid="count">
            <span className="text-[#e9e6da] tabular-nums">
              {resolved.results.length}
            </span>{" "}
            {resolved.results.length === 1 ? "thing" : "things"}
          </p>

          {resolved.results.length === 0 ? (
            <p className="mt-6 max-w-md leading-relaxed text-[#e9e6da]/45">
              {NOTHING}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2" data-testid="results">
              {resolved.results.slice(0, shown).map((p) => (
                <li key={p.id}>
                  <Row
                    p={p}
                    saved={keptSet.has(p.id)}
                    signedIn={signedIn}
                    because={once(fitFor(p, ctx).because)}
                  />
                </li>
              ))}
            </ul>
          )}

          {resolved.results.length > shown ? (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#e9e6da]/18 px-5 text-sm text-[#e9e6da]/70 hover:border-[#d09a4e]/50 hover:text-[#e9e6da]"
            >
              Show {Math.min(PAGE, resolved.results.length - shown)} more
            </button>
          ) : null}

          <Unanswered
            items={resolved.unanswered.when}
            line="These are on in October, but nobody published which nights."
          />
          <Unanswered
            items={resolved.unanswered.where}
            line="Nobody has said whether these are indoors or outdoors."
          />
        </div>
      )}

      {trusting ? (
        <TrustMe
          deck={resolved.results}
          intent={intent}
          onIntent={change}
          onClose={() => setTrusting(false)}
          signedIn={signedIn}
          kept={keptSet}
        />
      ) : null}
    </>
  );
}

/**
 * **Your wish survives opening something.**
 *
 * Measured on the launch path: search "boos", open Boos and Booze, press back
 * — and the search was gone, both through the page's own back link and through
 * the browser's. A person who found a thing by searching has to search for it
 * again to carry on, which is the friction that ends a session.
 *
 * `sessionStorage` rather than the URL, deliberately. It is the smallest thing
 * that survives a navigation and a reload, it needs no router plumbing and no
 * Suspense boundary, and it is thrown away when the tab closes. A shareable
 * `?intent=` link is a better answer and a bigger change; it is written down
 * rather than built tonight.
 *
 * Restored in an effect rather than in the initial state, because the server
 * rendered the arrival page and a client that started somewhere else would be
 * a hydration mismatch.
 */
const REMEMBERED = "october.intent";

function useRememberedIntent(
  intent: DiscoveryIntent,
  setIntent: (next: DiscoveryIntent) => void,
) {
  // A ref rather than state: whether the restore has run changes nothing on
  // screen, and making it state would mean setting state inside an effect to
  // trigger a render nobody needs.
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = sessionStorage.getItem(REMEMBERED);
      if (saved) setIntent(JSON.parse(saved) as DiscoveryIntent);
    } catch {
      // A blocked or full store is not a reason to fail to render October.
    }
  }, [setIntent]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      if (isEmpty(intent)) sessionStorage.removeItem(REMEMBERED);
      else sessionStorage.setItem(REMEMBERED, JSON.stringify(intent));
    } catch {
      // As above: remembering is a convenience, never a requirement.
    }
  }, [intent]);
}

// ------------------------------------------------------------------ pieces

function FilterRow({
  group,
  intent,
  onChange,
  extra,
}: {
  readonly group: FilterGroup;
  readonly intent: DiscoveryIntent;
  readonly onChange: (next: DiscoveryIntent) => void;
  readonly extra?: React.ReactNode;
}) {
  const key = GROUP_KEY[group];
  const on = (id: string) =>
    ((intent[key] ?? []) as readonly string[]).includes(id);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 shrink-0 text-[10px] tracking-[0.16em] text-[#e9e6da]/30 uppercase">
        {GROUP_LABEL[group]}
      </span>
      {FILTERS.filter((f) => f.group === group).map((f) => (
        <button
          key={f.id}
          type="button"
          data-testid="filter"
          data-filter={f.id}
          aria-pressed={on(f.id)}
          onClick={() => onChange(toggle(intent, key, f.id as never))}
          className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] transition-colors ${
            on(f.id)
              ? "border-[#d09a4e] bg-[#d09a4e]/15 text-[#f0c88a]"
              : "border-[#e9e6da]/15 text-[#e9e6da]/60 hover:border-[#e9e6da]/35 hover:text-[#e9e6da]"
          }`}
        >
          {f.label}
        </button>
      ))}
      {extra}
    </div>
  );
}

/** The filter vocabulary and the intent share one set of keys, by group. */
const GROUP_KEY = {
  when: "when",
  feel: "feel",
  doing: "doing",
  looking: "looking",
  where: "where",
} as const satisfies Record<FilterGroup, keyof DiscoveryIntent>;

function Unanswered({
  items,
  line,
}: {
  readonly items: readonly Possibility[];
  readonly line: string;
}) {
  if (items.length === 0) return null;
  return (
    <details className="group mt-6" data-testid="unanswered">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-[#e9e6da]/35 underline-offset-4 hover:text-[#e9e6da]/70 hover:underline">
        {items.length} more — {line}
        <span className="ml-2 text-[#d09a4e]/60 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <ul className="mt-2 flex flex-col gap-1 pl-1 text-sm">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={p.href}
              className="text-[#e9e6da]/55 hover:text-[#e9e6da]"
            >
              {p.title}
            </Link>
            <span className="text-[#e9e6da]/25"> · {p.availability.label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ------------------------------------------------------------------ helpers

/** Is this phrase currently part of the wish? */
function said(intent: DiscoveryIntent, id: string): boolean {
  const phrase = phraseById(id);
  if (!phrase) return false;
  const m = phrase.means;
  if (m.surprise) return intent.surprise === true;
  if (m.within !== undefined) return intent.within === m.within;
  return (
    (m.feel ?? []).every((k) => (intent.feel ?? []).includes(k)) &&
    (m.looking ?? []).every((k) => (intent.looking ?? []).includes(k)) &&
    (m.feel?.length ?? 0) + (m.looking?.length ?? 0) > 0
  );
}

interface Chip {
  readonly key: string;
  readonly label: string;
  without(intent: DiscoveryIntent): DiscoveryIntent;
}

/** Everything currently being asked for, each one removable on its own. */
function chips(intent: DiscoveryIntent): readonly Chip[] {
  const out: Chip[] = [];
  const drop =
    <K extends "when" | "feel" | "doing" | "looking" | "where">(
      group: K,
      key: string,
    ) =>
    (i: DiscoveryIntent) => ({
      ...i,
      [group]: ((i[group] ?? []) as readonly string[]).filter((k) => k !== key),
    });

  if (intent.query?.trim()) {
    out.push({
      key: "query",
      label: `“${intent.query.trim()}”`,
      without: (i) => ({ ...i, query: "" }),
    });
  }
  for (const group of ["when", "feel", "doing", "looking", "where"] as const) {
    for (const key of intent[group] ?? []) {
      const def = FILTERS.find((f) => f.id === key);
      out.push({
        key: `${group}:${key}`,
        label: def?.label ?? key,
        without: drop(group, key),
      });
    }
  }
  if (intent.on) {
    out.push({
      key: "on",
      label: `${weekdayLabel(intent.on)} ${dayLabel(intent.on)}`,
      without: (i) => ({ ...i, on: undefined }),
    });
  }
  if (intent.within !== undefined) {
    out.push({
      key: "within",
      label: `under ${intent.within} min`,
      without: (i) => ({ ...i, within: undefined }),
    });
  }
  if (intent.surprise) {
    out.push({
      key: "surprise",
      label: "surprise me",
      without: (i) => ({ ...i, surprise: undefined }),
    });
  }
  return out;
}

function closingNote(p: Possibility, today: string): string | undefined {
  const end = closingSoon(p.availability.days, today);
  if (!end) return undefined;
  return end.daysLeft === 1
    ? `Final night — ${weekdayLabel(end.lastDay)}.`
    : `Two nights left. Last is ${weekdayLabel(end.lastDay)} ${dayLabel(end.lastDay)}.`;
}

function dateLine(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
