"use client";

import { useMemo, useState } from "react";
import { proposalsFor, type Topic } from "@/domain/snow/day";
import {
  CATEGORY_LABEL,
  filterPicks,
  type Category,
  type Pick,
} from "@/domain/snow/nearby";
import type { TabProps } from "./tabs";
import type { Nearby } from "./useMountainDay";
import { newId } from "./store";
import { Source, btn, btnOn, field, styles } from "./kit";

const ICON: Record<Category, string> = {
  lunch: "🥪",
  apres: "🍻",
  skating: "⛸️",
  tubing: "🛷",
  snowshoe: "🥾",
  spa: "♨️",
  family: "🧒",
  events: "🎟️",
};

/** Which decision a pick is added to. */
export const topicFor = (p: Pick, prefer?: Category): Topic => {
  const c = prefer && p.categories.includes(prefer) ? prefer : p.categories[0];
  return c === "lunch" ? "meals" : c === "apres" ? "apres" : "activity";
};

export function pickDetail(p: Pick): string {
  return `${p.onMountain ? "On the mountain" : `${p.km} km (straight line)`} · Atlas: ${p.evidence.slice(0, 3).join(", ")}`;
}

/**
 * **Around the mountain: what Atlas actually holds.** Real entities with
 * Atlas's own words and only its own photos; filters for distance, the
 * person not skiing, kids and the day's date. "Add to our day" puts it on
 * the crew's vote — a suggestion until someone locks it in.
 */
export function AroundMountain({
  nearby,
  mountainName,
  only,
  ...p
}: TabProps & {
  nearby: Nearby;
  mountainName: string;
  /** Show one kind only (the Lunch or Après card), without the chips. */
  only?: Category[];
}) {
  const [cat, setCat] = useState<Category | "all">("all");
  const [maxKm, setMaxKm] = useState<number>(only?.includes("lunch") ? 4 : 40);
  const [nonSkier, setNonSkier] = useState(false);
  const [kids, setKids] = useState(false);
  const all = useMemo(
    () => (nearby.status === "connected" ? nearby.picks : []),
    [nearby],
  );
  const shown = useMemo(() => {
    const base = filterPicks(all, {
      maxKm,
      nonSkier,
      kids,
      date: p.day.date,
      from: p.today,
    });
    const scoped = only
      ? base.filter((x) => x.categories.some((c) => only.includes(c)))
      : base;
    return cat === "all"
      ? scoped
      : scoped.filter((x) => x.categories.includes(cat));
  }, [all, maxKm, nonSkier, kids, p.day.date, p.today, only, cat]);

  if (nearby.status === "idle")
    return (
      <p className={`text-sm ${styles.muted}`}>
        Pick a mountain to see what&apos;s around it.
      </p>
    );
  if (nearby.status === "loading")
    return (
      <p className={`text-sm ${styles.muted}`}>
        Asking Atlas what&apos;s around {mountainName}…
      </p>
    );
  if (nearby.status === "unavailable")
    return (
      <p className="text-sm" data-testid="nearby-unavailable">
        <Source kind="missing">Atlas</Source> Atlas isn&apos;t answering right
        now, so Passport can&apos;t show places around {mountainName}.
        That&apos;s not the same as there being nothing — try again later.
      </p>
    );

  const added = (pick: Pick) =>
    (["meals", "apres", "activity"] as Topic[]).some((t) =>
      proposalsFor(p.day, t).some(
        (x) => x.label.toLowerCase() === pick.title.toLowerCase(),
      ),
    );
  const cats = [...new Set(all.flatMap((x) => x.categories))] as Category[];

  return (
    <div
      className="space-y-3"
      data-testid={only ? `around-${only.join("-")}` : "around"}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!only && (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Kind of thing"
          >
            {(["all", ...cats] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                className={`${btn} ${cat === c ? btnOn : ""}`}
                onClick={() => setCat(c)}
              >
                {c === "all" ? "Everything" : `${ICON[c]} ${CATEGORY_LABEL[c]}`}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <span>Within</span>
          <select
            className={`${field} !w-auto`}
            value={maxKm}
            onChange={(e) => setMaxKm(Number(e.target.value))}
            aria-label="Distance from the mountain"
          >
            <option value={4}>the mountain</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={40}>40 km</option>
          </select>
        </label>
        {!only && (
          <>
            <button
              type="button"
              aria-pressed={nonSkier}
              className={`${btn} ${nonSkier ? btnOn : ""}`}
              onClick={() => setNonSkier((v) => !v)}
            >
              For someone not skiing
            </button>
            <button
              type="button"
              aria-pressed={kids}
              className={`${btn} ${kids ? btnOn : ""}`}
              onClick={() => setKids((v) => !v)}
            >
              With kids
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-[var(--sn-frost)]">
        Distances are straight lines from the resort, not drives. Atlas
        doesn&apos;t hold prices or opening hours for most of these yet — the
        place&apos;s own page does.
        {kids &&
          " “With kids” leaves out only what Atlas says is adults-only; most places don't say."}
      </p>
      {shown.length === 0 ? (
        <p className="text-sm" data-testid="nearby-empty">
          Atlas holds nothing that fits{maxKm <= 4 ? ` on ${mountainName}` : ""}
          .{" "}
          {maxKm <= 4
            ? "Widen the distance, or see what Atlas is missing below."
            : ""}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {shown.slice(0, 12).map((x) => (
            <li
              key={x.id}
              className={`${styles.card} overflow-hidden`}
              data-testid="pick"
            >
              <div className="relative h-24 bg-gradient-to-br from-[#1c4468] to-[#0b1d33] sm:h-32">
                {x.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Atlas-served, relationship "exact"
                  <img
                    src={x.image}
                    alt={x.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 grid place-items-center text-5xl opacity-70"
                  >
                    {ICON[x.categories[0]]}
                  </span>
                )}
                <span className="absolute top-2 left-2 rounded-full bg-[#07121f]/80 px-2 py-0.5 text-[11px] font-bold">
                  {x.onMountain ? "On the mountain" : `${x.km} km`}
                </span>
              </div>
              <div className="space-y-1.5 p-2.5 sm:p-3">
                <p className="leading-tight font-bold">{x.title}</p>
                <p className="text-xs text-[var(--sn-frost)]">
                  {x.categories.map((c) => CATEGORY_LABEL[c]).join(" · ")}
                  {x.locality ? ` · ${x.locality}` : ""}
                </p>
                <p className="text-xs text-[var(--sn-frost)]">
                  Atlas says: {x.evidence.slice(0, 3).join(", ")}
                </p>
                {x.categories.includes("events") && (
                  <p className="text-xs">
                    {x.date ? `On ${x.date}` : "Atlas doesn't state the date"}
                  </p>
                )}
                {x.image && x.attribution && (
                  <p className="text-[10px] text-[var(--sn-frost)]/80">
                    {x.attribution}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    className={`${btn} !px-3 text-xs ${added(x) ? btnOn : ""}`}
                    disabled={added(x)}
                    onClick={() =>
                      p.act({
                        type: "propose",
                        proposal: {
                          id: newId(),
                          topic: topicFor(
                            x,
                            only?.[0] ?? (cat === "all" ? undefined : cat),
                          ),
                          label: x.title,
                          detail: pickDetail(x),
                          by: p.me.id,
                          source: "atlas",
                        },
                      })
                    }
                  >
                    {added(x) ? "On the vote" : "Add to our day"}
                  </button>
                  <a
                    className={`${btn} inline-flex items-center`}
                    href={`/places/${x.id}`}
                  >
                    Details
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What Atlas is missing around this mountain — the acquisition request. */
export function AtlasGaps({
  nearby,
  mountainName,
}: {
  nearby: Nearby;
  mountainName: string;
}) {
  const [copied, setCopied] = useState(false);
  if (nearby.status !== "connected" || nearby.gaps.length === 0) return null;
  return (
    <details className={`${styles.card} p-4`} data-testid="atlas-gaps">
      <summary className="cursor-pointer font-bold">
        What Atlas doesn&apos;t know about {mountainName} yet
      </summary>
      <p className={`mt-2 text-sm ${styles.muted}`}>
        Passport only suggests places Atlas holds, so these gaps stay gaps here
        until Atlas learns them. The request, ready for an Atlas mission
        (Passport doesn&apos;t send it anywhere by itself):
      </p>
      <pre
        className="mt-2 text-xs whitespace-pre-wrap"
        data-testid="atlas-request"
      >
        {nearby.request}
      </pre>
      <button
        type="button"
        className={`${btn} mt-2`}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(nearby.request)
            .then(() => setCopied(true));
        }}
      >
        {copied ? "Copied" : "Copy the request"}
      </button>
    </details>
  );
}
