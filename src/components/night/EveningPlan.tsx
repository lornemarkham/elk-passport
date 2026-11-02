"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Car,
  ChevronDown,
  CloudSun,
  House,
  Navigation,
  Pencil,
  Plus,
  Shuffle,
  Sunset,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Picture } from "@/components/adventures/Picture";
import type { Experience } from "@/domain/experience/types";
import type { NightDay } from "@/domain/date-night/adventures";
import type { DayForecast } from "@/domain/date-night/conditions";
import {
  directionsTo,
  PHOTOS,
  type Evening,
  type Photo,
} from "@/domain/date-night/adventures/evenings";
import {
  clock,
  endingOf,
  fixedAt,
  homeAt,
  ruleOf,
  type PlanStop,
  type StopRule,
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

/** Where the light is: it decides the colour of each stop's time. */
type Light = "day" | "golden" | "night";
const lightAt = (at: number, sunset: number): Light =>
  at < sunset - 60 ? "day" : at <= sunset + 20 ? "golden" : "night";
const LIGHT: Record<Light, { dot: string; time: string; line: string }> = {
  day: {
    dot: "bg-[var(--n-amber)]/60 ring-[var(--n-amber)]/30",
    time: "text-[var(--n-ink)]",
    line: "from-[var(--n-amber)]/45 to-[var(--n-amber)]/45",
  },
  golden: {
    dot: "bg-[var(--n-ember)] ring-[var(--n-ember)]/25",
    time: "text-[var(--n-ember)]",
    line: "from-[var(--n-ember)]/60 to-[var(--n-ember)]/60",
  },
  night: {
    dot: "bg-[#2b3550] ring-[#2b3550]/20",
    time: "text-[#2b3550]",
    line: "from-[#2b3550]/50 to-[#2b3550]/50",
  },
};

/** The photograph a big moment gets, if it has one of its own. */
function photoOf(
  stop: PlanStop,
  rule: StopRule,
  e: Experience | undefined,
  hero: Photo | undefined,
): { kind: "atlas"; e: Experience } | { kind: "photo"; photo: Photo } | null {
  if (stop.atlasRef && realPhoto(e)) return { kind: "atlas", e: e! };
  const photo = rule.tags.includes("fire")
    ? PHOTOS.campfire
    : rule.tags.includes("sunset")
      ? PHOTOS.sunset
      : undefined;
  // The hero already shows the adventure's own photograph.
  return photo && photo.src !== hero?.src ? { kind: "photo", photo } : null;
}

/**
 * **Our adventure — the journey.** The one itinerary, read top to bottom
 * like the afternoon and evening it is: the light at each stop (day, golden,
 * night), the sunset where it falls, the drive between stops, and a
 * photograph only on the moments that have one of their own, so it stays
 * quick to scan. The owner changes any stop (Change · Earlier · Later ·
 * Remove) and adds; the other person adds their own and changes what they
 * added. An adventure with two endings offers them as how it ends. What the
 * times get wrong — a hunt after legal hours, a dip after dark, a place
 * after it closes — is said on the stop. What the last change touched is
 * marked, so nobody has to hunt for it.
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
  day,
  forecast,
  changed,
  chooser,
  chooserOpen,
  onToggleChooser,
  onLeave,
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
  readonly day: NightDay;
  readonly forecast?: DayForecast;
  /** Titles of the stops the last change touched. */
  readonly changed?: ReadonlySet<string>;
  /** The other adventures, behind Change adventure. */
  readonly chooser?: React.ReactNode;
  readonly chooserOpen?: boolean;
  readonly onToggleChooser?: () => void;
  /** Change when we leave (the Change it room). */
  readonly onLeave?: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const title = evening?.composed
    ? "Passport's surprise"
    : (evening?.title ?? "Our own plan");
  const endings = evening?.endings ?? [];
  const onEnding = endingOf(stops, evening);
  const home = homeAt(stops);
  // The sunset falls before the first stop that starts after it.
  const afterSunset = stops.findIndex(
    (s, i) => i > 0 && s.at >= sunset && stops[i - 1]!.at < sunset,
  );

  return (
    <div data-testid="evening-plan">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
            Our adventure
          </p>
          <h2 className="ghad-display mt-1 text-[32px] leading-[0.92] font-extrabold tracking-tight uppercase sm:text-[44px]">
            {title}
          </h2>
        </div>
        {chooser && (
          <button
            type="button"
            onClick={onToggleChooser}
            aria-expanded={chooserOpen ?? false}
            aria-controls="evenings"
            data-testid="change-adventure"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold text-[var(--n-forest)] ring-1 ring-[var(--n-forest)]/25 hover:bg-[var(--n-forest)]/5"
          >
            <Shuffle className="h-4 w-4" aria-hidden />
            {chooserOpen ? "Keep this one" : "Change adventure"}
          </button>
        )}
      </div>

      {chooser && chooserOpen && (
        <div
          id="evenings"
          className="mt-4 scroll-mt-20 rounded-[26px] bg-black/[0.035] p-3"
        >
          <p className="px-2 pb-2 text-[13px] font-semibold text-[var(--n-ink)]/60">
            {isOwner
              ? "The others, ready if you change your minds."
              : "Suggest another one, and it goes to the planner."}
          </p>
          {chooser}
        </div>
      )}

      <dl
        className="mt-4 grid grid-cols-3 overflow-hidden rounded-[22px] bg-[var(--n-ink)] text-[var(--n-cream)]"
        data-testid="plan-summary"
      >
        {[
          ["Leave", clock(stops[0]!.at), Car],
          ["Sunset", clock(sunset), Sunset],
          ["Home", home !== undefined ? clock(home) : "—", House],
        ].map(([term, value, Icon]) => {
          const I = Icon as typeof Car;
          const leaving = term === "Leave" && onLeave;
          const cell = (
            <>
              <dt className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-[var(--n-amber)] uppercase">
                <I className="h-3.5 w-3.5" aria-hidden /> {term as string}
                {leaving && (
                  <Pencil className="ml-auto h-3.5 w-3.5" aria-hidden />
                )}
              </dt>
              <dd className="mt-1 text-[19px] leading-none font-extrabold tabular-nums sm:text-2xl">
                {value as string}
              </dd>
            </>
          );
          return leaving ? (
            <button
              key={term as string}
              type="button"
              onClick={onLeave}
              data-testid="change-leave"
              aria-label={`Leave ${value as string}. Change when we leave`}
              className="border-white/10 px-3 py-3 text-left not-first:border-l hover:bg-white/5 sm:px-5"
            >
              {cell}
            </button>
          ) : (
            <div
              key={term as string}
              className="border-white/10 px-3 py-3 not-first:border-l sm:px-5"
            >
              {cell}
            </div>
          );
        })}
      </dl>
      {forecast && (
        <p
          className="mt-2 flex items-start gap-1.5 px-1 text-[13px] text-[var(--n-ink)]/65"
          data-testid="plan-weather"
        >
          <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {[
              forecast.words.slice(0, 2).join(", "),
              forecast.highC !== undefined
                ? `high ${Math.round(forecast.highC)}°`
                : null,
              forecast.lowC !== undefined
                ? `low ${Math.round(forecast.lowC)}°`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            <span className="text-[var(--n-ink)]/45">
              {" "}
              — {forecast.source} for {forecast.city ?? day.area}
            </span>
          </span>
        </p>
      )}

      {endings.length > 1 && (
        <fieldset className="mt-5" data-testid="endings">
          <legend className="text-xs font-extrabold tracking-[0.18em] text-[var(--n-ink)]/55 uppercase">
            How it ends
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

      <ol className="mt-6" aria-label="The adventure, start to finish">
        {stops.map((stop, i) => {
          const e = stop.atlasRef ? experiences[stop.atlasRef] : undefined;
          const rule = ruleOf(evening, stop, day);
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
          const light = LIGHT[lightAt(stop.at, sunset)];
          const ends = i === 0 || fixedAt(stops, i);
          const photo = ends ? null : photoOf(stop, rule, e, evening?.photo);
          const fresh = changed?.has(stop.title) ?? false;
          return (
            <li key={stop.id ?? `${i}-${stop.title}`} data-testid="beat">
              {i === afterSunset && (
                <p
                  className="relative my-2 ml-[66px] flex items-center gap-2 text-[12.5px] font-extrabold tracking-wide text-[var(--n-ember)] uppercase"
                  data-testid="sunset-marker"
                >
                  <span className="h-px flex-1 bg-gradient-to-r from-[var(--n-amber)] to-[var(--n-ember)]/0" />
                  <Sunset className="h-4 w-4" aria-hidden /> Sunset{" "}
                  {clock(sunset)}
                  <span className="h-px flex-1 bg-gradient-to-l from-[var(--n-amber)] to-[var(--n-ember)]/0" />
                </p>
              )}
              {stop.travel > 0 && (
                <p className="flex items-center gap-2 py-1.5 pl-[58px] text-[12.5px] font-semibold text-[var(--n-ink)]/50">
                  <span className="ml-[3px] h-6 border-l-2 border-dashed border-[var(--n-ink)]/20" />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1">
                    <Car className="h-3.5 w-3.5" aria-hidden />
                    {length(stop.travel)} drive
                  </span>
                </p>
              )}
              <div
                className={cn(
                  "grid grid-cols-[52px_1fr] gap-x-3 rounded-2xl py-2 pr-1",
                  next === i &&
                    "bg-[var(--n-amber)]/20 ring-1 ring-[var(--n-amber)]",
                  fresh && "bg-[var(--n-amber)]/10",
                )}
                data-changed={fresh || undefined}
              >
                <p
                  className={cn(
                    "pt-0.5 text-right text-[16px] leading-tight font-extrabold tabular-nums",
                    light.time,
                  )}
                >
                  {clock(stop.at).replace(/ (am|pm)$/, "")}
                  <span className="block text-[10px] font-bold uppercase opacity-60">
                    {clock(stop.at).slice(-2)}
                  </span>
                </p>
                <div className="relative min-w-0 pl-4">
                  <span
                    className={cn(
                      "absolute top-2 left-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4",
                      light.dot,
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "absolute top-6 bottom-[-12px] left-0 w-0.5 -translate-x-1/2 bg-gradient-to-b",
                      i === stops.length - 1 ? "hidden" : light.line,
                    )}
                    aria-hidden
                  />
                  {photo && (
                    <figure className="mb-2.5 overflow-hidden rounded-2xl">
                      {photo.kind === "atlas" ? (
                        <Picture
                          experience={photo.e}
                          fallbackTitle=""
                          showLabel={false}
                          className="h-28 w-full sm:h-36"
                        />
                      ) : (
                        <div className="relative h-28 w-full sm:h-36">
                          <Image
                            src={photo.photo.src}
                            alt={photo.photo.alt}
                            fill
                            sizes="(min-width: 640px) 600px, 90vw"
                            className="object-cover"
                          />
                          <figcaption className="absolute right-2 bottom-1.5 text-[10px] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
                            {photo.photo.where} · {photo.photo.credit},{" "}
                            {photo.photo.license}
                          </figcaption>
                        </div>
                      )}
                    </figure>
                  )}
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {(rule.main || fresh) && (
                        <p className="mb-0.5 flex gap-1.5">
                          {rule.main && (
                            <span className="rounded-full bg-[var(--n-ember)] px-2 py-0.5 text-[10.5px] font-extrabold tracking-[0.12em] text-white uppercase">
                              The big one
                            </span>
                          )}
                          {fresh && (
                            <span
                              data-testid="stop-changed"
                              className="rounded-full bg-[var(--n-amber)] px-2 py-0.5 text-[10.5px] font-extrabold tracking-[0.12em] text-[var(--n-ink)] uppercase"
                            >
                              Just changed
                            </span>
                          )}
                        </p>
                      )}
                      <h3
                        className={cn(
                          "leading-tight font-extrabold text-[var(--n-ink)]",
                          ends
                            ? "text-[15.5px]"
                            : rule.main
                              ? "text-[19px]"
                              : "text-[17px]",
                        )}
                      >
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
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--n-forest)] hover:bg-black/5",
                          isOpen && "bg-[var(--n-forest)] text-white",
                        )}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  {stop.line && (
                    <p
                      className={cn(
                        "mt-1 leading-snug text-[var(--n-ink)]/75",
                        ends ? "text-[13.5px]" : "text-[14.5px]",
                      )}
                    >
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
