"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { usePendingRegion } from "@/components/loading/Pending";
import { DISTANCES } from "@/domain/christmas/discover";
import { WHEN_CHOICES, type WhenChoice } from "@/domain/christmas/when";
import { rememberDistance } from "./RememberDistance";

const cell =
  "flex min-w-0 flex-col justify-center rounded-2xl bg-white/12 px-3 py-1.5 ring-1 ring-white/25";
const label =
  "text-[11px] font-bold tracking-[0.14em] text-[#ffd98a] uppercase";
const select =
  "min-h-11 w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-5 text-base font-bold text-white focus:outline-none [&>option]:text-[#082319]";

/**
 * **WHERE | WHEN | HOW FAR** — the three things Christmas Discover needs,
 * and nothing else before results (owner brief "Christmas discovery UX
 * repair", 2026-11-22). Where is the shared place bar (a town, a
 * neighbourhood or a landmark, or "explore another destination" for
 * somewhere that isn't home); when is a word or chosen days; how far is
 * straight-line kilometres, remembered on this browser. Each change is the
 * address, so the server answers it and the link can be shared.
 */
export function DiscoverControls({
  when,
  from,
  to,
  km,
  today,
  label: shown,
}: {
  readonly when?: WhenChoice;
  readonly from?: string;
  readonly to?: string;
  readonly km: number;
  readonly today: string;
  /** What the server says the days are: "Tonight", "Sat, Dec 5 – Sun, Dec 6". */
  readonly label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const region = usePendingRegion();
  const current = when ?? (from || to ? "dates" : "any");
  const [choosing, setChoosing] = useState(false);
  const [days, setDays] = useState({
    from: from ?? today,
    to: to ?? from ?? today,
  });

  const go = (label: string, change: (q: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    next.delete("all");
    change(next);
    region.start(label, () =>
      router.push(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  };

  const pickWhen = (value: string) => {
    if (value === "dates") return setChoosing(true);
    setChoosing(false);
    go(value === "any" ? "Any date" : value, (q) => {
      q.delete("from");
      q.delete("to");
      if (value === "any") q.delete("when");
      else q.set("when", value);
    });
  };

  return (
    <div className="mt-3" data-testid="discover-controls">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div
          className={`${cell} col-span-2 sm:col-span-1`}
          data-testid="control-where"
        >
          <span className={label}>Where</span>
          <ExperienceLocation
            scope="christmas"
            experience="Christmas"
            className="text-white"
          />
        </div>
        <label className={`${cell} relative`} data-testid="control-when">
          <span className={label}>When</span>
          <select
            aria-label="When"
            value={choosing ? "dates" : current}
            onChange={(e) => pickWhen(e.target.value)}
            className={select}
            data-testid="when-select"
          >
            {WHEN_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
            <option value="any">Any date</option>
            <option value="dates">
              {current === "dates" ? shown : "Choose dates…"}
            </option>
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 bottom-3.5 text-white/70"
          >
            ▾
          </span>
        </label>
        <label className={`${cell} relative`} data-testid="control-far">
          <span className={label}>How far</span>
          <select
            aria-label="How far"
            value={String(km)}
            onChange={(e) => {
              const next = Number(e.target.value);
              rememberDistance(next);
              go(`Within ${next} km`, (q) => q.set("km", String(next)));
            }}
            className={select}
            data-testid="km-select"
          >
            {DISTANCES.map((d) => (
              <option key={d} value={d}>
                Within {d} km
              </option>
            ))}
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 bottom-3.5 text-white/70"
          >
            ▾
          </span>
        </label>
      </div>
      {choosing && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2 rounded-2xl bg-white/12 p-3 ring-1 ring-white/25"
          data-testid="choose-dates"
          onSubmit={(e) => {
            e.preventDefault();
            const end = days.to < days.from ? days.from : days.to;
            setChoosing(false);
            go("Your dates", (q) => {
              q.delete("when");
              q.set("from", days.from);
              q.set("to", end);
            });
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col text-sm font-semibold">
            From
            <input
              type="date"
              required
              min={today}
              value={days.from}
              onChange={(e) => setDays({ ...days, from: e.target.value })}
              className="mt-1 min-h-11 rounded-xl bg-white px-2 text-base text-[#082319]"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col text-sm font-semibold">
            To
            <input
              type="date"
              required
              min={days.from}
              value={days.to}
              onChange={(e) => setDays({ ...days, to: e.target.value })}
              className="mt-1 min-h-11 rounded-xl bg-white px-2 text-base text-[#082319]"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-white px-5 font-bold text-[#082319]"
          >
            Show
          </button>
        </form>
      )}
    </div>
  );
}
