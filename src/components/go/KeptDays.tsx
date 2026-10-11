"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import {
  decodeKeptDays,
  KEPT_DAYS_KEY,
  reopenKeptDay,
  writeKeptDays,
  type KeptDay,
} from "@/lib/go/keptDays";

const subscribe = (notify: () => void) => {
  window.addEventListener("ghad-kept-days", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("ghad-kept-days", notify);
    window.removeEventListener("storage", notify);
  };
};

/** The raw string is the snapshot: `useSyncExternalStore` needs a stable value. */
const snapshot = (): string | null => {
  try {
    return window.localStorage.getItem(KEPT_DAYS_KEY);
  } catch {
    return null;
  }
};

const when = (iso: string): string =>
  new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );

/**
 * **Days you kept**, on this device. Shown where a day would be, because a day
 * you can only build and never come back to cannot become a plan (§2.6). Says
 * plainly that it is this browser only — nothing here is synced or sent.
 */
export function KeptDays() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const days = decodeKeptDays(raw);
  if (days.length === 0) return null;
  return (
    <section data-testid="go-kept-days" className="mt-10">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
        Days you kept
      </p>
      <p className="mt-1 text-[13px] text-black/50">
        Kept on this device only — nobody else has them, and nothing was sent.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {days.map((day) => (
          <KeptRow key={day.id} day={day} />
        ))}
      </ul>
    </section>
  );
}

function KeptRow({ day }: { readonly day: KeptDay }) {
  return (
    <li
      data-testid="go-kept-day"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ring-1 ring-black/12 ring-inset"
    >
      <div className="min-w-0">
        <p className="ghad-display text-[18px] leading-tight font-extrabold tracking-[-0.02em] text-[#111]">
          {day.title}
        </p>
        <p className="mt-0.5 text-[13px] text-black/50">
          {day.stops.length} {day.stops.length === 1 ? "stop" : "stops"} · kept{" "}
          {when(day.keptAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="go-kept-open"
          onClick={() => reopenKeptDay(day)}
          className="inline-flex min-h-11 items-center rounded-full bg-[#111] px-5 text-[14px] font-semibold text-white"
        >
          Open
        </button>
        <Link
          href={`/go/print?${day.query}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold ring-1 ring-black/20 ring-inset"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print
        </Link>
        <button
          type="button"
          data-testid="go-kept-forget"
          onClick={() =>
            writeKeptDays(
              decodeKeptDays(snapshot()).filter((d) => d.id !== day.id),
            )
          }
          className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-black/55"
        >
          Forget
        </button>
      </div>
    </li>
  );
}
