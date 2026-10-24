"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ExternalLink, Plus, Printer, Sparkles, X } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { DayView, ItemView } from "@/lib/adventures/store";
import type { DayDetail } from "@/lib/adventures/propose";
import {
  groupByDay,
  isPassportSuggestion,
  planHref,
  printHref,
  seedFor,
} from "@/lib/adventures/days";
import { weekdayLabel, whenLabel } from "@/lib/adventures/present";
import { cn } from "@/lib/utils";
import { Picture } from "../Picture";
import { pillClass, SectionHeading, toneFor } from "../kit";
import { Between, DayTravel } from "./Legs";
import { ChangeBox, type ChangeHandle } from "./ChangeBox";
import { Answers, StopCard } from "./StopCard";
import { SavedSuggestions } from "./SavedSuggestions";
import { TodayPanel } from "./TodayPanel";
import { useAdventure } from "./useAdventure";

/**
 * **An adventure, as a travel journal you can change** (ADR 012).
 *
 * Today first, on the day. Then the one sentence box that shapes it. Then
 * each day in its own colour — a timeline of stops with the way between
 * them — and the saved places that could join it, the ideas waiting for a
 * day, and a quiet way to add your own. `/go` is still a tap away on every
 * day for the full workbench (ADR 010 §3).
 *
 * Postgres decides who may do what (RLS); controls only appear for what the
 * person may do: the owner keeps, moves and places; everyone answers and
 * suggests.
 */
export function AdventureJourney({
  adventureId,
  isOwner,
  items,
  atlasNames,
  experiences,
  startsOn,
  endsOn,
  days,
  details,
  townId,
  today,
  saved,
  atlasDown,
}: {
  readonly adventureId: string;
  readonly isOwner: boolean;
  readonly items: readonly ItemView[];
  readonly atlasNames: Readonly<Record<string, string>>;
  readonly experiences: Readonly<Record<string, Experience>>;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly days: readonly DayView[];
  readonly details: Readonly<Record<string, DayDetail>>;
  readonly townId: string | null;
  readonly today: string;
  /** The person's saved places this adventure doesn't hold. */
  readonly saved: readonly Experience[];
  /** Atlas didn't answer: Passport can't suggest, everything manual works. */
  readonly atlasDown: boolean;
}) {
  const { call, act, busy } = useAdventure(adventureId);
  const changes = useRef<ChangeHandle>(null);
  const requestChange = (said: string) => changes.current?.ask(said);

  const grouped = useMemo(
    () => groupByDay(items, startsOn, endsOn),
    [items, startsOn, endsOn],
  );
  const dayList = grouped.days.map((d) => d.onDay);
  const askOf = new Map(days.map((d) => [d.onDay, d.ask]));
  const nameOf = (item: ItemView) =>
    item.label ??
    (item.atlasRef
      ? (experiences[item.atlasRef]?.title ?? atlasNames[item.atlasRef])
      : undefined) ??
    (item.atlasRef ? "A place Passport can't name right now" : "Something");
  const todays = grouped.days.find((d) => d.onDay === today);

  return (
    <div className="space-y-12">
      {todays && todays.items.length > 0 && (
        <TodayPanel
          adventureId={adventureId}
          onDay={today}
          stops={todays.items}
          names={atlasNames}
          experiences={experiences}
          detail={details[today]}
        />
      )}

      {atlasDown ? (
        <p
          role="status"
          data-testid="atlas-down"
          className="rounded-3xl bg-[var(--gh-cream)] p-5 text-base"
        >
          Atlas can&apos;t be reached right now, so Passport can&apos;t suggest
          places or changes. Everything on the plan is safe, and you can still
          move, keep, remove and add things by hand.
        </p>
      ) : (
        <ChangeBox
          isOwner={isOwner}
          call={call}
          act={act}
          busy={busy}
          handle={changes}
          hasDays={dayList.length > 0}
        />
      )}

      <section aria-labelledby="plan-heading" className="space-y-10">
        <h2 id="plan-heading" className="sr-only">
          The plan
        </h2>
        {grouped.days.length === 0 && (
          <div
            data-testid="plan-first-day"
            className="rounded-[28px] border-2 border-dashed border-[var(--gh-line)] p-6 text-center sm:p-10"
          >
            <p className="ghad-display text-2xl font-extrabold">
              {grouped.ideas.length > 0
                ? "Give these ideas a day."
                : "A blank page. The best kind."}
            </p>
            <p className="mx-auto mt-2 max-w-md text-base text-[var(--gh-ink-soft)]">
              Pick a date and Passport can sketch it from real places, or open
              it in Go Have a Day.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <PlanLink
                adventureId={adventureId}
                onDay={startsOn ?? today}
                seed={seedFor([], grouped.ideas)}
                ask={null}
                townId={townId}
                label="Plan it with Go Have a Day"
                primary
              />
            </div>
          </div>
        )}

        {grouped.days.map((day, index) => {
          const tone = toneFor(index);
          const detail = details[day.onDay];
          const ask = askOf.get(day.onDay) ?? null;
          const stops = day.items.flatMap((i) =>
            i.atlasRef ? [i.atlasRef] : [],
          );
          const print = printHref(stops, ask);
          const undecided = day.items.filter(
            (i) => i.status === "proposed",
          ).length;
          return (
            <section
              key={day.onDay}
              data-testid="plan-day-section"
              aria-label={whenLabel(day.onDay, null) ?? day.onDay}
              className="overflow-hidden rounded-[28px] bg-[var(--gh-cream)]"
            >
              <header
                className="flex flex-wrap items-end justify-between gap-3 px-5 pt-6 pb-5 sm:px-8"
                style={{ background: tone.bg, color: tone.ink }}
              >
                <div>
                  <p className="text-xs font-bold tracking-[0.14em] uppercase opacity-85">
                    Day {index + 1} · {whenLabel(day.onDay, null)}
                    {day.onDay === today ? " · today" : ""}
                  </p>
                  <h3 className="ghad-display mt-1 text-4xl leading-none font-extrabold tracking-[-0.035em] sm:text-5xl">
                    {weekdayLabel(day.onDay)}
                  </h3>
                  {detail?.title && (
                    <p
                      className="mt-2 text-lg font-semibold opacity-95"
                      data-testid="day-title"
                    >
                      {detail.title}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold opacity-90">
                  {day.items.length === 0
                    ? "Nothing yet"
                    : `${day.items.length} ${day.items.length === 1 ? "stop" : "stops"}${undecided > 0 ? ` · ${undecided} to decide` : " · all kept"}`}
                </p>
              </header>

              <div className="space-y-3 px-3 py-5 sm:px-6">
                {ask && (
                  <p
                    className="px-2 text-sm text-[var(--gh-ink-soft)]"
                    data-testid="day-ask"
                  >
                    Built from “{new URLSearchParams(ask).get("say")}”
                  </p>
                )}
                {day.items.length === 0 ? (
                  <div className="rounded-3xl bg-white p-6 text-center">
                    <p className="ghad-display text-xl font-extrabold">
                      {weekdayLabel(day.onDay)} is wide open.
                    </p>
                    <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                      Let Passport sketch it, or put one of your ideas on it.
                    </p>
                    {isOwner && !atlasDown && (
                      <button
                        type="button"
                        data-testid="sketch-day"
                        onClick={() =>
                          requestChange(`sketch ${weekdayLabel(day.onDay)}`)
                        }
                        className={pillClass("forest", "mt-4")}
                      >
                        <Sparkles className="h-4 w-4" aria-hidden />
                        Sketch {weekdayLabel(day.onDay)}
                      </button>
                    )}
                  </div>
                ) : (
                  <ol className="space-y-1" aria-label={`Stops, ${day.onDay}`}>
                    {day.items.map((item, i) => (
                      <li key={item.id}>
                        {i > 0 && (
                          <div className="ml-6 border-l-2 border-dashed border-[var(--gh-line)] pl-5 sm:ml-10">
                            <Between
                              from={day.items[i - 1]!}
                              to={item}
                              experiences={experiences}
                              names={atlasNames}
                            />
                          </div>
                        )}
                        <StopCard
                          item={item}
                          name={nameOf(item)}
                          experience={
                            item.atlasRef
                              ? experiences[item.atlasRef]
                              : undefined
                          }
                          detail={
                            item.atlasRef
                              ? detail?.stops[item.atlasRef]
                              : undefined
                          }
                          index={i}
                          count={day.items.length}
                          onDay={day.onDay}
                          otherDays={dayList.filter((d) => d !== day.onDay)}
                          isOwner={isOwner}
                          tone={tone}
                          busy={busy}
                          act={act}
                          call={call}
                          requestChange={atlasDown ? () => {} : requestChange}
                        />
                      </li>
                    ))}
                  </ol>
                )}
                {day.items.length > 1 && (
                  <div className="px-2">
                    <DayTravel items={day.items} experiences={experiences} />
                  </div>
                )}
                {detail && detail.unknowns.length > 0 && (
                  <details className="px-2 text-sm text-[var(--gh-ink-soft)]">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-[var(--gh-ink)]">
                      What Passport couldn&apos;t check
                    </summary>
                    <ul className="list-disc space-y-1 pl-5">
                      {detail.unknowns.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="flex flex-wrap gap-2 px-2 pt-2">
                  <PlanLink
                    adventureId={adventureId}
                    onDay={day.onDay}
                    seed={seedFor(day.items, grouped.ideas)}
                    ask={ask}
                    townId={townId}
                    label={ask ? "Refine this day" : "Plan this day"}
                  />
                  {print && (
                    <Link
                      href={print}
                      data-testid="print-day"
                      className={pillClass("quiet")}
                    >
                      <Printer className="h-4 w-4" aria-hidden />
                      Print or share this day
                    </Link>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </section>

      <SavedSuggestions
        saved={saved}
        days={dayList}
        isOwner={isOwner}
        busy={busy}
        act={act}
        call={call}
      />

      {(grouped.ideas.length > 0 || grouped.days.length > 0) && (
        <section aria-labelledby="ideas-heading" data-testid="plan-ideas">
          <SectionHeading
            id="ideas-heading"
            eyebrow="Ideas"
            title="Not on a day yet"
          >
            Things somebody wants to do here. Put one on a day when you&apos;re
            ready.
          </SectionHeading>
          {grouped.ideas.length === 0 ? (
            <p className="mt-4 text-base text-[var(--gh-ink-soft)]">
              None waiting. Add more from{" "}
              <Link
                href={`/saved?adventure=${encodeURIComponent(adventureId)}`}
                className="font-semibold underline"
              >
                Saved
              </Link>
              .
            </p>
          ) : (
            <ol
              className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
              aria-label="Ideas"
            >
              {grouped.ideas.map((item) => (
                <li key={item.id}>
                  <IdeaCard
                    item={item}
                    name={nameOf(item)}
                    experience={
                      item.atlasRef ? experiences[item.atlasRef] : undefined
                    }
                    days={dayList}
                    isOwner={isOwner}
                    busy={busy}
                    act={act}
                    call={call}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <AddYourOwn
        days={dayList}
        isOwner={isOwner}
        busy={busy}
        act={act}
        call={call}
      />
    </div>
  );
}

function PlanLink({
  adventureId,
  onDay,
  seed,
  ask,
  townId,
  label,
  primary = false,
}: {
  readonly adventureId: string;
  readonly onDay: string;
  readonly seed: readonly string[];
  readonly ask: string | null;
  readonly townId: string | null;
  readonly label: string;
  readonly primary?: boolean;
}) {
  return (
    <Link
      href={planHref({ adventureId, onDay, seed, ask, townId })}
      data-testid="plan-day"
      className={pillClass(primary ? "forest" : "quiet")}
    >
      <ExternalLink className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

function IdeaCard({
  item,
  name,
  experience,
  days,
  isOwner,
  busy,
  act,
  call,
}: {
  readonly item: ItemView;
  readonly name: string;
  readonly experience: Experience | undefined;
  readonly days: readonly string[];
  readonly isOwner: boolean;
  readonly busy: boolean;
  readonly act: (
    work: () => Promise<unknown>,
    done?: string,
  ) => Promise<boolean>;
  readonly call: <T = unknown>(
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<T>;
}) {
  const path = `/items/${item.id}`;
  return (
    <article
      data-testid="plan-item"
      className="flex h-full gap-3 rounded-3xl border border-[var(--gh-line)] bg-white p-3"
    >
      <Picture
        experience={experience}
        fallbackTitle={name}
        showLabel={false}
        className="aspect-square w-20 shrink-0 rounded-2xl"
      />
      <div className="min-w-0 flex-1">
        <p className="ghad-display text-lg leading-tight font-extrabold">
          {name}
        </p>
        <p className="text-xs font-bold text-[var(--gh-ink-soft)]">
          {item.status === "confirmed"
            ? "Kept"
            : item.mine
              ? "Your idea"
              : "From the group"}
        </p>
        {item.note && (
          <p className="text-sm text-[var(--gh-ink-soft)]">{item.note}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {isOwner && item.status === "proposed" && days.length === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(
                  () => call(path, "PATCH", { status: "confirmed" }),
                  `Kept ${name}.`,
                )
              }
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[var(--gh-forest)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Keep
            </button>
          )}
          {isOwner &&
            days.slice(0, 3).map((d) => (
              <button
                key={d}
                type="button"
                disabled={busy}
                onClick={() =>
                  act(
                    () =>
                      call(path, "PATCH", { onDay: d, status: "confirmed" }),
                    `${name} is on ${weekdayLabel(d)}.`,
                  )
                }
                aria-label={`Put ${name} on ${weekdayLabel(d)}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[var(--gh-forest)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {weekdayLabel(d)}
              </button>
            ))}
          {item.canChange && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(() => call(path, "DELETE"), `Took ${name} off.`)
              }
              aria-label={`Remove ${name}`}
              className={cn(
                "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--gh-ink-soft)] hover:bg-[var(--gh-cream)]",
                isPassportSuggestion(item) && "italic",
              )}
            >
              <X className="h-4 w-4" aria-hidden />
              Remove
            </button>
          )}
        </div>
        <Answers item={item} name={name} busy={busy} act={act} call={call} />
      </div>
    </article>
  );
}

/** A place Atlas doesn't hold, a time, a note — in the group's own words. */
function AddYourOwn({
  days,
  isOwner,
  busy,
  act,
  call,
}: {
  readonly days: readonly string[];
  readonly isOwner: boolean;
  readonly busy: boolean;
  readonly act: (
    work: () => Promise<unknown>,
    done?: string,
  ) => Promise<boolean>;
  readonly call: <T = unknown>(
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<T>;
}) {
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [onDay, setOnDay] = useState("");
  return (
    <details className="rounded-[28px] border border-[var(--gh-line)] bg-white p-5 sm:p-7">
      <summary className="ghad-display inline-flex min-h-11 cursor-pointer items-center text-xl font-extrabold">
        {isOwner ? "Add something of your own" : "Propose something"}
      </summary>
      <form
        aria-label="Propose something"
        className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act(
            () =>
              call("/items", "POST", {
                label: label || null,
                note: note || null,
                onDay: onDay || null,
              }),
            isOwner ? "Added." : "Proposed.",
          );
          if (ok) {
            setLabel("");
            setNote("");
            setOnDay("");
          }
        }}
      >
        <label className="text-base font-semibold">
          What or where
          <input
            id="item-label"
            value={label}
            maxLength={120}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Breakfast at Mom's"
            className="mt-1 block min-h-12 w-full rounded-2xl border-2 border-[var(--gh-line)] px-3 font-normal"
          />
        </label>
        <label className="text-base font-semibold">
          Day
          <select
            value={onDay}
            onChange={(e) => setOnDay(e.target.value)}
            className="mt-1 block min-h-12 w-full rounded-2xl border-2 border-[var(--gh-line)] bg-white px-3 font-normal"
          >
            <option value="">Just an idea</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {weekdayLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-base font-semibold sm:col-span-2">
          Note
          <input
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bring the good cooler"
            className="mt-1 block min-h-12 w-full rounded-2xl border-2 border-[var(--gh-line)] px-3 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={busy || (!label.trim() && !note.trim())}
          className={pillClass("primary", "sm:col-span-2 sm:w-fit")}
        >
          {isOwner ? "Add it" : "Propose it"}
        </button>
      </form>
    </details>
  );
}
