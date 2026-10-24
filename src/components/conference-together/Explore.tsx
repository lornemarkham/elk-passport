"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { btn } from "@/components/conference/kit";
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
        <label className="cf-eyebrow text-cf-mist" htmlFor="explore-from">
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
          className="border-cf-line min-h-10 max-w-[70vw] rounded-full border bg-white px-4 text-[14px]"
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
                className={`min-h-10 rounded-full border px-4 text-[14px] font-semibold transition ${
                  shelf === s.id
                    ? "border-cf-ink bg-cf-ink text-white"
                    : "border-cf-line text-cf-slate hover:text-cf-ink bg-white"
                }`}
              >
                {s.title}
                {view ? ` · ${view.shelves[s.id].length}` : ""}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-cf-mist mt-2 text-[13px]">
        {SHELVES.find((s) => s.id === shelf)?.note} Straight-line distances from{" "}
        {view?.anchor?.name ?? "the venue"}.
        {view?.outage
          ? " Atlas is slow right now, so this is Passport's own short list."
          : ""}
      </p>

      {loading ? (
        <p className="text-cf-mist mt-6 text-[15px]">Finding places…</p>
      ) : !places.length ? (
        <p className="text-cf-mist mt-6 text-[15px]">
          Nothing on this shelf within a walk. Try another, or another starting
          point.
        </p>
      ) : (
        <ul
          className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
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
  // Atlas places have a Passport page, where they can be saved to your own
  // Saved and Adventures. Curated ones don't (yet).
  const atlas = p.from !== "curated" && !p.id.startsWith("curated:");
  return (
    <li
      className="group border-cf-line flex flex-col overflow-hidden rounded-2xl border bg-white transition hover:shadow-[0_18px_40px_-24px_rgba(23,24,27,0.35)]"
      data-testid="explore-place"
    >
      <div className="bg-cf-sand relative aspect-[4/3] w-full overflow-hidden">
        <PlanPhoto
          url={p.photo?.url}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          fallback={
            <span className="flex h-full w-full flex-col items-start justify-end bg-[linear-gradient(135deg,#efebe2,#e6e1d5)] p-5">
              <span className="cf-eyebrow text-cf-mist">
                {p.subtype ?? "Place"} · no photograph in Atlas
              </span>
              <span className="cf-display text-cf-ink/80 mt-1 text-[30px] leading-none">
                {p.name}
              </span>
            </span>
          }
        />
        {p.photo?.label ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
            {p.photo.label}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="cf-eyebrow text-cf-mist">
          {[p.subtype, p.area, p.from === "curated" ? "Passport's list" : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="cf-serif text-cf-ink mt-1.5 text-[20px] leading-snug">
          {p.name}
        </p>
        {p.blurb ? (
          <p className="text-cf-slate mt-2 line-clamp-2 text-[14px] leading-relaxed">
            {p.blurb}
          </p>
        ) : null}
        <p className="text-cf-mist mt-3 text-[12px]">{walkLabel(p)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {plansOn ? (
            <Link href={planHref} className={btn.primary}>
              Plan this
            </Link>
          ) : null}
          {plansOn && plans.length ? (
            <button
              type="button"
              onClick={() => onAdding(!adding)}
              aria-expanded={adding}
              className={btn.secondary}
            >
              Add to a plan
            </button>
          ) : null}
          {p.at ? <Directions name={p.name} at={p.at} compact /> : null}
          {atlas ? (
            <Link
              href={`/places/${encodeURIComponent(p.id)}`}
              className="text-cf-slate hover:text-cf-ink ml-auto text-[13px] font-semibold underline-offset-4 hover:underline"
            >
              Details &amp; save
            </Link>
          ) : null}
        </div>
        {adding ? (
          <ul className="mt-3 flex flex-col gap-1">
            <li className="cf-eyebrow text-cf-mist px-1 pb-1">
              Suggest it for
            </li>
            {plans.map((pl) => (
              <li key={pl.id}>
                <button
                  type="button"
                  className="bg-cf-paper text-cf-ink hover:bg-cf-sand min-h-10 w-full rounded-xl px-3 text-left text-[14px]"
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
          <p
            className="text-cf-sage mt-2 text-[13px] font-semibold"
            role="status"
          >
            {done}
          </p>
        ) : null}
      </div>
    </li>
  );
}
