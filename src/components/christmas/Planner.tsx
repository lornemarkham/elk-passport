"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { TOWN_GROUPS, townById } from "@/domain/discovery/towns";
import type { Party } from "@/domain/christmas/discover";
import {
  dayLabel,
  daysOf,
  place,
  SHAPES,
  shapeById,
  type ShapeId,
} from "@/domain/christmas/plans";
import { addDays, type WhenReading } from "@/domain/christmas/when";
import { cn } from "@/lib/utils";

export interface PlanPick {
  readonly id: string;
  readonly title: string;
  readonly emoji: string;
  readonly when?: WhenReading;
  /** From Saved rather than picked here. */
  readonly fromSaved?: boolean;
}

const field =
  "min-h-12 w-full rounded-2xl border-2 border-black/10 bg-white px-3 text-base focus:border-[#0f3b2b] focus:outline-none";
const label = "block text-sm font-bold text-[var(--gh-ink-soft)]";
const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-base font-semibold transition-colors",
    on
      ? "border-[#0f3b2b] bg-[#0f3b2b] text-white"
      : "border-black/10 bg-white hover:border-black/30",
  );

const PARTIES: readonly { id: Party; label: string }[] = [
  { id: "family", label: "Family with kids" },
  { id: "friends", label: "Friends" },
  { id: "couple", label: "The two of us" },
  { id: "solo", label: "Just me" },
];

/** The coming Saturday (today, if it is one). */
function nextSaturday(today: string): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, dow === 6 ? 0 : 6 - dow);
}

/**
 * **Build a Christmas adventure.** Never blank (ADR 012): five quick
 * answers, and the Day Builder sketches every day from real Atlas places,
 * kept around the Christmas things that were chosen. Live, before anything
 * is written, it says which chosen events Atlas dates outside the plan.
 */
export function Planner({
  today,
  initialShape,
  initialTown,
  initialFrom,
  initialParty,
  initialAges,
  initialPeople,
  initialTitle,
  initialExtra,
  picks,
  saved,
}: {
  readonly today: string;
  readonly initialShape: ShapeId;
  readonly initialTown?: string;
  readonly initialFrom?: string;
  readonly initialParty?: Party;
  readonly initialAges: readonly number[];
  readonly initialPeople?: number;
  readonly initialTitle?: string;
  /** The sentence somebody said on the Christmas page, kept as said. */
  readonly initialExtra?: string;
  readonly picks: readonly PlanPick[];
  readonly saved: readonly PlanPick[];
}) {
  const router = useRouter();
  const [shapeId, setShapeId] = useState<ShapeId>(initialShape);
  const shape = shapeById(shapeId);
  const [chosen, setChosen] = useState<string[]>(picks.map((p) => p.id));
  const [townId, setTownId] = useState(initialTown ?? "");
  const [first, setFirst] = useState(
    initialFrom && initialFrom >= today ? initialFrom : nextSaturday(today),
  );
  const [length, setLength] = useState(shape.days);
  const [party, setParty] = useState<Party | undefined>(initialParty);
  const [ages, setAges] = useState(initialAges.join(", "));
  const [people, setPeople] = useState(
    initialPeople ? String(initialPeople) : "",
  );
  const [extra, setExtra] = useState(initialExtra ?? "");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [sketch, setSketch] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = shapeId === "multi" ? length : shape.days;
  const days = useMemo(() => daysOf(first, count), [first, count]);
  const everything = useMemo(() => {
    const all = new Map<string, PlanPick>();
    for (const p of [...picks, ...saved]) all.set(p.id, p);
    return all;
  }, [picks, saved]);
  const placement = useMemo(
    () =>
      place(
        chosen.flatMap((id) => {
          const p = everything.get(id);
          return p?.when ? [{ id, when: p.when }] : [];
        }),
        days,
      ),
    [chosen, everything, days],
  );
  const town = townById(townId);
  const ageList = ages
    .split(",")
    .filter((a) => a.trim() !== "")
    .map((a) => Number(a.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17);
  const youngest = ageList.length ? Math.min(...ageList) : undefined;
  const named =
    title.trim() ||
    `${shape.title}${town ? ` in ${town.name.replace(/,\s*BC$/, "")}` : ""}`;

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/christmas/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shape: shapeId,
          title: named,
          startsOn: first,
          days: count,
          townId: town?.id ?? null,
          atlasRefs: chosen,
          ...(party ? { party } : {}),
          ...(youngest !== undefined ? { youngest } : {}),
          extra: [people ? `${people} of us` : "", extra]
            .filter(Boolean)
            .join(", "),
          sketch,
        }),
      });
      if (response.status === 401) {
        window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) {
        setError(body.error ?? "Couldn't start it. Please try again.");
        return;
      }
      // The picks are in the plan now; the tray starts empty next time.
      window.sessionStorage.removeItem("passport.christmas.picks");
      const note = new URLSearchParams({
        started: body.sketch ?? "manual",
        ...(body.offDates ? { off: String(body.offDates) } : {}),
      });
      router.push(`/christmas/adventure/${body.id}?${note.toString()}`);
    } catch {
      setError("Couldn't start it. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const step = (n: number, text: string) => (
    <h2 className="ghad-display flex items-center gap-3 text-2xl font-extrabold">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#b3242f] text-base text-white">
        {n}
      </span>
      {text}
    </h2>
  );

  return (
    <form
      onSubmit={start}
      className="space-y-10"
      aria-label="Plan a Christmas adventure"
    >
      <section className="space-y-4">
        {step(1, "What kind of Christmas?")}
        <div
          className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3"
          role="radiogroup"
        >
          {SHAPES.map((sh) => (
            <button
              key={sh.id}
              type="button"
              role="radio"
              aria-checked={shapeId === sh.id}
              onClick={() => {
                setShapeId(sh.id);
                setLength(sh.days);
              }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-[22px] border-2 p-3 text-left transition-colors last:col-span-2 sm:flex-row sm:gap-3 sm:p-4 lg:last:col-span-1",
                shapeId === sh.id
                  ? "border-[#b3242f] bg-[#f7e3e1]"
                  : "border-black/10 bg-white hover:border-black/30",
              )}
              data-testid={`plan-shape-${sh.id}`}
            >
              <span className="text-3xl" aria-hidden>
                {sh.emoji}
              </span>
              <span>
                <span className="block text-base leading-tight font-bold sm:text-lg">
                  {sh.label}
                </span>
                <span className="text-xs text-[var(--gh-ink-soft)] sm:text-sm">
                  {sh.line}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {step(2, "What's going in")}
        {picks.length === 0 && saved.length === 0 && (
          <p className="text-base text-[var(--gh-ink-soft)]">
            Nothing picked yet — that&apos;s fine. Passport will sketch from
            real places, or{" "}
            <Link
              href="/christmas/discover"
              className="font-semibold underline underline-offset-4"
            >
              pick some Christmas things first
            </Link>
            .
          </p>
        )}
        {[...picks, ...saved].length > 0 && (
          <ul
            className="grid gap-2 sm:grid-cols-2"
            data-testid="plan-picks-list"
          >
            {[
              ...picks,
              ...saved.filter((sv) => !picks.some((p) => p.id === sv.id)),
            ].map((p) => {
              const on = chosen.includes(p.id);
              const off = on && placement.offDates.includes(p.id);
              const pinned = on ? placement.pinned[p.id] : undefined;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[18px] border-2 p-3 text-left",
                      on
                        ? "border-[#0f3b2b] bg-white"
                        : "border-dashed border-black/15 bg-transparent",
                    )}
                  >
                    <span className="text-2xl" aria-hidden>
                      {p.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{p.title}</span>
                      <span className="block text-sm text-[var(--gh-ink-soft)]">
                        {p.fromSaved ? "From your Saved · " : ""}
                        {p.when?.line ?? "No dates from Atlas"}
                      </span>
                      {off && (
                        <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#8e1d26]">
                          <AlertTriangle className="h-4 w-4" aria-hidden />
                          Atlas dates this outside your days — it&apos;ll wait
                          as an idea.
                        </span>
                      )}
                      {pinned && (
                        <span className="mt-1 block text-sm font-semibold text-[#0f3b2b]">
                          Goes on {dayLabel(pinned)} — the day Atlas has it.
                        </span>
                      )}
                    </span>
                    {on ? (
                      <Check
                        className="h-5 w-5 shrink-0 text-[#0f3b2b]"
                        aria-label="In"
                      />
                    ) : (
                      <Plus className="h-5 w-5 shrink-0" aria-label="Add" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        {step(3, "Where and when")}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <span className={label}>Starting from</span>
            <select
              value={townId}
              onChange={(e) => setTownId(e.target.value)}
              className={field}
              data-testid="plan-town"
            >
              <option value="">Choose a town…</option>
              {TOWN_GROUPS.map((g) => (
                <optgroup key={g.area} label={g.area}>
                  {g.towns.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name.replace(/,\s*BC$/, "")}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={label}>{count > 1 ? "First day" : "The day"}</span>
            <input
              type="date"
              value={first}
              min={today}
              onChange={(e) => e.target.value && setFirst(e.target.value)}
              className={field}
              data-testid="plan-date"
            />
          </label>
          {shapeId === "multi" && (
            <label className="space-y-1">
              <span className={label}>How many days</span>
              <select
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className={field}
              >
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="text-sm text-[var(--gh-ink-soft)]">
          {days.length > 1
            ? `${days.length} days: ${days.map((d) => dayLabel(d, true)).join(" · ")}`
            : ""}
          {!town &&
            " Passport needs a town to sketch the days — it asks rather than guesses."}
        </p>
      </section>

      <section className="space-y-4">
        {step(4, "Who's coming")}
        <div className="flex flex-wrap gap-2">
          {PARTIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setParty(party === p.id ? undefined : p.id)}
              aria-pressed={party === p.id}
              className={chip(party === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(party === "family" || shapeId === "family-day") && (
            <label className="space-y-1">
              <span className={label}>Children&apos;s ages</span>
              <input
                value={ages}
                onChange={(e) => setAges(e.target.value)}
                inputMode="numeric"
                placeholder="e.g. 4, 9"
                className={field}
                data-testid="plan-ages"
              />
            </label>
          )}
          <label className="space-y-1">
            <span className={label}>How many of you</span>
            <input
              value={people}
              onChange={(e) =>
                setPeople(e.target.value.replace(/\D/g, "").slice(0, 2))
              }
              inputMode="numeric"
              placeholder="e.g. 5"
              className={field}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        {step(5, "Anything important?")}
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="home by 8 · within 30 minutes · Gran uses a walker"
          className={field}
          maxLength={160}
        />
        <label className="space-y-1">
          <span className={label}>Call it</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={named}
            className={field}
            maxLength={120}
            data-testid="plan-title"
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
          <input
            type="checkbox"
            checked={sketch}
            onChange={(e) => setSketch(e.target.checked)}
            className="h-5 w-5 accent-[#0f3b2b]"
          />
          Sketch the days for me from real places
        </label>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-[#f7e3e1] p-4 font-semibold text-[#8e1d26]"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 align-middle"
            aria-label="Dismiss"
          >
            <X className="inline h-4 w-4" />
          </button>
        </p>
      )}

      <div className="sticky bottom-3 z-30">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#b3242f] px-6 text-lg font-bold text-white shadow-xl hover:brightness-110 disabled:opacity-70"
          data-testid="plan-start"
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Sketching your Christmas…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" aria-hidden />
              Make our Christmas plan
            </>
          )}
        </button>
      </div>
    </form>
  );
}
