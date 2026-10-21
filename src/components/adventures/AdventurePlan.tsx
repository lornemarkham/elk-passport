"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Printer,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PossibilityCard } from "@/components/discovery-list/PossibilityCard";
import type { Experience } from "@/domain/experience/types";
import type { DayView, ItemView } from "@/lib/adventures/store";
import type { ResponseValue } from "@/lib/adventures/rules";
import {
  groupByDay,
  moveWithin,
  planHref,
  printHref,
  seedFor,
} from "@/lib/adventures/days";
import {
  momentLabel,
  responsesLabel,
  whenLabel,
} from "@/lib/adventures/present";
import { chainLegs, type LegEnd } from "@/lib/routing/legs";
import { useTravelLegs } from "@/lib/routing/useTravelLegs";
import { describeJourney, type Journey } from "@/lib/routing/journey";
import { distanceKm } from "@/lib/environment/geo";
import { cn } from "@/lib/utils";

/**
 * **The group's plan, a day at a time.**
 *
 * Saved things arrive here as **ideas**. A day is planned in Go Have a Day —
 * the same builder, reader, Atlas subjects and travel legs as everywhere
 * else — and comes back as that day's stops, in order, with the sentence it
 * was built from, so *Refine this day* reopens it rather than starting over.
 * By hand, the owner moves stops up and down, sends one back to the ideas,
 * or takes it off; everybody answers in, maybe or out for themselves.
 *
 * Anyone in the adventure proposes; the person who started it confirms and
 * places (RLS). An Atlas thing shows as the card Discovery shows for it,
 * where Discovery holds it, else by the name Atlas gives it; a place Atlas
 * doesn't hold shows in the group's own words.
 *
 * Same component for every kind — a Hockey Night's pregame spot and a
 * weekend's Sunday hike are both items on a plan.
 */
const ANSWERS: readonly { value: ResponseValue; label: string }[] = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Out" },
];

type Call = (url: string, method: string, body?: unknown) => Promise<void>;

export function AdventurePlan({
  adventureId,
  isOwner,
  items,
  atlasNames,
  experiences = {},
  timeZone,
  startsOn = null,
  endsOn = null,
  days = [],
  townId = null,
  today,
}: {
  adventureId: string;
  isOwner: boolean;
  items: readonly ItemView[];
  atlasNames: Readonly<Record<string, string>>;
  /** Discovery's possibility for each Atlas ref it holds (`atlasStopsFor`). */
  experiences?: Readonly<Record<string, Experience>>;
  timeZone: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  /** Days planned in Go Have a Day, and how each was asked for. */
  days?: readonly DayView[];
  townId?: string | null;
  /** Today where the subjects are, `YYYY-MM-DD`: the day a dateless plan starts on. */
  today: string;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [onDay, setOnDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [newDay, setNewDay] = useState(startsOn ?? today);

  const call: Call = async (url, method, body) => {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        response.status === 503
          ? "Adventures can't be reached right now."
          : (error.error ?? "That didn't work."),
      );
    }
  };

  async function propose(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await call(`/api/adventures/${adventureId}/items`, "POST", {
        label: label || null,
        note: note || null,
        onDay: onDay || null,
      });
      setLabel("");
      setNote("");
      setOnDay("");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(work: () => Promise<void>) {
    try {
      await work();
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const grouped = useMemo(
    () => groupByDay(items, startsOn, endsOn),
    [items, startsOn, endsOn],
  );
  const askOf = new Map(days.map((d) => [d.onDay, d.ask]));
  const dayChoices = grouped.days.map((d) => d.onDay);
  const nameOf = (item: ItemView) =>
    item.label ??
    (item.atlasRef ? atlasNames[item.atlasRef] : undefined) ??
    (item.atlasRef ? "A place Passport can't name right now" : null);

  const row = (
    item: ItemView,
    group: readonly ItemView[],
    index: number,
    where: "day" | "ideas",
  ) => (
    <PlanItem
      key={item.id}
      adventureId={adventureId}
      item={item}
      name={nameOf(item)}
      experience={item.atlasRef ? experiences[item.atlasRef] : undefined}
      number={where === "day" ? index + 1 : undefined}
      isOwner={isOwner}
      timeZone={timeZone}
      dayChoices={where === "ideas" ? dayChoices : []}
      onMove={(direction) => {
        const writes = moveWithin(group, item.id, direction);
        if (!writes) return;
        void act(async () => {
          for (const w of writes)
            await call(
              `/api/adventures/${adventureId}/items/${w.id}`,
              "PATCH",
              {
                position: w.position,
              },
            );
        });
      }}
      canMoveUp={index > 0}
      canMoveDown={index < group.length - 1}
      act={act}
      call={call}
    />
  );

  return (
    <section aria-labelledby="plan-heading" className="space-y-8">
      <h2 id="plan-heading" className="text-lg font-semibold">
        The plan
      </h2>

      {grouped.days.length === 0 && (
        <div
          className="rounded-xl border border-dashed p-5"
          data-testid="plan-first-day"
        >
          <p className="font-medium">
            {grouped.ideas.length > 0
              ? "Turn these ideas into a day."
              : "Nothing on the plan yet. Throw something in."}
          </p>
          {grouped.ideas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first-day">Which day?</Label>
                <Input
                  id="first-day"
                  type="date"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                />
              </div>
              <Link
                href={planHref({
                  adventureId,
                  onDay: newDay || today,
                  seed: seedFor([], grouped.ideas),
                  ask: null,
                  townId,
                })}
                data-testid="plan-day"
                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Plan it with Go Have a Day
              </Link>
            </div>
          )}
        </div>
      )}

      {grouped.days.map((day) => {
        const ask = askOf.get(day.onDay) ?? null;
        const stops = day.items.flatMap((i) =>
          i.atlasRef ? [i.atlasRef] : [],
        );
        const print = printHref(stops, ask);
        return (
          <div
            key={day.onDay}
            className="space-y-3"
            data-testid="plan-day-section"
            aria-label={whenLabel(day.onDay, null) ?? day.onDay}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-heading text-xl font-semibold">
                {whenLabel(day.onDay, null)}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={planHref({
                    adventureId,
                    onDay: day.onDay,
                    seed: seedFor(day.items, grouped.ideas),
                    ask,
                    townId,
                  })}
                  data-testid="plan-day"
                  className="bg-primary text-primary-foreground inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {ask ? "Refine this day" : "Plan this day"}
                </Link>
                {print && (
                  <Link
                    href={print}
                    data-testid="print-day"
                    className="hover:bg-muted inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium"
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    Print or share this day
                  </Link>
                )}
              </div>
            </div>
            {ask && (
              <p
                className="text-muted-foreground text-sm"
                data-testid="day-ask"
              >
                Built from “{new URLSearchParams(ask).get("say")}”
              </p>
            )}
            {day.items.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                Nothing on this day yet.
                {grouped.ideas.length > 0
                  ? " Plan it, and Passport builds it from the ideas below."
                  : ""}
              </p>
            ) : (
              <ol className="space-y-3" aria-label={`Stops, ${day.onDay}`}>
                {day.items.map((item, index) => (
                  <li key={item.id} className="space-y-3">
                    {index > 0 && (
                      <Between
                        from={day.items[index - 1]!}
                        to={item}
                        experiences={experiences}
                        names={atlasNames}
                      />
                    )}
                    {row(item, day.items, index, "day")}
                  </li>
                ))}
              </ol>
            )}
            {day.items.length > 1 && (
              <DayTravel items={day.items} experiences={experiences} />
            )}
          </div>
        );
      })}

      {(grouped.ideas.length > 0 || grouped.days.length > 0) && (
        <div className="space-y-3" data-testid="plan-ideas">
          <h3 className="font-heading text-xl font-semibold">
            Ideas, not on a day yet
          </h3>
          {grouped.ideas.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              None waiting. Add more from{" "}
              <Link href="/saved" className="underline">
                Saved
              </Link>
              .
            </p>
          ) : (
            <ol className="space-y-3" aria-label="Ideas">
              {grouped.ideas.map((item, index) => (
                <li key={item.id}>
                  {row(item, grouped.ideas, index, "ideas")}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <form
        onSubmit={propose}
        className="space-y-3 rounded-xl border border-dashed p-4"
        aria-label="Propose something"
      >
        <p className="text-sm font-medium">
          {isOwner ? "Add to the plan" : "Propose something"}
        </p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="item-label">What or where</Label>
            <Input
              id="item-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              placeholder="Pregame at the pub on Abbott"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-day">Day (optional)</Label>
            <Input
              id="item-day"
              type="date"
              value={onDay}
              onChange={(e) => setOnDay(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-note">Note (optional)</Label>
          <Input
            id="item-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Doors at 5"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={busy || (!label.trim() && !note.trim())}
        >
          {isOwner ? "Add it" : "Propose it"}
        </Button>
      </form>
    </section>
  );
}

function PlanItem({
  adventureId,
  item,
  name,
  experience,
  number,
  isOwner,
  timeZone,
  dayChoices,
  onMove,
  canMoveUp,
  canMoveDown,
  act,
  call,
}: {
  adventureId: string;
  item: ItemView;
  name: string | null;
  experience: Experience | undefined;
  /** The stop's place in its day; none for an idea. */
  number: number | undefined;
  isOwner: boolean;
  timeZone: string | null;
  /** Days an idea can be put on. Empty for a stop already on one. */
  dayChoices: readonly string[];
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  act: (work: () => Promise<void>) => Promise<void>;
  call: Call;
}) {
  const base = `/api/adventures/${adventureId}/items`;
  const when = item.startsAt ? momentLabel(item.startsAt, timeZone) : null;
  const counts = responsesLabel(item.responses);
  const small =
    "hover:bg-muted inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs disabled:opacity-40";
  return (
    <div
      className="rounded-xl border p-4 sm:flex sm:gap-4"
      data-testid="plan-item"
    >
      {experience && (
        <div className="mb-3 sm:mb-0 sm:w-56 sm:shrink-0">
          <PossibilityCard
            experience={experience}
            saved
            saving={false}
            onSave={() => {}}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {name && (
              <p className="font-medium">
                {number !== undefined && (
                  <span className="text-muted-foreground mr-1.5 tabular-nums">
                    {number}.
                  </span>
                )}
                {name}
              </p>
            )}
            {item.note && (
              <p className="text-muted-foreground text-sm">{item.note}</p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {item.status === "confirmed" ? "On" : "Proposed"}
              {when ? ` · ${when}` : ""}
              {counts ? ` · ${counts}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {isOwner && item.status === "proposed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  act(() =>
                    call(`${base}/${item.id}`, "PATCH", {
                      status: "confirmed",
                    }),
                  )
                }
              >
                Confirm
              </Button>
            )}
            {item.canChange && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove${name ? ` ${name}` : ""}`}
                onClick={() => act(() => call(`${base}/${item.id}`, "DELETE"))}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={small}
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              aria-label={`Move ${name ?? "this"} earlier`}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={small}
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              aria-label={`Move ${name ?? "this"} later`}
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </button>
            {number !== undefined && (
              <button
                type="button"
                className={small}
                onClick={() =>
                  act(() =>
                    call(`${base}/${item.id}`, "PATCH", { onDay: null }),
                  )
                }
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                Back to ideas
              </button>
            )}
            {dayChoices.length > 0 && (
              <label className="inline-flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Put on</span>
                <select
                  className="h-8 rounded-full border bg-transparent px-2"
                  defaultValue=""
                  aria-label={`Put ${name ?? "this"} on a day`}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    if (!chosen) return;
                    void act(() =>
                      call(`${base}/${item.id}`, "PATCH", {
                        onDay: chosen,
                        status: "confirmed",
                      }),
                    );
                  }}
                >
                  <option value="">a day…</option>
                  {dayChoices.map((d) => (
                    <option key={d} value={d}>
                      {whenLabel(d, null)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <div
          className="mt-3 flex gap-2"
          role="group"
          aria-label={`Your answer${name ? ` on ${name}` : ""}`}
        >
          {ANSWERS.map((answer) => {
            const chosen = item.yourResponse === answer.value;
            return (
              <button
                key={answer.value}
                type="button"
                aria-pressed={chosen}
                onClick={() =>
                  act(() =>
                    call(`${base}/${item.id}/response`, "PUT", {
                      response: chosen ? null : answer.value,
                    }),
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  chosen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted",
                )}
              >
                {answer.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const endOf = (
  item: ItemView,
  experiences: Readonly<Record<string, Experience>>,
  names: Readonly<Record<string, string>>,
): LegEnd => {
  const e = item.atlasRef ? experiences[item.atlasRef] : undefined;
  const c = e?.geography?.coordinates;
  return {
    ...(item.atlasRef ? { id: item.atlasRef } : {}),
    name:
      e?.title ??
      item.label ??
      (item.atlasRef ? (names[item.atlasRef] ?? "a stop") : "a stop"),
    ...(c ? { at: { latitude: c[1], longitude: c[0] } } : {}),
  };
};

/**
 * **How far, between two stops** — Atlas's routed journey where it has one
 * (`/travel/legs`, the Day Builder's own), a straight line labelled as one
 * where it does not, and nothing invented where a stop is not placed.
 */
function Between({
  from,
  to,
  experiences,
  names,
}: {
  from: ItemView;
  to: ItemView;
  experiences: Readonly<Record<string, Experience>>;
  names: Readonly<Record<string, string>>;
}) {
  const legs = useMemo(
    () =>
      chainLegs(undefined, [
        endOf(from, experiences, names),
        endOf(to, experiences, names),
      ]),
    [from, to, experiences, names],
  );
  const { journeys, status } = useTravelLegs(legs, "driving");
  const leg = legs[0]!;
  const words = journeyWords(
    journeys[0],
    leg.from.at && leg.to.at ? distanceKm(leg.from.at, leg.to.at) : undefined,
  );
  return (
    <p
      className="text-muted-foreground flex items-center gap-2 pl-4 text-xs"
      data-testid="plan-leg"
    >
      <ArrowRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
      {status === "loading" ? "Asking Atlas how far…" : words}
    </p>
  );
}

function journeyWords(
  journey: Journey | undefined,
  straightKm: number | undefined,
): string {
  if (journey && journey.kind !== "unknown") {
    const { headline, caveat } = describeJourney(journey);
    return `${headline}. ${caveat}`;
  }
  if (straightKm !== undefined) {
    const { headline, caveat } = describeJourney({
      kind: "straight-line",
      km: straightKm,
      basis: "coordinates",
    });
    return `${headline}. ${caveat}`;
  }
  return "Passport can't place one of these, so it can't say how far.";
}

/** The day's driving, summed only over routed legs — "at least" otherwise. */
function DayTravel({
  items,
  experiences,
}: {
  items: readonly ItemView[];
  experiences: Readonly<Record<string, Experience>>;
}) {
  const legs = useMemo(
    () =>
      chainLegs(
        undefined,
        items.map((i) => endOf(i, experiences, {})),
      ),
    [items, experiences],
  );
  const { journeys, status } = useTravelLegs(legs, "driving");
  if (status !== "ready") return null;
  const routed = journeys.filter(
    (j): j is Extract<Journey, { kind: "routed" }> =>
      j?.kind === "routed" && !j.accessCaution && !j.areaPoint,
  );
  if (routed.length === 0) return null;
  const minutes = routed.reduce((sum, j) => sum + j.minutes, 0);
  const all = routed.length === legs.length;
  return (
    <p className="text-sm" data-testid="day-travel">
      {all ? "About" : "At least"} {minutes} min driving between stops
      {all ? "" : ` (${legs.length - routed.length} not measured)`}.
    </p>
  );
}
