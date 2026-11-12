"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ABILITIES,
  ABILITY_LABEL,
  ABILITY_RUNS,
  type Ability,
} from "@/domain/snow/ability";
import {
  LIVE_FACTS,
  MOUNTAINS,
  findMountains,
  type MountainRow,
} from "@/domain/snow/mountains";
import { LocationBar } from "@/components/location/LocationBar";
import { useLocation } from "@/lib/location/useLocation";
import { distanceKm } from "@/lib/environment/geo";
import type { AtlasAreas } from "@/app/snow/_server/atlas";
import { Card, Source, btn, btnOn, field, styles } from "./kit";

interface Forecast {
  readonly description?: string;
  readonly wet: boolean;
  readonly chance?: number;
  readonly source: string;
  readonly area?: string;
  readonly km?: number;
}

type Where = { name: string; latitude: number; longitude: number };

const KM_CHOICES = [
  [0, "Any distance"],
  [100, "Within 100 km"],
  [250, "Within 250 km"],
  [500, "Within 500 km"],
] as const;

/**
 * **Find the mountain.** Atlas first (when connected), Passport's short list
 * beside it. Distance is straight-line from a town you pick — or from where
 * you are, if you say so; that position is used in this tab and not kept.
 */
export function MountainExplorer({ atlas }: { atlas: AtlasAreas }) {
  // The shared place (saved, already granted, or an approximate region), for
  // this experience: changing it here can be "just for Snow" and leaves home.
  const place = useLocation("snow").town;
  const origin = useMemo<Where | null>(
    () =>
      place
        ? {
            name: place.name.replace(/,\s*BC$/, ""),
            latitude: place.latitude,
            longitude: place.longitude,
          }
        : null,
    [place],
  );
  const [within, setWithin] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Ability | null>(null);

  const rows = useMemo(
    () =>
      findMountains(MOUNTAINS, {
        from: origin ?? undefined,
        withinKm: within || undefined,
        query,
      }),
    [origin, within, query],
  );

  const atlasRows = atlas.areas
    .map((a) => ({
      ...a,
      km:
        origin && a.latitude !== undefined && a.longitude !== undefined
          ? Math.round(
              distanceKm(origin, {
                latitude: a.latitude,
                longitude: a.longitude,
              }),
            )
          : undefined,
    }))
    .filter((a) => !query || a.name.toLowerCase().includes(query.toLowerCase()))
    .filter((a) => !within || a.km === undefined || a.km <= within)
    .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-black sm:text-5xl">Find your mountain</h1>
        <p className={styles.muted}>
          Skiing, snowboarding, and a day in the snow. Facts that change daily
          are marked, and never guessed.
        </p>
      </header>

      <Card className="space-y-4" aria-label="Narrow it down">
        <LocationBar scope="snow" experience="Snow" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">How far</span>
            <select
              className={field}
              value={within}
              onChange={(e) => setWithin(Number(e.target.value))}
            >
              {KM_CHOICES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">Search</span>
            <input
              className={field}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Whistler, Okanagan…"
            />
          </label>
        </div>
        {origin && (
          <p className="text-sm font-semibold">
            Nearest first, from {origin.name} (straight line, not a drive).
            Widen &ldquo;How far&rdquo; to see worthwhile mountains further
            away.
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            The least experienced rider in your crew
          </legend>
          <div className="flex flex-wrap gap-2">
            {ABILITIES.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={level === a}
                onClick={() => setLevel(level === a ? null : a)}
                className={`${btn} ${level === a ? btnOn : ""}`}
              >
                {ABILITY_LABEL[a]}
              </button>
            ))}
          </div>
        </fieldset>
        {level && (
          <div
            className="rounded-xl border border-[var(--sn-line)] p-3 text-sm"
            data-testid="level-guide"
          >
            <Source kind="static">Passport guidance</Source>
            <p className="mt-2">
              A {ABILITY_LABEL[level].toLowerCase()} crew should plan on{" "}
              {ABILITY_RUNS[level]}.
            </p>
            <p className="mt-1 text-[var(--sn-frost)]">
              Before you choose, check on the resort&apos;s own site: is there a
              learning area
              {level === "first-timer" || level === "beginner"
                ? ", lessons and a beginner lift"
                : " and runs at your level that are open"}
              ? Passport doesn&apos;t hold run lists or terrain splits.
            </p>
          </div>
        )}
      </Card>

      <section aria-labelledby="atlas-h" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="atlas-h" className="text-2xl font-extrabold">
            From Atlas
          </h2>
          {atlas.status === "connected" ? (
            <Source kind="static">Atlas knowledge</Source>
          ) : (
            <Source kind="missing">Atlas</Source>
          )}
        </div>
        {atlas.status === "unavailable" ? (
          <p className={styles.muted}>
            Atlas isn&apos;t answering right now, so Passport&apos;s own list
            below is all there is. Nothing is missing because it doesn&apos;t
            exist.
          </p>
        ) : atlasRows.length === 0 ? (
          <p className={styles.muted}>
            Atlas answered, and holds no ski areas that match.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="atlas-areas">
            {atlasRows.map((a) => (
              <li key={a.id}>
                <Card className="h-full space-y-2">
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- Atlas-served, relationship "exact"
                    <img
                      src={a.image}
                      alt={a.name}
                      className="h-36 w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  )}
                  {a.attribution && (
                    <p className="text-[11px] text-[var(--sn-frost)]">
                      {a.attribution}
                    </p>
                  )}
                  <h3 className="text-lg font-bold">{a.name}</h3>
                  <p className="text-sm text-[var(--sn-frost)]">
                    {[a.region, a.km !== undefined ? `${a.km} km` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="line-clamp-3 text-sm">{a.description}</p>
                  <div className="flex gap-2">
                    <Link
                      className={`${btn} inline-flex items-center`}
                      href={`/snow/new?atlas=${encodeURIComponent(a.name)}`}
                    >
                      Plan a day here
                    </Link>
                    <Link
                      className={`${btn} inline-flex items-center`}
                      href={`/places/${a.id}`}
                    >
                      Details
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="list-h" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="list-h" className="text-2xl font-extrabold">
            Passport&apos;s short list
          </h2>
          <Source kind="static">written down, check the resort</Source>
        </div>
        {rows.length === 0 ? (
          <p className={styles.muted}>
            Nothing that close. Try a wider distance.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="mountain-list">
            {rows.map((m) => (
              <li key={m.id}>
                <MountainCard m={m} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MountainCard({ m }: { m: MountainRow }) {
  const [forecast, setForecast] = useState<
    Forecast | "none" | "failed" | "loading" | null
  >(null);

  async function check() {
    setForecast("loading");
    try {
      const r = await fetch("/api/environment/here", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: m.latitude, longitude: m.longitude }),
      });
      const body = (await r.json()) as { weather?: Forecast };
      setForecast(body.weather ?? "none");
    } catch {
      setForecast("failed");
    }
  }

  return (
    <Card className="h-full space-y-3" data-testid={`mountain-${m.id}`}>
      <div>
        <h3 className="text-lg font-bold">{m.name}</h3>
        <p className="text-sm text-[var(--sn-frost)]">
          {m.region}
          {m.km !== undefined && ` · about ${m.km} km`}
        </p>
      </div>
      <ul className="space-y-1.5 text-sm">
        {LIVE_FACTS.map((f) => (
          <li
            key={f.key}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span>{f.label}</span>
            <Source kind="missing">
              <a
                className="underline"
                href={m.site}
                target="_blank"
                rel="noreferrer"
              >
                see {new URL(m.site).hostname.replace("www.", "")}
              </a>
            </Source>
          </li>
        ))}
      </ul>
      <div className="min-h-9 text-sm" aria-live="polite">
        {forecast === null && (
          <button type="button" className={btn} onClick={check}>
            Today&apos;s forecast nearby
          </button>
        )}
        {forecast === "loading" && <span>Asking Environment Canada…</span>}
        {forecast === "failed" && (
          <span>
            Couldn&apos;t reach the forecast. Try the resort&apos;s site.
          </span>
        )}
        {forecast === "none" && (
          <span>No forecast published near enough to {m.name}.</span>
        )}
        {forecast && typeof forecast === "object" && (
          <div className="space-y-1">
            <Source kind="live">{forecast.source}</Source>
            <p>
              {forecast.description ??
                (forecast.wet
                  ? "Precipitation expected."
                  : "No precipitation expected.")}
              {forecast.chance !== undefined && ` (${forecast.chance}% chance)`}
            </p>
            <p className="text-xs text-[var(--sn-frost)]">
              For {forecast.area ?? "the nearest city"}
              {forecast.km !== undefined && `, ${forecast.km} km away`} — a town
              forecast, not the summit.
            </p>
          </div>
        )}
      </div>
      <Link
        href={`/snow/new?mountain=${m.id}`}
        className={`${styles.go} inline-flex min-h-11 items-center rounded-full px-5 text-sm uppercase`}
      >
        Plan a day here
      </Link>
    </Card>
  );
}
