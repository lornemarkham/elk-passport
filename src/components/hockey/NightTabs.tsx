"use client";

import Link from "next/link";
import {
  ClipboardList,
  MapPinned,
  MessageCircle,
  Trophy,
  Users,
} from "lucide-react";
import { TABS, type TabId } from "@/domain/hockey/tabs";

const ICONS: Record<TabId, typeof Trophy> = {
  plan: ClipboardList,
  play: Trophy,
  chat: MessageCircle,
  group: Users,
};

/** Where each item sits on the bar: Plan, Play, Arena, Chat, Group. */
const ORDER: Record<TabId, string> = {
  plan: "order-1",
  play: "order-2",
  chat: "order-4",
  group: "order-5",
};

const NAV =
  "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#070b14]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md";

const item = (selected: boolean) =>
  `relative flex min-h-[62px] flex-col items-center justify-center gap-1 text-[12px] font-semibold tracking-[0.08em] uppercase transition ${
    selected ? "text-white" : "text-white/60 hover:text-white/85"
  }`;

function Marker() {
  return (
    <span
      aria-hidden
      className="absolute top-0 h-[3px] w-10 rounded-b-full bg-[#ffd84d]"
    />
  );
}

function ArenaItem({ href, current }: { href: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      data-testid="nav-arena"
      className={`${item(current)} order-3`}
    >
      {current && <Marker />}
      <MapPinned
        className="h-[22px] w-[22px]"
        strokeWidth={current ? 2.4 : 2}
      />
      Arena
    </Link>
  );
}

/**
 * **Four rooms and the arena, one thumb.** Fixed to the bottom of the screen
 * where a thumb already is. Plan, Play, Chat and Group are rooms of this page,
 * each with a count of what is waiting in it — votes you have not cast, picks
 * you have not sealed, things said since you last looked. Arena is Arena
 * Mode, its own page, for nights at the one building Passport has a map of.
 */
export function NightTabs({
  current,
  onChange,
  badges,
  arenaHref,
}: {
  current: TabId;
  onChange: (tab: TabId) => void;
  badges: Partial<Record<TabId, number>>;
  /** Arena Mode for this night; absent where there is no arena map. */
  arenaHref?: string;
}) {
  return (
    <nav className={NAV} aria-label="Hockey Night sections">
      <div
        className={`mx-auto grid max-w-2xl ${arenaHref ? "grid-cols-5" : "grid-cols-4"}`}
      >
        {/* The rooms are tabs; Arena is a different page, so a link beside
            them, drawn in the middle of the bar. */}
        <div role="tablist" aria-label="Hockey Night" className="contents">
          {TABS.map(({ id, label }) => {
            const Icon = ICONS[id];
            const selected = id === current;
            const badge = badges[id] ?? 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={selected}
                aria-label={badge > 0 ? `${label}, ${badge} waiting` : label}
                aria-controls={`panel-${id}`}
                onClick={() => onChange(id)}
                className={`${item(selected)} ${ORDER[id]}`}
              >
                {selected && <Marker />}
                <span className="relative">
                  <Icon
                    className="h-[22px] w-[22px]"
                    strokeWidth={selected ? 2.4 : 2}
                  />
                  {badge > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff4646] px-1 text-[12px] leading-none font-bold text-white"
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
              </button>
            );
          })}
        </div>
        {arenaHref && <ArenaItem href={arenaHref} current={false} />}
      </div>
    </nav>
  );
}

/**
 * The same bar on Arena Mode's own page: Arena is where you are, and each
 * room is a link back to it on the night's page.
 */
export function ArenaNav({ nightId }: { nightId: string }) {
  return (
    <nav className={NAV} aria-label="Hockey Night sections">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map(({ id, label }) => {
          const Icon = ICONS[id];
          return (
            <Link
              key={id}
              href={`/hockey/${nightId}#${id}`}
              className={`${item(false)} ${ORDER[id]}`}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
        <ArenaItem href={`/hockey/${nightId}/arena`} current />
      </div>
    </nav>
  );
}
