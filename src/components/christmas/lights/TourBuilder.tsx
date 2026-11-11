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
  Plus,
  Printer,
  Save,
  Share2,
  X,
} from "lucide-react";
import {
  FEATURES,
  KIND_EMOJI,
  KIND_LABEL,
  TOWNS,
  TOWN_AT,
  TOWN_LABEL,
  onThatDay,
  type FeatureId,
  type LatLng,
  type PinView,
} from "@/domain/christmas/lights/model";
import {
  REACH_KM,
  buildTour,
  clockText,
  directionsUrl,
  order,
  timeTour,
  tourQuery,
  type Mode,
  type Stop,
  type TourLink,
} from "@/domain/christmas/lights/tour";
import { metres } from "@/domain/christmas/lights/actions";
import { LightsMap } from "./LightsMap";
import { send, signInHref } from "./api";
import { useStash, writeStash } from "./stash";
import type { Festive } from "./Explorer";

const TIMES = [30, 60, 90, 120, 180];
const COUNTS = [3, 5, 8, 12];

function toStop(p: PinView): Stop {
  return {
    id: p.id,
    name: p.name,
    at: p.at,
    kind: p.kind,
    features: p.features,
    love: p.total,
  };
}

/**
 * **Build My Christmas Lights Tour.** Say where you start, how you're
 * getting about, how long you have and how many stops; Passport picks lit
 * displays in reach and orders them. Then it's yours: move, remove, add,
 * open the directions, share it, save it as an adventure.
 */
export function TourBuilder({
  pins,
  festive,
  today,
  link,
  signedIn,
}: {
  readonly pins: readonly PinView[];
  readonly festive: readonly Festive[];
  readonly today: string;
  readonly link: TourLink | null;
  readonly signedIn: boolean;
}) {
  const [from, setFrom] = useState<LatLng>(link?.from ?? TOWN_AT.vernon);
  const [fromLabel, setFromLabel] = useState(
    link ? "the shared start" : "Vernon",
  );
  const [mode, setMode] = useState<Mode>(link?.mode ?? "drive");
  const [minutes, setMinutes] = useState(link?.minutes ?? 90);
  const [count, setCount] = useState(5);
  const [prefer, setPrefer] = useState<FeatureId[]>([]);
  const [withFestive, setWithFestive] = useState(true);
  const [day, setDay] = useState(today);
  const [tourIds, setTourIds] = useState<string[] | null>(
    link?.stops ? [...link.stops] : null,
  );
  const [say, setSay] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ href: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Our Christmas lights tour");
  const [nextNight, setNextNight] = useState<string | null>(null);
  const picks = useStash();

  const all = useMemo(() => {
    const m = new Map<string, Stop>();
    for (const p of pins) if (p.status === "approved") m.set(p.id, toStop(p));
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

  /** Why a stop can't be toured on `day`, or null when it can. */
  const notTonight = (id: string, on = day): string | null => {
    const p = pinById.get(id);
    if (!p) return all.has(id) ? null : "isn't on the map any more";
    if (p.season === "dark") return "was reported not decorated this year";
    if (p.season !== "lit") return "isn't confirmed lit this season yet";
    if (!onThatDay(p, on))
      return `isn't on that day (${p.hours ?? "see its dates"})`;
    return null;
  };
  const candidates = [...all.values()].filter((s) => !notTonight(s.id));

  /** The first night within six weeks with something lit in reach. */
  function firstLitNight(): string | null {
    const reach = REACH_KM[mode] * 1000;
    const start = new Date(`${day}T12:00:00Z`);
    for (let i = 1; i <= 42; i++) {
      const d = new Date(start.getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (
        [...all.values()].some(
          (s) => !notTonight(s.id, d) && metres(from, s.at) <= reach,
        )
      )
        return d;
    }
    return null;
  }

  function build(on = day) {
    if (on !== day) setDay(on);
    setSaved(null);
    const chosen = picks
      .filter((id) => all.has(id) && !notTonight(id, on))
      .map((id) => all.get(id)!);
    const skipped = picks.filter((id) => notTonight(id, on));
    const rest = [...all.values()].filter(
      (c) => !notTonight(c.id, on) && !chosen.some((s) => s.id === c.id),
    );
    const room = Math.max(0, count - chosen.length);
    const filled = buildTour(
      {
        from,
        mode,
        minutes: Math.max(
          10,
          minutes - timeTour(from, mode, order(from, chosen)).minutes,
        ),
        stops: room,
        prefer,
        festive: withFestive,
      },
      rest,
    );
    const ids = order(from, [
      ...chosen,
      ...filled.stops.map((t) => t.stop),
    ]).map((s) => s.id);
    setTourIds(ids);
    setNextNight(ids.length === 0 ? firstLitNight() : null);
    setSay(
      ids.length === 0
        ? "Nothing lit is in reach on that night — try driving, more time, or another night."
        : skipped.length
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
  const nearbyExtras = candidates
    .filter((c) => !tourIds?.includes(c.id))
    .map((c) => ({
      c,
      m: Math.min(
        ...[from, ...stops.map((s) => s.at)].map((p) => metres(p, c.at)),
      ),
    }))
    .sort((a, b) => a.m - b.m)
    .slice(0, 4);

  const move = (i: number, d: -1 | 1) => {
    if (!tourIds) return;
    const next = [...tourIds];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setTourIds(next);
  };

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setFrom({ lat: p.coords.latitude, lng: p.coords.longitude });
        setFromLabel("where you are");
      },
      () => setSay("Couldn't find you — pick a town instead."),
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

  return (
    <div className="space-y-6">
      <section
        className="space-y-4 rounded-[28px] bg-white p-5 text-[#082319] shadow-[0_6px_24px_rgba(8,35,25,0.1)] print:hidden"
        data-testid="tour-ask"
      >
        <div>
          <p className="font-bold">
            Starting from <span className="text-[#b3242f]">{fromLabel}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={locate}
              className={chip(fromLabel === "where you are")}
            >
              <Crosshair className="h-4 w-4" aria-hidden /> Where I am
            </button>
            {TOWNS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setFrom(TOWN_AT[t]);
                  setFromLabel(TOWN_LABEL[t]);
                }}
                className={chip(fromLabel === TOWN_LABEL[t])}
                data-testid={`from-${t}`}
              >
                {TOWN_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
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
        <div>
          <p className="font-bold">Time we have</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMinutes(t)}
                className={chip(minutes === t)}
                aria-pressed={minutes === t}
              >
                {clockText(t)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="font-bold">How many stops</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCount(c)}
                className={chip(count === c)}
                aria-pressed={count === c}
                data-testid={`count-${c}`}
              >
                Up to {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="font-bold">
            For our family{" "}
            <span className="font-normal text-[#5b4a2e]">
              (we&apos;ll lean that way)
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEATURES.map((f) => {
              const on = prefer.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setPrefer(
                      on ? prefer.filter((x) => x !== f.id) : [...prefer, f.id],
                    )
                  }
                  className={chip(on)}
                >
                  {f.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={withFestive}
              onClick={() => setWithFestive(!withFestive)}
              className={chip(withFestive)}
            >
              🎁 Markets, Santa & shows
            </button>
          </div>
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
        {picks.length > 0 && (
          <p className="text-sm text-[#3d4a43]">
            Your {picks.length} {picks.length === 1 ? "pick" : "picks"} from the
            map go on first.
          </p>
        )}
        <button
          type="button"
          onClick={() => build()}
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-[#b3242f] text-lg font-extrabold text-white"
          data-testid="build-tour"
        >
          ✨ Build my lights tour
        </button>
      </section>

      {nextNight && stops.length === 0 && (
        <button
          type="button"
          onClick={() => {
            setNextNight(null);
            build(nextNight);
          }}
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-[#ffd98a] px-4 text-center font-extrabold text-[#082319]"
          data-testid="next-lit-night"
        >
          ✨ The first lit night near you is{" "}
          {new Date(`${nextNight}T12:00:00Z`).toLocaleDateString("en-CA", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}{" "}
          — plan that night
        </button>
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
              {clockText(tour.minutes)} · {tour.km} km{" "}
              {mode === "walk" ? "on foot" : "by car"}
            </p>
            {tour.over && (
              <p
                className="mt-2 rounded-xl bg-[#b3242f] px-3 py-2 font-bold"
                data-testid="tour-over"
              >
                That&apos;s longer than the {clockText(minutes)} you have — drop
                a stop, or keep going and have a later night.
              </p>
            )}
            <p className="mt-1 text-sm text-white/75">
              Times are an estimate from straight-line distance; your map app
              has the real route.
            </p>
          </div>

          <LightsMap
            markers={stops.map((s, i) => ({
              id: s.id,
              at: s.at,
              emoji:
                s.kind === "atlas"
                  ? (festive.find((f) => f.id === s.id)?.emoji ?? "🎁")
                  : KIND_EMOJI[s.kind],
              label: `${i + 1}. ${s.name}`,
              n: i + 1,
            }))}
            center={from}
            route={[from, ...stops.map((s) => s.at)]}
            className="h-[300px] print:hidden"
            label={`Tour map: ${stops.map((s, i) => `${i + 1}, ${s.name}`).join("; ")}`}
          />

          <ol className="space-y-3" data-testid="tour-stops">
            {tour.stops.map((t, i) => (
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
                    {t.stop.kind === "atlas"
                      ? "Festive stop from Atlas"
                      : KIND_LABEL[t.stop.kind]}{" "}
                    · {clockText(t.leg.minutes)}{" "}
                    {mode === "walk" ? "walk" : "drive"} · stay ~{t.stay} min ·
                    arrive +{clockText(t.arrive)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 print:hidden">
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
            ))}
          </ol>

          <div className="flex flex-wrap gap-2 print:hidden">
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffd98a] px-5 font-extrabold text-[#082319]"
                data-testid="tour-directions"
              >
                <Navigation className="h-5 w-5" aria-hidden /> Open directions
              </a>
            )}
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-[#082319]"
              data-testid="tour-share"
            >
              <Share2 className="h-5 w-5" aria-hidden /> Share with the family
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
              and keep the memories there.{" "}
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
