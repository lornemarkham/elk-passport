"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { TOWN_GROUPS, townById } from "@/domain/discovery/towns";
import {
  PARTIES,
  startSentence,
  VIBES,
  type PartyId,
  type VibeId,
} from "@/lib/adventures/sentence";
import { daysBetween } from "@/lib/adventures/days";
import { whenLabel } from "@/lib/adventures/present";
import { cn } from "@/lib/utils";
import { pillClass } from "./kit";

type When = "saturday" | "sunday" | "weekend" | "dates" | "later";

/** The coming Saturday and Sunday (today, if it is one), as calendar days. */
function comingWeekend(today: string): { sat: string; sun: string } {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = d.getUTCDay();
  const toSat = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() + toSat);
  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  return {
    sat: sat.toISOString().slice(0, 10),
    sun: sun.toISOString().slice(0, 10),
  };
}

const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-base font-semibold transition-colors",
    on
      ? "border-[var(--gh-ink)] bg-[var(--gh-ink)] text-white"
      : "border-[var(--gh-line)] bg-white text-[var(--gh-ink)] hover:border-[var(--gh-ink)]/40",
  );

/**
 * **Never start with a blank adventure** (ADR 012 §1).
 *
 * Five questions, each one tap, none required but a town for the sketch:
 * where, when, who, what kind of day, anything important. They become one
 * sentence (`startSentence`) that the Day Builder reads for every day, so
 * the adventure opens with real places on it — or, with the sketch turned
 * off, with only what was brought from Saved. Manual is always possible.
 */
export function CreateAdventure({
  today,
  seeds,
  seedTitles,
  initialTown = "",
  initialTitle = "",
}: {
  /** A town to start from ("Do it again"). Ignored unless Passport knows it. */
  readonly initialTown?: string;
  readonly initialTitle?: string;
  /** Today where the subjects are, `YYYY-MM-DD`. */
  readonly today: string;
  /** Saved places brought here (`?with=`). */
  readonly seeds: readonly string[];
  readonly seedTitles: readonly string[];
}) {
  const router = useRouter();
  const weekend = useMemo(() => comingWeekend(today), [today]);
  const [townId, setTownId] = useState(
    townById(initialTown) ? initialTown : "",
  );
  const [when, setWhen] = useState<When>("weekend");
  const [from, setFrom] = useState(weekend.sat);
  const [to, setTo] = useState(weekend.sun);
  const [party, setParty] = useState<PartyId | undefined>(undefined);
  const [age, setAge] = useState("");
  const [vibes, setVibes] = useState<VibeId[]>([]);
  const [extra, setExtra] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [sketch, setSketch] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dates: { startsOn: string | null; endsOn: string | null } =
    when === "saturday"
      ? { startsOn: weekend.sat, endsOn: null }
      : when === "sunday"
        ? { startsOn: weekend.sun, endsOn: null }
        : when === "weekend"
          ? { startsOn: weekend.sat, endsOn: weekend.sun }
          : when === "dates"
            ? { startsOn: from || null, endsOn: to && to !== from ? to : null }
            : { startsOn: null, endsOn: null };
  const days = daysBetween(dates.startsOn, dates.endsOn);
  const kind = days.length <= 1 ? "day" : days.length <= 3 ? "weekend" : "trip";
  const town = townById(townId);
  const place = town?.name.replace(/,\s*BC$/, "");
  const childAge =
    party === "family" && age !== "" && Number.isInteger(Number(age))
      ? Math.min(17, Math.max(0, Number(age)))
      : undefined;
  const say = startSentence({
    vibes,
    ...(party ? { party } : {}),
    ...(childAge !== undefined ? { childAge } : {}),
    extra,
  });
  const named =
    title.trim() ||
    [
      place ?? "Our",
      days.length > 1 ? (days.length <= 3 ? "weekend" : "trip") : "day out",
    ].join(" ");
  const canSketch = sketch && Boolean(town) && days.length > 0;
  const tooLong = when === "dates" && from && to && to < from;

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (tooLong) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/adventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: named,
          startsOn: dates.startsOn,
          endsOn: dates.endsOn,
          destinationTownId: town?.id ?? null,
          destinationLabel: place ?? null,
          ...(seeds.length > 0 ? { atlasRefs: seeds } : {}),
          ...(canSketch
            ? {
                sketch: {
                  say,
                  ...(childAge !== undefined ? { childAge } : {}),
                },
              }
            : {}),
        }),
      });
      if (response.status === 401) {
        window.location.assign(
          `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          response.status === 503
            ? "Adventures can't be reached right now. Please try again in a moment."
            : (body.error ?? "Couldn't start it. Please try again."),
        );
        setBusy(false);
        return;
      }
      const note = body.sketch ? `?started=${body.sketch}` : "";
      router.push(`/adventures/${body.id}${note}`);
    } catch {
      setError("Couldn't start it. Please try again.");
      setBusy(false);
    }
  }

  const Question = ({
    n,
    title: q,
    children,
    hint,
  }: {
    n: number;
    title: string;
    hint?: string;
    children: React.ReactNode;
  }) => (
    <fieldset className="border-t border-[var(--gh-line)] pt-7">
      <legend className="flex items-baseline gap-3">
        <span
          aria-hidden
          className="ghad-display text-sm font-extrabold text-[var(--gh-ink-soft)] tabular-nums"
        >
          0{n}
        </span>
        <span className="ghad-display text-2xl font-extrabold tracking-[-0.02em] text-[var(--gh-ink)] sm:text-3xl">
          {q}
        </span>
      </legend>
      {hint && (
        <p className="mt-1 text-base text-[var(--gh-ink-soft)] sm:ml-8">
          {hint}
        </p>
      )}
      <div className="mt-4 sm:ml-8">{children}</div>
    </fieldset>
  );

  return (
    <form
      onSubmit={start}
      aria-label="Create an adventure"
      className="space-y-8"
      data-testid="create-adventure-form"
    >
      {seeds.length > 0 && (
        <p
          data-testid="create-seeds"
          className="rounded-2xl bg-[var(--gh-forest-soft)] px-5 py-4 text-base text-[var(--gh-forest)]"
        >
          <strong>
            Starting from {seeds.length} saved{" "}
            {seeds.length === 1 ? "place" : "places"}
          </strong>
          {seedTitles.length > 0 && <> — {seedTitles.slice(0, 4).join(", ")}</>}
          {seedTitles.length > 4 && " and more"}. Passport plans around them.
        </p>
      )}

      {/* `Question` is a render helper, not a component with state. */}
      {Question({
        n: 1,
        title: "Where are we going?",
        hint: "Where the day starts. Passport plans what's within reach.",
        children: (
          <label className="block max-w-md">
            <span className="sr-only">Town</span>
            <select
              data-testid="create-town"
              value={townId}
              onChange={(e) => setTownId(e.target.value)}
              className="block min-h-14 w-full rounded-2xl border-2 border-[var(--gh-line)] bg-white px-4 text-lg font-semibold text-[var(--gh-ink)] focus:border-[var(--gh-ink)]"
            >
              <option value="">Choose a town…</option>
              {TOWN_GROUPS.map((group) => (
                <optgroup key={group.area} label={group.area}>
                  {group.towns.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name.replace(/,\s*BC$/, "")}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ),
      })}

      {Question({
        n: 2,
        title: "When?",
        children: (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="When"
            >
              {(
                [
                  ["saturday", "This Saturday"],
                  ["sunday", "This Sunday"],
                  ["weekend", "This weekend"],
                  ["dates", "Pick dates"],
                  ["later", "Not sure yet"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={when === id}
                  onClick={() => setWhen(id)}
                  className={chip(when === id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {when === "dates" && (
              <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                <label className="text-base font-semibold">
                  From
                  <input
                    type="date"
                    value={from}
                    min={today}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 block min-h-12 w-full rounded-2xl border-2 border-[var(--gh-line)] px-3"
                  />
                </label>
                <label className="text-base font-semibold">
                  To
                  <input
                    type="date"
                    value={to}
                    min={from || today}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-1 block min-h-12 w-full rounded-2xl border-2 border-[var(--gh-line)] px-3"
                  />
                </label>
              </div>
            )}
            <p
              className="mt-3 text-base text-[var(--gh-ink-soft)]"
              data-testid="create-when"
            >
              {days.length > 0
                ? `${whenLabel(dates.startsOn, dates.endsOn)} · ${days.length} ${days.length === 1 ? "day" : "days"}`
                : "No dates yet — you can add them later."}
              {tooLong ? " The end is before the start." : ""}
            </p>
          </>
        ),
      })}

      {Question({
        n: 3,
        title: "Who's coming?",
        children: (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Who">
              {PARTIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={party === p.id}
                  onClick={() =>
                    setParty((now) => (now === p.id ? undefined : p.id))
                  }
                  className={chip(party === p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {party === "family" && (
              <label className="mt-4 flex max-w-xs items-center gap-3 text-base font-semibold">
                Youngest is
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={17}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  aria-label="Age of the youngest"
                  className="block min-h-12 w-24 rounded-2xl border-2 border-[var(--gh-line)] px-3 text-center"
                />
              </label>
            )}
          </>
        ),
      })}

      {Question({
        n: 4,
        title: "What kind of adventure?",
        hint: "Pick any. Passport leans the days this way.",
        children: (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="What kind"
          >
            {VIBES.map((v) => {
              const on = vibes.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setVibes((now) =>
                      on ? now.filter((x) => x !== v.id) : [...now, v.id],
                    )
                  }
                  className={chip(on)}
                >
                  {on && <Check className="h-4 w-4" aria-hidden />}
                  {v.label}
                </button>
              );
            })}
          </div>
        ),
      })}

      {Question({
        n: 5,
        title: "Anything important?",
        hint: "In your own words — “home by 6”, “keep it within 30 minutes”, “no hiking”, “cheap”.",
        children: (
          <input
            data-testid="create-extra"
            value={extra}
            maxLength={160}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Home by 6, nothing too far"
            className="block min-h-14 w-full max-w-2xl rounded-2xl border-2 border-[var(--gh-line)] px-4 text-lg focus:border-[var(--gh-ink)]"
          />
        ),
      })}

      <div className="rounded-[28px] bg-[var(--gh-cream)] p-5 sm:p-7">
        <label className="block text-base font-semibold text-[var(--gh-ink)]">
          Call it
          <input
            data-testid="create-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={named}
            className="mt-1 block min-h-14 w-full max-w-xl rounded-2xl border-2 border-[var(--gh-line)] bg-white px-4 text-lg"
          />
        </label>

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            data-testid="create-sketch"
            checked={sketch}
            onChange={(e) => setSketch(e.target.checked)}
            className="mt-1 h-6 w-6 shrink-0 accent-[var(--gh-forest)]"
          />
          <span>
            <span className="block text-base font-semibold text-[var(--gh-ink)]">
              Sketch the days for me
            </span>
            <span className="block text-base text-[var(--gh-ink-soft)]">
              {!sketch
                ? "You'll start with a blank plan and add things yourself."
                : canSketch
                  ? "Real places from Atlas, in an order that works. They're suggestions — keep, swap or change anything."
                  : !town
                    ? "Choose a town above and Passport can sketch it."
                    : "Add dates above and Passport can sketch it."}
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="mt-4 text-base font-semibold text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          data-testid="create-submit"
          disabled={busy || Boolean(tooLong)}
          className={pillClass(
            "forest",
            "mt-6 min-h-14 w-full px-7 text-lg sm:w-auto",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {canSketch
                ? `Sketching your ${kind === "day" ? "day" : kind} from real places…`
                : "Starting it…"}
            </>
          ) : canSketch ? (
            <>
              <Sparkles className="h-5 w-5" aria-hidden />
              Create it and sketch the {days.length > 1 ? "days" : "day"}
            </>
          ) : (
            <>
              Create it
              <ArrowRight className="h-5 w-5" aria-hidden />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
