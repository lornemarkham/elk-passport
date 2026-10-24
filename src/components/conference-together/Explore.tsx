"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Problem } from "@/components/conference/ui";
import { PlanPhoto } from "@/components/hockey/VenueCard";
import {
  SHELVES,
  type ExplorePlace,
} from "@/domain/conference-explore/explore";
import { walkLabel } from "@/domain/collections/places";
import type {
  ActivityKind,
  ExploreShelf,
} from "@/domain/conference-plans/types";
import type { ExploreView } from "@/lib/conference-explore/places";
import { Directions } from "./Directions";
import { send } from "./usePoll";

/** What kind of plan a place on each shelf suggests. */
const PLAN_KIND: Record<ExploreShelf, ActivityKind> = {
  restaurants: "dinner",
  coffee: "coffee",
  drinks: "drinks",
  waterfront: "morning-walk",
  sights: "sightseeing",
  together: "explore",
};

/**
 * **Explore: real places, near where we are, one tap from a plan.**
 *
 * Shelves of Atlas places (photographed first), measured from the venue or
 * a place the person picks — or from where they are, used for this one
 * answer and not kept. Each card offers *Plan this* (a new plan, already
 * pointed at the place) and *Add to a plan* (a suggestion on a plan that's
 * voting).
 */
export function Explore({
  conferenceId,
  plans,
  plansOn,
}: {
  conferenceId: string;
  plans: readonly { id: string; title: string; votes: boolean }[];
  plansOn: boolean;
}) {
  const [near, setNear] = useState<string>("");
  const [here, setHere] = useState<readonly [number, number] | null>(null);
  const [view, setView] = useState<ExploreView | null>(null);
  const [loading, setLoading] = useState(true);
  const [shelf, setShelf] = useState<ExploreShelf>("restaurants");
  const [adding, setAdding] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    const q = here
      ? `?lat=${here[0]}&lon=${here[1]}`
      : near
        ? `?near=${encodeURIComponent(near)}`
        : "";
    fetch(`/api/conferences/${conferenceId}/explore${q}`)
      .then((r) => r.json())
      .then((j) => live && setView(j.explore as ExploreView))
      .catch(() => live && setView(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [conferenceId, near, here]);

  const places = view?.shelves[shelf] ?? [];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[14px] font-bold" htmlFor="explore-from">
          From
        </label>
        <select
          id="explore-from"
          value={here ? "here" : near || view?.anchor?.id || ""}
          onChange={(e) => {
            if (e.target.value === "here") {
              navigator.geolocation?.getCurrentPosition(
                (p) => {
                  setLoading(true);
                  setHere([p.coords.latitude, p.coords.longitude]);
                },
                () =>
                  setNote(
                    "Couldn't tell where you are; staying with the venue.",
                  ),
              );
              return;
            }
            setLoading(true);
            setHere(null);
            setNear(e.target.value);
          }}
          className="min-h-11 max-w-[70vw] rounded-xl border border-black/15 px-3 text-[15px]"
        >
          {(view?.anchors ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          <option value="here">Where I am now</option>
        </select>
      </div>
      <Problem>{note}</Problem>

      <nav
        aria-label="Kinds of place"
        className="-mx-5 mt-4 overflow-x-auto px-5"
      >
        <ul className="flex gap-2">
          {SHELVES.map((s) => (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={shelf === s.id}
                onClick={() => setShelf(s.id)}
                className={`min-h-11 rounded-full border px-3 text-[15px] ${
                  shelf === s.id
                    ? "border-black bg-black font-bold text-white"
                    : "border-black/15"
                }`}
              >
                {s.title}
                {view ? ` · ${view.shelves[s.id].length}` : ""}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-2 text-[13px] text-black/50">
        {SHELVES.find((s) => s.id === shelf)?.note} Straight-line distances from{" "}
        {view?.anchor?.name ?? "the venue"}.
        {view?.outage
          ? " Atlas is slow right now, so this is Passport's own short list."
          : ""}
      </p>

      {loading ? (
        <p className="mt-6 text-[15px] text-black/55">Finding places…</p>
      ) : !places.length ? (
        <p className="mt-6 text-[15px] text-black/55">
          Nothing on this shelf within a walk. Try another, or another starting
          point.
        </p>
      ) : (
        <ul
          className="mt-4 grid gap-4 sm:grid-cols-2"
          data-testid="explore-places"
        >
          {places.map((p) => (
            <PlaceCard
              key={p.id}
              place={p}
              conferenceId={conferenceId}
              plansOn={plansOn}
              kind={PLAN_KIND[shelf]}
              plans={plans}
              adding={adding === p.id}
              onAdding={(on) => setAdding(on ? p.id : null)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaceCard({
  place: p,
  conferenceId,
  plansOn,
  kind,
  plans,
  adding,
  onAdding,
}: {
  place: ExplorePlace;
  conferenceId: string;
  plansOn: boolean;
  kind: ActivityKind;
  plans: readonly { id: string; title: string; votes: boolean }[];
  adding: boolean;
  onAdding: (on: boolean) => void;
}) {
  const [done, setDone] = useState("");
  const planHref = `/conferences/${conferenceId}/plans?${new URLSearchParams({
    kind,
    venue: p.id,
    venueName: p.name,
  })}`;
  return (
    <li
      className="overflow-hidden rounded-3xl border border-black/10"
      data-testid="explore-place"
    >
      <div className="relative aspect-[16/10] w-full bg-black/5">
        <PlanPhoto
          url={p.photo?.url}
          className="h-full w-full object-cover"
          fallback={
            <span className="flex h-full w-full items-center justify-center text-[40px] text-black/25">
              📍
            </span>
          }
        />
        {p.photo?.label ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
            {p.photo.label}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-[18px] leading-tight font-black">{p.name}</p>
        <p className="mt-0.5 text-[13px] text-black/55">
          {[p.subtype, p.area, p.from === "curated" ? "Passport's list" : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {p.blurb ? (
          <p className="mt-2 text-[14px] text-black/75">{p.blurb}</p>
        ) : null}
        <p className="mt-2 text-[13px] text-black/50">{walkLabel(p)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {plansOn ? (
            <Link
              href={planHref}
              className="inline-flex min-h-11 items-center rounded-xl bg-black px-3 text-[14px] font-bold text-white"
            >
              Plan this
            </Link>
          ) : null}
          {plansOn && plans.length ? (
            <button
              type="button"
              onClick={() => onAdding(!adding)}
              className="min-h-11 rounded-xl border border-black/15 px-3 text-[14px] font-semibold"
            >
              Add to a plan
            </button>
          ) : null}
          {p.at ? <Directions name={p.name} at={p.at} compact /> : null}
        </div>
        {adding ? (
          <ul className="mt-2 flex flex-col gap-1">
            {plans.map((pl) => (
              <li key={pl.id}>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-xl bg-black/[0.05] px-3 text-left text-[14px]"
                  onClick={async () => {
                    const r = await send(
                      `/api/conferences/${conferenceId}/plans`,
                      {
                        action: "suggest",
                        planId: pl.id,
                        placeId: p.id,
                      },
                    );
                    setDone(r.ok ? `Suggested for “${pl.title}”.` : r.message);
                    onAdding(false);
                  }}
                >
                  {pl.title}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {done ? (
          <p className="mt-2 text-[13px] font-semibold" role="status">
            {done}
          </p>
        ) : null}
      </div>
    </li>
  );
}
