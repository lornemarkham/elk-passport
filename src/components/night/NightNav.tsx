"use client";

import {
  Camera,
  Compass,
  HeartHandshake,
  Send,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

/**
 * **Five rooms, one thumb** — Hockey Night's bar (`hockey/NightTabs.tsx`),
 * dressed for Date Night. On a phone it sits at the bottom where the thumb
 * already is; on a desktop the same rooms are a compact row under the hero.
 * Each room is a part of this one page, chosen by the address's `#`, so a
 * link can open any of them and Back works.
 */

export type Room = "adventure" | "change" | "together" | "memories" | "invite";

export const ROOMS: readonly {
  readonly id: Room;
  readonly label: string;
  readonly icon: LucideIcon;
}[] = [
  { id: "adventure", label: "Adventure", icon: Compass },
  { id: "change", label: "Change it", icon: SlidersHorizontal },
  { id: "together", label: "Together", icon: HeartHandshake },
  { id: "memories", label: "Memories", icon: Camera },
  { id: "invite", label: "Invite", icon: Send },
];

export const isRoom = (s: string): s is Room => ROOMS.some((r) => r.id === s);

function Badge({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="absolute -top-1.5 -right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--n-ember)] px-1 text-[11px] leading-none font-bold text-white"
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function NightNav({
  current,
  onChange,
  badges,
}: {
  current: Room;
  onChange: (room: Room) => void;
  badges: Partial<Record<Room, number>>;
}) {
  const said = (r: (typeof ROOMS)[number]) =>
    (badges[r.id] ?? 0) > 0 ? `${r.label}, ${badges[r.id]} waiting` : r.label;
  return (
    <>
      {/* A desktop: a compact row of rooms under the hero. */}
      <nav
        aria-label="Date Night rooms"
        className="sticky top-0 z-20 hidden border-b border-black/5 bg-[var(--n-cream)]/95 backdrop-blur md:block"
      >
        <div
          role="tablist"
          aria-label="Date Night"
          className="mx-auto flex max-w-5xl justify-center gap-1 px-5 py-2"
        >
          {ROOMS.map((r) => {
            const on = r.id === current;
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`room-${r.id}`}
                aria-label={said(r)}
                data-testid={`room-tab-${r.id}`}
                onClick={() => onChange(r.id)}
                className={`relative inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-bold transition ${
                  on
                    ? "bg-[var(--n-forest)] text-[var(--n-cream)]"
                    : "text-[var(--n-ink)]/70 hover:bg-black/5"
                }`}
              >
                <span className="relative">
                  <Icon className="h-4 w-4" aria-hidden />
                  {(badges[r.id] ?? 0) > 0 && <Badge n={badges[r.id]!} />}
                </span>
                {r.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* A phone: fixed to the bottom, clear of the home indicator. */}
      <nav
        aria-label="Date Night rooms"
        data-testid="night-bottom-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[var(--n-paper)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(28,27,24,0.35)] backdrop-blur-md md:hidden"
      >
        <div
          role="tablist"
          aria-label="Date Night"
          className="mx-auto grid max-w-xl grid-cols-5"
        >
          {ROOMS.map((r) => {
            const on = r.id === current;
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`room-${r.id}`}
                aria-label={said(r)}
                data-testid={`room-${r.id}-bottom`}
                onClick={() => onChange(r.id)}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-[0.02em] transition ${
                  on
                    ? "text-[var(--n-forest)]"
                    : "text-[var(--n-ink)]/55 active:text-[var(--n-ink)]"
                }`}
              >
                {on && (
                  <span
                    aria-hidden
                    className="absolute top-0 h-[3px] w-10 rounded-b-full bg-[var(--n-ember)]"
                  />
                )}
                <span className="relative">
                  <Icon
                    className="h-[22px] w-[22px]"
                    strokeWidth={on ? 2.4 : 2}
                    aria-hidden
                  />
                  {(badges[r.id] ?? 0) > 0 && <Badge n={badges[r.id]!} />}
                </span>
                {r.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
