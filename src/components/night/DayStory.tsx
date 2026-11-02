"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock,
  Flame,
  Navigation,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Picture } from "@/components/adventures/Picture";
import type { Experience } from "@/domain/experience/types";
import type {
  DayOption,
  Mood,
  NightDay,
  Phase,
} from "@/domain/date-night/adventures";
import {
  composeDay,
  DEFAULT_ANSWERS,
  PHASE_LABEL,
  readAnswers,
  spokenClock,
  swapsOf,
  type DayAnswers,
  type When,
} from "@/domain/date-night/adventures/compose";
import type { DayDetail } from "@/lib/adventures/propose";
import type { ItemView } from "@/lib/adventures/store";
import { cn } from "@/lib/utils";
import styles from "./night.module.css";

const WINE = "#1f3a2e";

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const said = await response.json().catch(() => null);
    throw new Error(said?.error ?? String(response.status));
  }
}

function directions(e: Experience | undefined, title: string): string {
  const lat = e?.location?.latitude;
  const lng = e?.location?.longitude;
  const destination =
    lat !== undefined && lng !== undefined
      ? `${lat},${lng}`
      : `${title}, Vernon BC`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * **The day, told as a story — START → EXPLORE → EXPERIENCE → UNWIND →
 * REMEMBER.**
 *
 * Before there is a day: five quick answers and one button. After: a strip
 * of big pictures, one per beat, each with what you're doing, why, when,
 * whether it's sure to be open, and the way there. "Show me another" and the
 * mood buttons re-choose with the night's composer and save through the
 * shared adventure core (`/api/adventures/[id]/days`, Passport's suggestions,
 * Undo-able like any change), so the details below and the printable guide
 * are always this same day.
 */
export function DayStory({
  adventureId,
  isOwner,
  day,
  dayItems,
  ask,
  detail,
  experiences,
  planned,
  otherName,
  planLabel,
}: {
  readonly adventureId: string;
  readonly isOwner: boolean;
  readonly day: NightDay;
  /** The adventure's items on `day.on`, in order. */
  readonly dayItems: readonly ItemView[];
  /** How the day was asked for, as the core keeps it. */
  readonly ask: string | null;
  readonly detail: DayDetail | undefined;
  readonly experiences: Readonly<Record<string, Experience>>;
  /** The adventure has this day (dates set). */
  readonly planned: boolean;
  readonly otherName: string | null;
  /**
   * What the adventure is called once this composer has made its day, so
   * the evening it replaces stops claiming to be the plan.
   */
  readonly planLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const saved = readAnswers(ask);
  const [answers, setAnswers] = useState<DayAnswers>(saved ?? DEFAULT_ANSWERS);
  const [asking, setAsking] = useState(dayItems.length === 0);

  const stops = useMemo(
    () => dayItems.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
    [dayItems],
  );
  const current = useMemo(
    () => composeDay(day, saved ?? answers, swapsOf(day, stops)),
    [day, saved, answers, stops],
  );
  const optionOf = new Map(day.options.map((o) => [o.atlasRef, o]));

  async function save(next: DayAnswers, swap = swapsOf(day, stops)) {
    const composed = composeDay(day, next, swap);
    if (composed.stops.length === 0) {
      toast.error(
        composed.notes[0] ?? "Nothing fits those answers. Try loosening one.",
      );
      return;
    }
    setBusy(true);
    try {
      if (!planned || planLabel)
        await send(`/api/adventures/${adventureId}`, "PATCH", {
          startsOn: day.on,
          destinationTownId: day.townId,
          destinationLabel: planLabel ?? day.area,
        });
      await send(`/api/adventures/${adventureId}/days`, "POST", {
        query: composed.query,
        mode: "propose",
      });
      setAnswers(next);
      setAsking(false);
      router.refresh();
    } catch (error) {
      toast.error(
        isOwner
          ? `That didn't save (${(error as Error).message}). Try again.`
          : "Only the person who started it can change the day. Your ideas still count.",
      );
    } finally {
      setBusy(false);
    }
  }

  function another(option: DayOption) {
    const alts = current.alternatives[option.phase] ?? [];
    const next = alts[0];
    if (!next) {
      toast("That's the only place that fits that part of the day right now.");
      return;
    }
    void save(answers, {
      ...swapsOf(day, stops),
      [option.phase]: next.atlasRef,
    });
  }

  if (asking && isOwner)
    return (
      <Questions
        answers={answers}
        onChange={setAnswers}
        busy={busy}
        onGo={() => save(answers, {})}
        onCancel={dayItems.length > 0 ? () => setAsking(false) : undefined}
      />
    );

  if (dayItems.length === 0)
    return (
      <div className="rounded-[28px] bg-white/80 p-6 text-center ring-1 ring-black/5">
        <p className="ghad-display text-2xl font-extrabold">
          The day is being planned.
        </p>
        <p className="mt-2 text-[var(--gh-ink-soft)]">
          {otherName ?? "Your favourite person"} is choosing the shape of it.
          Vote on the wild ideas below in the meantime. They count.
        </p>
      </div>
    );

  const moods: readonly [string, DayAnswers][] = [
    ["More adventurous", { ...answers, moods: ["adventurous", "playful"] }],
    ["More romantic", { ...answers, moods: ["romantic", "cozy"] }],
    ["Cozier", { ...answers, moods: ["cozy"], plunge: false }],
    ["More playful", { ...answers, moods: ["playful"] }],
    ["Shorten the evening", { ...answers, short: true }],
    [
      "Start later",
      {
        ...answers,
        when: (answers.when === "day" ? "afternoon" : "evening") as When,
      },
    ],
  ];

  return (
    <div className="space-y-6">
      <ol
        aria-label="The day, start to finish"
        data-testid="day-story"
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6"
      >
        {dayItems.map((item, index) => {
          const ref = item.atlasRef ?? "";
          const option = optionOf.get(ref);
          const e = experiences[ref];
          const stop = detail?.stops[ref];
          const title = item.label ?? e?.title ?? option?.title ?? "A stop";
          const phase: Phase | undefined = option?.phase;
          const composed = current.stops.find((s) => s.option.atlasRef === ref);
          const arrive = stop?.arrive ?? composed?.arrive;
          const leave = stop?.leave ?? composed?.leave;
          return (
            <li
              key={item.id}
              data-testid="story-stop"
              className="relative flex w-[82vw] max-w-[340px] shrink-0 snap-center flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_20px_50px_-25px_rgba(60,10,25,0.55)] ring-1 ring-black/5"
            >
              <div className="relative">
                <Picture
                  experience={e}
                  fallbackTitle={title}
                  tone={WINE}
                  priority={index === 0}
                  className="aspect-[4/5] w-full"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <p className="absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-white uppercase backdrop-blur">
                  {index + 1} · {phase ? PHASE_LABEL[phase] : "Detour"}
                </p>
                <div className="absolute inset-x-4 bottom-4 text-white">
                  {arrive !== undefined && (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {spokenClock(arrive)}
                      {leave !== undefined && ` – ${spokenClock(leave)}`}
                    </p>
                  )}
                  <h3 className="ghad-display mt-1 text-2xl leading-tight font-extrabold text-balance">
                    {title}
                  </h3>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <p className="text-[15px] leading-snug font-semibold">
                  {option?.line ?? stop?.because ?? "A place Atlas knows."}
                </p>
                {option?.why && (
                  <p className="text-sm text-[var(--gh-ink-soft)]">
                    {option.why}
                  </p>
                )}
                {option?.hoursSource ? (
                  <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    ✓ Open then. {option.hoursSource}.
                  </p>
                ) : option?.caution ? (
                  <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {option.caution}
                  </p>
                ) : stop?.hours ? (
                  <p className="rounded-2xl bg-black/[0.04] px-3 py-2 text-xs">
                    Published hours: “{stop.hours}”
                  </p>
                ) : null}
                <div className="mt-auto flex gap-2 pt-1">
                  <a
                    href={directions(e, title)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--n-forest)] px-4 text-sm font-bold text-white"
                  >
                    <Navigation className="h-4 w-4" aria-hidden /> Take us
                  </a>
                  {isOwner && option && (
                    <button
                      onClick={() => another(option)}
                      disabled={busy}
                      data-testid="show-another"
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-black/15 px-4 text-sm font-bold disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden /> Another
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        <li
          data-testid="story-remember"
          className="relative isolate flex min-h-[520px] w-[82vw] max-w-[340px] shrink-0 snap-center flex-col justify-end overflow-hidden rounded-[28px] bg-[radial-gradient(120%_80%_at_50%_100%,#f59e0b_0%,#b4411b_28%,#3b0f1f_62%,#12060b_100%)] p-6 text-white shadow-[0_20px_50px_-25px_rgba(60,10,25,0.55)]"
        >
          {/* ELK's own generated campfire loop: a feeling, not a place. */}
          <video
            className={`absolute inset-0 -z-10 h-full w-full object-cover opacity-70 ${styles.film}`}
            src="/video/discovery/campfire-summer.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#12060b] via-[#12060b]/55 to-transparent" />
          <Flame
            className="absolute top-6 left-6 h-8 w-8 text-amber-300"
            aria-hidden
          />
          <p className="absolute top-7 right-5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/80 uppercase">
            Illustration
          </p>
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/80 uppercase">
            {dayItems.length + 1} · Remember
          </p>
          <h3 className="ghad-display mt-2 text-2xl leading-tight font-extrabold text-balance">
            {day.finale.title}
          </h3>
          <p className="mt-3 text-[15px] leading-snug text-white/90">
            {day.finale.line}
          </p>
          {day.finale.caution && (
            <p className="mt-3 text-xs text-white/70">{day.finale.caution}</p>
          )}
          <a
            href="#memories"
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-white px-4 text-sm font-bold text-[#3b0f1f]"
          >
            Keep a moment <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </li>
      </ol>

      {current.notes.length > 0 && (
        <ul className="space-y-1.5 text-sm text-[var(--gh-ink-soft)]">
          {current.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}

      {isOwner ? (
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[var(--gh-ink-soft)] uppercase">
            Change the mood
          </p>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="moods">
            {moods.map(([label, next]) => (
              <button
                key={label}
                onClick={() => save(next, {})}
                disabled={busy}
                className="min-h-11 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-black/10 hover:ring-[var(--n-forest)]/40 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setAsking(true)}
              disabled={busy}
              className="min-h-11 rounded-full px-4 text-sm font-bold text-[var(--n-forest)] underline-offset-4 hover:underline"
            >
              Start over
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--gh-ink-soft)]">
          Say I&apos;m in, Maybe or Out on each stop below, or ask for a change
          in your own words. It goes to {otherName ?? "the planner"} as a
          suggestion.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------- questions

function Chips<T extends string | number>({
  legend,
  value,
  options,
  onPick,
  multi,
}: {
  legend: string;
  value: readonly T[];
  options: readonly (readonly [T, string])[];
  onPick: (v: T) => void;
  multi?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([v, label]) => {
          const on = value.includes(v);
          return (
            <button
              key={String(v)}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={on}
              onClick={() => onPick(v)}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm font-bold ring-1 transition",
                on
                  ? "bg-[var(--n-forest)] text-white ring-[var(--n-forest)]"
                  : "bg-white ring-black/15",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Questions({
  answers,
  onChange,
  onGo,
  onCancel,
  busy,
}: {
  answers: DayAnswers;
  onChange: (a: DayAnswers) => void;
  onGo: () => void;
  onCancel?: () => void;
  busy: boolean;
}) {
  const toggleMood = (m: Mood) => {
    const has = answers.moods.includes(m);
    const moods = has
      ? answers.moods.filter((x) => x !== m)
      : [...answers.moods, m].slice(-2);
    onChange({ ...answers, moods });
  };
  return (
    <form
      data-testid="day-questions"
      onSubmit={(e) => {
        e.preventDefault();
        onGo();
      }}
      className="space-y-6 rounded-[28px] bg-white p-5 shadow-[0_20px_50px_-30px_rgba(60,10,25,0.6)] ring-1 ring-black/5 sm:p-7"
    >
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--n-forest)] uppercase">
          Five quick ones
        </p>
        <h2 className="ghad-display mt-1 text-3xl font-extrabold">
          What kind of day is it?
        </h2>
      </div>
      <Chips
        legend="When are we free?"
        value={[answers.when]}
        options={[
          ["day", "All day, from 11:30"],
          ["afternoon", "From 1:30"],
          ["evening", "Just the evening"],
        ]}
        onPick={(when) => onChange({ ...answers, when })}
      />
      <Chips
        legend="How far will we drive?"
        value={[answers.reach]}
        options={[
          [15, "15 min"],
          [30, "30 min"],
          [60, "An hour"],
        ]}
        onPick={(reach) => onChange({ ...answers, reach })}
      />
      <Chips
        legend="Budget"
        value={[answers.budget]}
        options={[
          [1, "$"],
          [2, "$$"],
          [3, "Treat us"],
        ]}
        onPick={(budget) => onChange({ ...answers, budget })}
      />
      <Chips
        legend="The mood (pick up to two)"
        multi
        value={answers.moods}
        options={[
          ["romantic", "Romantic"],
          ["adventurous", "Adventurous"],
          ["cozy", "Cozy"],
          ["playful", "Playful"],
        ]}
        onPick={toggleMood}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Chips
          legend="A cold plunge?"
          value={[answers.plunge ? "yes" : "no"]}
          options={[
            ["yes", "Absolutely 🥶"],
            ["no", "Hard no"],
          ]}
          onPick={(v) => onChange({ ...answers, plunge: v === "yes" })}
        />
        <Chips
          legend="Drinks?"
          value={[answers.drinks ? "yes" : "no"]}
          options={[
            ["yes", "Yes please"],
            ["no", "Keep it dry"],
          ]}
          onPick={(v) => onChange({ ...answers, drinks: v === "yes" })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy || answers.moods.length === 0}
          data-testid="make-our-day"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--n-forest)] px-6 text-base font-bold text-white shadow-lg disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {busy ? "Building it…" : "Make our day"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-3 text-sm font-semibold text-[var(--gh-ink-soft)]"
          >
            Keep the day we have
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--gh-ink-soft)]">
        Real places Atlas knows, picked for the day, in an order that keeps the
        lake in daylight and dinner at dinner time. Change anything after.
      </p>
    </form>
  );
}
