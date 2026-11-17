"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Car,
  Crosshair,
  Footprints,
  Navigation,
  Play,
  Plus,
  Printer,
  Save,
  Share2,
  X,
} from "lucide-react";
import {
  KIND_EMOJI,
  KIND_LABEL,
  isLightDisplay,
  onThatDay,
  type LatLng,
  type PinView,
} from "@/domain/christmas/lights/model";
import {
  DURATIONS,
  REACH_KM,
  STYLES,
  buildTour,
  clockText,
  directionsUrl,
  order,
  timeTour,
  tourQuery,
  type Mode,
  type Stop,
  type TourLink,
  type TourStyle,
} from "@/domain/christmas/lights/tour";
import { metres } from "@/domain/christmas/lights/actions";
import {
  areaById,
  inAreaOf,
  placeLabel,
  type Area,
} from "@/domain/christmas/lights/areas";
import { priorMean } from "@/domain/christmas/lights/rank";
import { LightsMap } from "./LightsMap";
import { Stars } from "./Rate";
import { TourGo } from "./TourGo";
import { send, signInHref } from "./api";
import { useStash, writeStash } from "./stash";
import type { Festive } from "./Explorer";

/** Where? — the brief's places, in its order, then Kelowna (already on the map). */
const WHERE = [
  "vernon",
  "coldstream",
  "east-hill",
  "lumby",
  "armstrong",
  "kelowna",
];
/** How far round a tapped point a custom area reaches. */
const CUSTOM_KM = 3;

export function toStop(p: PinView): Stop {
  return {
    id: p.id,
    name: p.name,
    at: p.at,
    kind: p.kind,
    features: p.features,
    love: p.total,
    rating: p.rating,
    kids:
      (p.tags.find((t) => t.id === "kids")?.n ?? 0) + (p.reactions.family ?? 0),
  };
}

type Where =
  | { readonly kind: "nearby"; readonly at: LatLng | null }
  | { readonly kind: "area"; readonly area: Area }
  | { readonly kind: "custom"; readonly at: LatLng | null }
  | { readonly kind: "shared"; readonly at: LatLng };

/**
 * **Build My Lights Tour** (Lights Map 2.0): three questions — how long,
 * where, what kind — then a route through real displays confirmed lit that
 * night, inside the time asked for, each with its viewing time. When there
 * aren't enough, it says so and offers what's nearest instead. Then Start
 * Tour hands each stop to the family's own map app, one at a time.
 */
export function TourBuilder({
  pins,
  festive,
  today,
  link,
  signedIn,
  initialArea,
}: {
  readonly pins: readonly PinView[];
  readonly festive: readonly Festive[];
  readonly today: string;
  readonly link: TourLink | null;
  readonly signedIn: boolean;
  readonly initialArea?: string | null;
}) {
  const startArea = areaById(initialArea ?? "vernon") ?? areaById("vernon")!;
  const [where, setWhere] = useState<Where>(
    link
      ? { kind: "shared", at: link.from }
      : { kind: "area", area: startArea },
  );
  const [mode, setMode] = useState<Mode>(link?.mode ?? "drive");
  const [minutes, setMinutes] = useState(link?.minutes ?? 60);
  const [style, setStyle] = useState<TourStyle>("best");
  const [day, setDay] = useState(today);
  const [tourIds, setTourIds] = useState<string[] | null>(
    link?.stops ? [...link.stops] : null,
  );
  const [say, setSay] = useState<string | null>(null);
  const [short, setShort] = useState<{
    found: number;
    waiting: number;
    nearest: { stop: Stop; km: number }[];
    nextNight: string | null;
  } | null>(null);
  const [saved, setSaved] = useState<{ href: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Our Christmas lights tour");
  const [going, setGoing] = useState(false);
  const picks = useStash();

  const from: LatLng =
    where.kind === "area" ? where.area.at : (where.at ?? startArea.at);
  const fromLabel =
    where.kind === "area"
      ? where.area.label
      : where.kind === "nearby"
        ? where.at
          ? "near you"
          : "near you (finding you…)"
        : where.kind === "custom"
          ? where.at
            ? "the area you tapped"
            : "tap the map below"
          : "the shared start";

  const all = useMemo(() => {
    const m = new Map<string, Stop>();
    for (const p of pins) if (p.status === "approved") m.set(p.id, toStop(p));
    // Atlas finds only resolve stops of a tour someone shared before 2.0.
    for (const f of festive)
      m.set(f.id, {
        id: f.id,
        name: f.name,
        at: f.at,
        kind: "atlas",
        label: "From Atlas",
      });
    return m;
  }, [pins, festive]);
  const pinById = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);
  const prior = useMemo(() => priorMean(pins), [pins]);

  /** Why a stop can't be toured on `day`, or null when it can. */
  const notTonight = (id: string, on = day): string | null => {
    const p = pinById.get(id);
    if (!p) return all.has(id) ? null : "isn't on the map any more";
    if (p.season === "dark") return "was reported not decorated this year";
    if (p.season !== "lit") return "isn't confirmed lit this season yet";
    if (!onThatDay(p, on))
      return `isn't on that night (${p.hours ?? "see its dates"})`;
    return null;
  };
  const isLight = (id: string) => {
    const p = pinById.get(id);
    return !!p && isLightDisplay(p.kind);
  };

  /** Inside the place asked about. */
  const inWhere = (at: LatLng) => {
    if (where.kind === "area") return inAreaOf(where.area, at);
    if (where.kind === "custom")
      return !!where.at && metres(where.at, at) <= CUSTOM_KM * 1000;
    return metres(from, at) <= REACH_KM[mode] * 1000;
  };

  /** The first night within six weeks with a lit display in the area. */
  function firstLitNight(): string | null {
    const start = new Date(`${day}T12:00:00Z`);
    for (let i = 1; i <= 42; i++) {
      const d = new Date(start.getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (
        [...all.values()].some(
          (s) => isLight(s.id) && !notTonight(s.id, d) && inWhere(s.at),
        )
      )
        return d;
    }
    return null;
  }

  function build(on = day) {
    if (where.kind === "custom" && !where.at) {
      setSay("Tap the map where you'd like to tour first.");
      return;
    }
    if (on !== day) setDay(on);
    setSaved(null);
    setGoing(false);
    const lightsTonight = [...all.values()].filter(
      (c) => isLight(c.id) && !notTonight(c.id, on),
    );
    const here = lightsTonight.filter((c) => inWhere(c.at));
    const chosen = picks
      .filter((id) => all.has(id) && !notTonight(id, on) && isLight(id))
      .map((id) => all.get(id)!)
      .filter((s) => here.some((h) => h.id === s.id));
    const skipped = picks.filter((id) => notTonight(id, on));
    const rest = here.filter((c) => !chosen.some((s) => s.id === c.id));
    const cap = style === "most" ? 20 : 8;
    const filled = buildTour(
      {
        from,
        mode,
        minutes: Math.max(
          10,
          minutes - timeTour(from, mode, order(from, chosen)).minutes,
        ),
        stops: Math.max(0, cap - chosen.length),
        prefer: [],
        festive: false,
        style,
        prior,
      },
      // The area is the reach: a tour of Lumby may start a drive away.
      rest.map((s) => s),
    );
    const reached = filled.stops.map((t) => t.stop);
    const ids = order(from, [...chosen, ...reached]).map((s) => s.id);
    setTourIds(ids);
    if (ids.length < 2) {
      const waiting = [...all.values()].filter(
        (c) =>
          isLight(c.id) &&
          inWhere(c.at) &&
          pinById.get(c.id)?.season === "unconfirmed",
      ).length;
      const nearest = lightsTonight
        .filter((c) => !ids.includes(c.id) && !inWhere(c.at))
        .map((stop) => ({ stop, km: metres(from, stop.at) / 1000 }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 3);
      setShort({
        found: ids.length,
        waiting,
        nearest,
        nextNight: firstLitNight(),
      });
    } else setShort(null);
    // Bring the result into view: the tour, or why there isn't one.
    setTimeout(
      () =>
        document
          .querySelector('[data-testid="tour-short"], [data-testid="tour"]')
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
    setSay(
      skipped.length
        ? `Left out ${skipped.length} of your picks: ${skipped.map((id) => `${all.get(id)?.name ?? "a stop"} ${notTonight(id, on)}`).join("; ")}.`
        : null,
    );
  }

  const stops = (tourIds ?? [])
    .map((id) => all.get(id))
    .filter((s): s is Stop => !!s);
  const tour = timeTour(from, mode, stops, minutes);
  const directions = directionsUrl(
    from,
    mode,
    stops.map((s) => s.at),
  );
  const shareLink =
    stops.length > 0
      ? `/christmas/lights/tour?${tourQuery({ from, mode, stops: stops.map((s) => s.id), minutes })}`
      : null;
  const nearbyExtras = [...all.values()]
    .filter(
      (c) => isLight(c.id) && !notTonight(c.id) && !tourIds?.includes(c.id),
    )
    .map((c) => ({
      c,
      m: Math.min(
        ...[from, ...stops.map((s) => s.at)].map((p) => metres(p, c.at)),
      ),
    }))
    .filter(({ m }) => m <= REACH_KM[mode] * 600)
    .sort((a, b) => a.m - b.m)
    .slice(0, 4);
  const firstStop = stops[0];
  const evening = firstStop
    ? `/christmas/itinerary?${new URLSearchParams({
        say:
          mode === "walk"
            ? "Dinner and a walk to see the Christmas lights"
            : "Dinner and a Christmas lights tour",
        pick: `lights:map:${firstStop.id}`,
        day,
        ...(pinById.get(firstStop.id)
          ? { at: pinById.get(firstStop.id)!.town }
          : {}),
      }).toString()}`
    : null;

  const move = (i: number, d: -1 | 1) => {
    if (!tourIds) return;
    const next = [...tourIds];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setTourIds(next);
  };

  function locate() {
    setWhere({ kind: "nearby", at: null });
    navigator.geolocation?.getCurrentPosition(
      (p) =>
        setWhere({
          kind: "nearby",
          at: { lat: p.coords.latitude, lng: p.coords.longitude },
        }),
      () => {
        setWhere({ kind: "area", area: startArea });
        setSay("Couldn't find you — pick a place instead.");
      },
      { timeout: 10_000 },
    );
  }

  async function share() {
    if (!shareLink) return;
    const url = `${location.origin}${shareLink}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Our Christmas lights tour — ${stops.length} stops`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSay("Tour link copied — send it to the family.");
    } catch {
      setSay(url);
    }
  }

  async function save() {
    setSaving(true);
    writeStash(stops.map((s) => s.id));
    const r = await send("/christmas/api/lights/tour", {
      title,
      day,
      mode,
      fromLat: from.lat,
      fromLng: from.lng,
      stops: stops.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.at.lat,
        lng: s.at.lng,
      })),
    });
    setSaving(false);
    if (r.ok && typeof r.href === "string") setSaved({ href: r.href });
    else if (r.status === 401) setSay("signin");
    else
      setSay(r.error ?? "That didn't save — your tour is still on this phone.");
  }

  const chip = (on: boolean) =>
    `inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${on ? "bg-[#0f3b2b] text-white" : "bg-white ring-1 ring-[#0f3b2b]/20 text-[#082319]"}`;
  const q = "text-sm font-extrabold tracking-[0.12em] text-[#b3242f] uppercase";

  if (going && stops.length > 0)
    return (
      <TourGo
        stops={tour.stops}
        pins={pinById}
        from={from}
        mode={mode}
        signedIn={signedIn}
        onChange={() => setGoing(false)}
        onSkip={(id) => setTourIds((t) => (t ?? []).filter((x) => x !== id))}
        onEnd={() => setGoing(false)}
      />
    );

  return (
    <div className="space-y-5">
      <section
        className="space-y-4 rounded-[28px] bg-white p-5 text-[#082319] shadow-[0_6px_24px_rgba(8,35,25,0.1)] print:hidden"
        data-testid="tour-ask"
      >
        <div>
          <p className={q}>How long?</p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="How long?"
          >
            {DURATIONS.map((t) => (
              <button
                key={t.minutes}
                type="button"
                role="radio"
                aria-checked={minutes === t.minutes}
                onClick={() => setMinutes(t.minutes)}
                className={chip(minutes === t.minutes)}
                data-testid={`time-${t.minutes}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={q}>Where?</p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Where?"
          >
            <button
              type="button"
              role="radio"
              aria-checked={where.kind === "nearby"}
              onClick={locate}
              className={chip(where.kind === "nearby")}
              data-testid="from-nearby"
            >
              <Crosshair className="h-4 w-4" aria-hidden /> Best nearby
            </button>
            {WHERE.map((id) => areaById(id))
              .filter((a): a is Area => !!a)
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={where.kind === "area" && where.area.id === a.id}
                  onClick={() => setWhere({ kind: "area", area: a })}
                  className={chip(
                    where.kind === "area" && where.area.id === a.id,
                  )}
                  data-testid={`from-${a.id}`}
                >
                  {a.label}
                </button>
              ))}
            <button
              type="button"
              role="radio"
              aria-checked={where.kind === "custom"}
              onClick={() => setWhere({ kind: "custom", at: null })}
              className={chip(where.kind === "custom")}
              data-testid="from-custom"
            >
              Custom area
            </button>
          </div>
          {where.kind === "custom" && (
            <div className="mt-3">
              <LightsMap
                markers={[]}
                center={where.at ?? startArea.at}
                zoom={11}
                pick={{
                  at: where.at,
                  onPick: (at) => setWhere({ kind: "custom", at }),
                }}
                className="h-[240px]"
                label="Tap the middle of the area you'd like to tour"
              />
              <p className="mt-1 text-sm text-[#3d4a43]">
                Tap the middle of where you&apos;d like to go — the tour stays
                within {CUSTOM_KM} km of it.
              </p>
            </div>
          )}
        </div>
        <div>
          <p className={q}>What kind?</p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="What kind?"
          >
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                onClick={() => setStyle(s.id)}
                className={chip(style === s.id)}
                data-testid={`style-${s.id}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-[#0f3b2b]">
            {mode === "walk" ? "Walking" : "Driving"} ·{" "}
            {day === today ? "tonight" : day} — change
          </summary>
          <div className="mt-3 space-y-3">
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Getting about"
            >
              <button
                type="button"
                role="radio"
                aria-checked={mode === "drive"}
                onClick={() => setMode("drive")}
                className={chip(mode === "drive")}
                data-testid="mode-drive"
              >
                <Car className="h-4 w-4" aria-hidden /> Driving
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "walk"}
                onClick={() => setMode("walk")}
                className={chip(mode === "walk")}
                data-testid="mode-walk"
              >
                <Footprints className="h-4 w-4" aria-hidden /> Walking
              </button>
            </div>
            <label className="block font-bold">
              Which night?{" "}
              <input
                type="date"
                value={day}
                min={today}
                onChange={(e) => setDay(e.target.value || today)}
                className="ml-2 rounded-xl border border-[#0f3b2b]/20 p-2 font-normal"
                data-testid="tour-day"
              />
            </label>
          </div>
        </details>
        {picks.length > 0 && (
          <p className="text-sm text-[#3d4a43]">
            Your {picks.length} {picks.length === 1 ? "pick" : "picks"} from the
            map go on first, when they&apos;re in the area and on that night.
          </p>
        )}
        <button
          type="button"
          onClick={() => build()}
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-[#b3242f] text-lg font-extrabold text-white"
          data-testid="build-tour"
        >
          ✨ Build My Lights Tour
        </button>
      </section>

      {short && (
        <section
          className="space-y-3 rounded-[24px] bg-[#f7e3e1] p-4 text-[#082319]"
          role="status"
          data-testid="tour-short"
        >
          <p className="font-extrabold">
            {short.found === 0
              ? `No confirmed display is on ${day === today ? "tonight" : "that night"} around ${fromLabel}.`
              : `Only one confirmed display is on ${day === today ? "tonight" : "that night"} around ${fromLabel} — not much of a tour yet.`}
          </p>
          <p className="text-sm">
            We only tour displays someone has confirmed lit this season — never
            last year&apos;s, never made up.
            {short.waiting > 0
              ? ` ${short.waiting} more here ${short.waiting === 1 ? "was" : "were"} lit before and ${short.waiting === 1 ? "is" : "are"} waiting for someone to say ${short.waiting === 1 ? "it's" : "they're"} on again.`
              : ""}
          </p>
          {short.nearest.length > 0 && (
            <div>
              <p className="text-sm font-bold">Nearest confirmed instead:</p>
              <ul className="mt-1 space-y-1">
                {short.nearest.map(({ stop, km }) => (
                  <li key={stop.id}>
                    <button
                      type="button"
                      onClick={() => setTourIds([...(tourIds ?? []), stop.id])}
                      className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm"
                      data-testid="short-nearest"
                    >
                      <Plus
                        className="h-4 w-4 shrink-0 text-[#b3242f]"
                        aria-hidden
                      />
                      <span className="font-bold">{stop.name}</span>
                      <span className="text-[#3d4a43]">
                        · {km.toFixed(0)} km away
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {short.nextNight && (
            <button
              type="button"
              onClick={() => build(short.nextNight!)}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#ffd98a] px-4 text-center font-extrabold"
              data-testid="next-lit-night"
            >
              ✨ The first lit night there is{" "}
              {new Date(`${short.nextNight}T12:00:00Z`).toLocaleDateString(
                "en-CA",
                {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                },
              )}{" "}
              — plan that night
            </button>
          )}
        </section>
      )}
      {say && say !== "signin" && (
        <p
          className="rounded-2xl bg-[#f7e3e1] p-4 font-bold text-[#082319]"
          role="status"
          data-testid="tour-say"
        >
          {say}
        </p>
      )}

      {stops.length > 0 && (
        <section className="space-y-4" data-testid="tour">
          <div className="rounded-[28px] bg-[#0f3b2b] p-5 text-white">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Tour name"
              className="ghad-display w-full bg-transparent text-2xl font-extrabold outline-none print:hidden"
            />
            <h2 className="ghad-display hidden text-3xl font-extrabold print:block">
              {title}
            </h2>
            <p className="mt-1 text-lg" data-testid="tour-summary">
              {stops.length} {stops.length === 1 ? "stop" : "stops"} · about{" "}
              {tour.km} km {mode === "walk" ? "on foot" : "of driving"} ·{" "}
              {clockText(tour.minutes)} in all
            </p>
            {tour.over ? (
              <p
                className="mt-2 rounded-xl bg-[#b3242f] px-3 py-2 font-bold"
                data-testid="tour-over"
              >
                That&apos;s longer than the {clockText(minutes)} you have — drop
                a stop, or keep going and have a later night.
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/80" data-testid="tour-fits">
                Fits your{" "}
                {DURATIONS.find(
                  (d) => d.minutes === minutes,
                )?.label.toLowerCase() ?? clockText(minutes)}
                , viewing time included.
              </p>
            )}
            <button
              type="button"
              onClick={() => setGoing(true)}
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#ffd98a] text-lg font-extrabold text-[#082319] print:hidden"
              data-testid="start-tour"
            >
              <Play className="h-5 w-5" aria-hidden /> Start Tour
            </button>
          </div>

          <LightsMap
            markers={stops.map((s, i) => ({
              id: s.id,
              at: s.at,
              emoji: s.kind === "atlas" ? "🎁" : KIND_EMOJI[s.kind],
              label: `${i + 1}. ${s.name}`,
              n: i + 1,
            }))}
            center={from}
            route={[from, ...stops.map((s) => s.at)]}
            className="h-[300px] print:hidden"
            label={`Tour map: ${stops.map((s, i) => `${i + 1}, ${s.name}`).join("; ")}`}
          />
          <p className="text-sm text-white/70">
            Times are estimates from straight-line distance; your map app has
            the real route.
          </p>

          <ol className="space-y-3" data-testid="tour-stops">
            {tour.stops.map((t, i) => {
              const p = pinById.get(t.stop.id);
              return (
                <li
                  key={t.stop.id}
                  className="flex items-center gap-3 rounded-[20px] bg-white p-3 text-[#082319]"
                  data-testid="tour-stop"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b3242f] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">
                      {t.stop.id.startsWith("atlas:") ? (
                        t.stop.name
                      ) : (
                        <Link
                          href={`/christmas/lights/${t.stop.id}`}
                          className="hover:underline"
                        >
                          {t.stop.name}
                        </Link>
                      )}
                    </p>
                    <p className="text-sm text-[#3d4a43]">
                      {p ? placeLabel(p) : "Festive stop from Atlas"} ·{" "}
                      {clockText(t.leg.minutes)}{" "}
                      {mode === "walk" ? "walk" : "drive"} · see it ~{t.stay}{" "}
                      min
                    </p>
                    {p && <Stars rating={p.rating} />}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row print:hidden">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${t.stop.name} earlier`}
                      className="rounded-full p-2 ring-1 ring-[#0f3b2b]/15 disabled:opacity-30"
                      data-testid="stop-up"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === tour.stops.length - 1}
                      aria-label={`Move ${t.stop.name} later`}
                      className="rounded-full p-2 ring-1 ring-[#0f3b2b]/15 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTourIds(tourIds!.filter((x) => x !== t.stop.id))
                      }
                      aria-label={`Remove ${t.stop.name}`}
                      className="rounded-full p-2 text-[#b3242f] ring-1 ring-[#b3242f]/25"
                      data-testid="stop-remove"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap gap-2 print:hidden">
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-[#082319]"
                data-testid="tour-directions"
              >
                <Navigation className="h-5 w-5" aria-hidden /> Whole route
              </a>
            )}
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-[#082319]"
              data-testid="tour-share"
            >
              <Share2 className="h-5 w-5" aria-hidden /> Share
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-[#082319]"
              data-testid="tour-save"
            >
              <Save className="h-5 w-5" aria-hidden />{" "}
              {saving ? "Saving…" : "Save as our adventure"}
            </button>
            {evening && (
              <Link
                href={evening}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-bold text-white"
                data-testid="tour-evening"
              >
                🍽️ Make it an evening
              </Link>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-bold text-white"
            >
              <Printer className="h-5 w-5" aria-hidden /> Print
            </button>
          </div>
          {shareLink && (
            <p
              className="text-sm break-all text-white/70 print:text-black"
              data-testid="tour-link"
            >
              Tour link: {shareLink}
            </p>
          )}
          {saved && (
            <p
              className="rounded-2xl bg-[#ffd98a] p-4 font-bold text-[#082319]"
              role="status"
              data-testid="tour-saved"
            >
              Saved! It&apos;s a Christmas adventure now — invite the family,
              add dinner in Go Have a Day, and keep the memories there.{" "}
              <Link href={saved.href} className="underline">
                Open our adventure →
              </Link>
            </p>
          )}
          {say === "signin" && (
            <p
              className="rounded-2xl bg-white p-4 text-[#082319]"
              role="status"
              data-testid="tour-sign-in"
            >
              {signedIn
                ? "Your account needs a confirmed email to save adventures."
                : "Saving makes it an adventure the family can join, so it needs an account."}{" "}
              <Link
                className="font-bold underline"
                href={signInHref(shareLink ?? "/christmas/lights/tour")}
              >
                Sign in to save
              </Link>
              . Your tour is kept on this phone meanwhile, and the link above
              works for anyone.
            </p>
          )}

          {nearbyExtras.length > 0 && (
            <section className="print:hidden">
              <h3 className="ghad-display text-xl font-extrabold text-white">
                Add more magic nearby
              </h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {nearbyExtras.map(({ c, m }) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setTourIds([...(tourIds ?? []), c.id])}
                      className="flex w-full items-center gap-3 rounded-[18px] bg-white/10 p-3 text-left text-white hover:bg-white/20"
                      data-testid="add-nearby"
                    >
                      <Plus
                        className="h-5 w-5 shrink-0 text-[#ffd98a]"
                        aria-hidden
                      />
                      <span>
                        <span className="block font-bold">{c.name}</span>
                        <span className="text-sm text-white/75">
                          {c.kind === "atlas"
                            ? "Festive stop"
                            : KIND_LABEL[c.kind]}{" "}
                          · {(m / 1000).toFixed(1)} km away
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}
    </div>
  );
}
