"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Car,
  ChevronDown,
  Navigation,
  Pencil,
  Plus,
  Sunset,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Picture } from "@/components/adventures/Picture";
import type { Experience } from "@/domain/experience/types";
import {
  directionsTo,
  type Evening,
} from "@/domain/date-night/adventures/evenings";
import {
  clock,
  endingOf,
  fixedAt,
  homeAt,
  type PlanStop,
  type Warning,
} from "@/domain/date-night/adventures/itinerary";
import { cardPictures } from "@/lib/media/cardPicture";
import { cn } from "@/lib/utils";

const realPhoto = (e: Experience | undefined): boolean =>
  Boolean(e && cardPictures(e)[0] && !cardPictures(e)[0]!.label);

/** "1 h 40", "45 min". */
function length(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export interface StopFields {
  readonly title: string;
  readonly line: string;
  readonly minutes: number;
}

export interface PlanActions {
  readonly move: (index: number, direction: -1 | 1) => void;
  readonly remove: (index: number) => void;
  readonly change: (index: number, patch: StopFields) => void;
  readonly add: (stop: StopFields, after: number) => void;
  readonly ending: (id: string) => void;
}

/**
 * **Our adventure — the schedule.** The one itinerary: time, what, where, a
 * line, directions where they help. The owner changes any stop (Change ·
 * Move · Remove) and adds; the other person adds their own and changes what
 * they added. An adventure with two endings offers them here, as a way to
 * customise this adventure (not choose another). What the times get wrong —
 * a hunt after legal hours, a dip after dark — is said on the stop.
 */
export function EveningPlan({
  evening,
  stops,
  sunset,
  warnings,
  experiences,
  isOwner,
  busy,
  next,
  actions,
}: {
  readonly evening: Evening | undefined;
  readonly stops: readonly PlanStop[];
  readonly sunset: number;
  readonly warnings: readonly Warning[];
  readonly experiences: Readonly<Record<string, Experience>>;
  readonly isOwner: boolean;
  readonly busy: boolean;
  /** On the day: the stop that's now or next. */
  readonly next?: number;
  readonly actions: PlanActions;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const title = evening?.composed
    ? "Passport's surprise"
    : (evening?.title ?? "Our own plan");
  const photo = evening?.photo;
  const endings = evening?.endings ?? [];
  const onEnding = endingOf(stops, evening);
  const home = homeAt(stops);

  return (
    <div data-testid="evening-plan">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[var(--n-ink)] px-5 pt-16 pb-5 text-white">
        {photo && (
          <Image
            src={photo.src}
            alt=""
            fill
            sizes="(min-width: 640px) 672px, 100vw"
            className="-z-10 object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--n-ink)] via-[var(--n-ink)]/60 to-transparent" />
        <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-amber)] uppercase">
          Our adventure
        </p>
        <h2 className="ghad-display mt-1 text-[38px] leading-[0.92] font-extrabold tracking-tight uppercase sm:text-5xl">
          {title}
        </h2>
        <p
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-semibold text-white/85"
          data-testid="plan-summary"
        >
          <span>Leave {clock(stops[0]!.at)}</span>
          <span className="inline-flex items-center gap-1">
            <Sunset className="h-4 w-4" aria-hidden /> Sunset {clock(sunset)}
          </span>
          {home !== undefined && <span>Home about {clock(home)}</span>}
        </p>
      </div>

      {endings.length > 1 && (
        <fieldset className="mt-4" data-testid="endings">
          <legend className="text-xs font-extrabold tracking-[0.18em] text-[var(--n-ink)]/55 uppercase">
            Customize this adventure · how it ends
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {endings.map((e) => {
              const on = onEnding?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={on}
                  disabled={busy || !isOwner || on}
                  onClick={() => actions.ending(e.id)}
                  className={cn(
                    "min-h-16 rounded-2xl px-3 py-2.5 text-left ring-1 transition disabled:cursor-default",
                    on
                      ? "bg-[var(--n-forest)] text-[var(--n-cream)] ring-[var(--n-forest)]"
                      : "bg-white ring-black/10",
                  )}
                >
                  <span className="block text-[15px] font-extrabold">
                    {e.title}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[12.5px] leading-snug",
                      on ? "text-white/80" : "text-[var(--n-ink)]/60",
                    )}
                  >
                    {e.line}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <ol className="mt-5" aria-label="The adventure, start to finish">
        {stops.map((stop, i) => {
          const e = stop.atlasRef ? experiences[stop.atlasRef] : undefined;
          const lat = e?.location?.latitude;
          const lng = e?.location?.longitude;
          const href = stop.directions
            ? directionsTo(stop.directions)
            : lat !== undefined && lng !== undefined
              ? directionsTo(`${lat},${lng}`)
              : stop.atlasRef && stop.where
                ? directionsTo(`${stop.where}, Vernon, BC`)
                : null;
          const mayChange = isOwner || stop.mine === true;
          const said = warnings.filter((w) => w.stop === i);
          const isOpen = open === i;
          return (
            <li key={stop.id ?? `${i}-${stop.title}`} data-testid="beat">
              {stop.travel > 0 && (
                <p className="flex items-center gap-2 py-1 pl-[66px] text-[12.5px] font-semibold text-[var(--n-ink)]/50">
                  <Car className="h-3.5 w-3.5" aria-hidden />{" "}
                  {length(stop.travel)} drive
                </p>
              )}
              <div
                className={cn(
                  "grid grid-cols-[58px_1fr] gap-x-2 rounded-2xl py-2 pr-1",
                  next === i &&
                    "bg-[var(--n-amber)]/20 ring-1 ring-[var(--n-amber)]",
                )}
              >
                <p className="pt-0.5 text-right text-[15px] leading-tight font-extrabold text-[var(--n-ink)] tabular-nums">
                  {clock(stop.at).replace(/ (am|pm)$/, "")}
                  <span className="block text-[10px] font-bold uppercase opacity-60">
                    {clock(stop.at).slice(-2)}
                  </span>
                </p>
                <div className="min-w-0 border-l-2 border-[var(--n-forest)]/15 pl-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16.5px] leading-tight font-extrabold text-[var(--n-ink)]">
                        {stop.title}
                      </h3>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--n-ink)]/55">
                        {[
                          stop.where && stop.where !== stop.title
                            ? stop.where
                            : null,
                          stop.minutes > 0 ? length(stop.minutes) : null,
                          stop.by ? `added by ${stop.by}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {stop.atlasRef && realPhoto(e) && (
                      <Picture
                        experience={e}
                        fallbackTitle=""
                        showLabel={false}
                        className="h-12 w-12 shrink-0 rounded-xl"
                      />
                    )}
                    {mayChange && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(isOpen ? null : i);
                          setEditing(null);
                        }}
                        aria-expanded={isOpen}
                        aria-label={`Edit ${stop.title}`}
                        data-testid="edit-stop"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--n-forest)] hover:bg-black/5"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  {stop.line && (
                    <p className="mt-1 text-[14.5px] leading-snug text-[var(--n-ink)]/75">
                      {stop.line}
                    </p>
                  )}
                  {said.map((w) => (
                    <p
                      key={w.line}
                      data-testid="stop-warning"
                      className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold text-[#9a3b10]"
                    >
                      <TriangleAlert
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden
                      />
                      {w.line}
                    </p>
                  ))}
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-bold text-[var(--n-forest)] underline-offset-4 hover:underline"
                    >
                      <Navigation className="h-3.5 w-3.5" aria-hidden />{" "}
                      Directions
                    </a>
                  )}
                  {isOpen && editing !== i && (
                    <div
                      role="group"
                      aria-label={`Change ${stop.title}`}
                      className="mt-2 grid grid-cols-4 gap-1.5"
                    >
                      <Tool
                        label="Change"
                        onClick={() => setEditing(i)}
                        disabled={busy}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Tool>
                      <Tool
                        label="Earlier"
                        onClick={() => actions.move(i, -1)}
                        disabled={
                          busy || !isOwner || fixedAt(stops, i) || i <= 1
                        }
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </Tool>
                      <Tool
                        label="Later"
                        onClick={() => actions.move(i, 1)}
                        disabled={
                          busy ||
                          !isOwner ||
                          fixedAt(stops, i) ||
                          i + 1 >= stops.length ||
                          fixedAt(stops, i + 1)
                        }
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </Tool>
                      <Tool
                        label="Remove"
                        onClick={() => {
                          setOpen(null);
                          actions.remove(i);
                        }}
                        disabled={busy || fixedAt(stops, i)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Tool>
                    </div>
                  )}
                  {editing === i && (
                    <StopForm
                      initial={stop}
                      submit="Save"
                      busy={busy}
                      onCancel={() => setEditing(null)}
                      onSubmit={(patch) => {
                        setEditing(null);
                        setOpen(null);
                        actions.change(i, patch);
                      }}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {adding ? (
        <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/10">
          <StopForm
            initial={{ title: "", line: "", minutes: 30 }}
            submit="Add it"
            busy={busy}
            withPlace={stops}
            onCancel={() => setAdding(false)}
            onSubmit={(stop, after) => {
              setAdding(false);
              actions.add(stop, after ?? stops.length - 1);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          data-testid="add-stop"
          disabled={busy}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-[var(--n-forest)]/40 font-bold text-[var(--n-forest)] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add something
        </button>
      )}

      {warnings.some((w) => w.stop === undefined) && (
        <p className="mt-3 text-[13px] font-semibold text-[#9a3b10]">
          {warnings
            .filter((w) => w.stop === undefined)
            .map((w) => w.line)
            .join(" ")}
        </p>
      )}

      {evening && evening.checks.length > 0 && (
        <details className="group mt-4 rounded-2xl bg-white/70 ring-1 ring-black/5">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[15px] font-bold">
            Before you go:{" "}
            {evening.checks.map((c) => c.label.toLowerCase()).join(", ")}
            <ChevronDown
              className="h-4 w-4 shrink-0 transition group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="space-y-3 px-4 pb-4">
            {evening.checks.map((c) => (
              <li key={c.label} className="text-[14px] leading-snug">
                <span className="font-bold">{c.label}.</span> {c.line}{" "}
                {c.href && (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--n-forest)] underline"
                  >
                    Check
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Tool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-[var(--n-forest)]/[0.07] text-[12px] font-bold text-[var(--n-forest)] disabled:opacity-35"
    >
      {children}
      {label}
    </button>
  );
}

function StopForm({
  initial,
  submit,
  busy,
  withPlace,
  onCancel,
  onSubmit,
}: {
  initial: StopFields;
  submit: string;
  busy: boolean;
  /** Adding: say where it goes. */
  withPlace?: readonly PlanStop[];
  onCancel: () => void;
  onSubmit: (stop: StopFields, after: number | undefined) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [line, setLine] = useState(initial.line);
  const [minutes, setMinutes] = useState(String(initial.minutes));
  const last = withPlace
    ? withPlace[withPlace.length - 1]?.key === "home"
      ? withPlace.length - 2
      : withPlace.length - 1
    : 0;
  const [after, setAfter] = useState(String(last));
  const n = Math.max(0, Math.min(600, Math.round(Number(minutes) || 0)));
  return (
    <form
      className="mt-2 grid gap-2"
      data-testid="stop-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onSubmit(
          { title: title.trim(), line: line.trim(), minutes: n },
          withPlace ? Number(after) : undefined,
        );
      }}
    >
      <label className="grid gap-1 text-[13px] font-bold">
        What
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          placeholder="Hot chocolate at the lookout"
          className="min-h-12 rounded-xl border border-black/15 bg-white px-3 text-base font-normal"
        />
      </label>
      <label className="grid gap-1 text-[13px] font-bold">
        Details
        <input
          value={line}
          onChange={(e) => setLine(e.target.value)}
          maxLength={300}
          placeholder="Where, what to bring"
          className="min-h-12 rounded-xl border border-black/15 bg-white px-3 text-base font-normal"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-[13px] font-bold">
          Minutes
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            className="min-h-12 rounded-xl border border-black/15 bg-white px-3 text-base font-normal"
          />
        </label>
        {withPlace && (
          <label className="grid gap-1 text-[13px] font-bold">
            After
            <select
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              className="min-h-12 rounded-xl border border-black/15 bg-white px-2 text-base font-normal"
            >
              {withPlace.slice(0, last + 1).map((s, i) => (
                <option key={s.id ?? i} value={i}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button
          disabled={busy || !title.trim()}
          className="min-h-12 flex-1 rounded-full bg-[var(--n-forest)] font-bold text-white disabled:opacity-50"
        >
          {submit}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-full px-5 font-bold text-[var(--n-ink)]/70 ring-1 ring-black/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
