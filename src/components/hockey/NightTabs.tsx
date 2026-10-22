"use client";

import { ClipboardList, MessageCircle, Trophy, Users } from "lucide-react";
import { TABS, type TabId } from "@/domain/hockey/tabs";

const ICONS: Record<TabId, typeof Trophy> = {
  plan: ClipboardList,
  play: Trophy,
  chat: MessageCircle,
  group: Users,
};

/**
 * **Four rooms, one thumb.** Fixed to the bottom of the screen where a thumb
 * already is, each with a count of what is waiting in it — votes you have not
 * cast, picks you have not sealed, things said since you last looked.
 */
export function NightTabs({
  current,
  onChange,
  badges,
}: {
  current: TabId;
  onChange: (tab: TabId) => void;
  badges: Partial<Record<TabId, number>>;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#070b14]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Hockey Night sections"
    >
      <div
        role="tablist"
        aria-label="Hockey Night"
        className="mx-auto grid max-w-2xl grid-cols-4"
      >
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
              className={`relative flex min-h-[62px] flex-col items-center justify-center gap-1 text-[12px] font-semibold tracking-[0.08em] uppercase transition ${
                selected ? "text-white" : "text-white/60 hover:text-white/85"
              }`}
            >
              {selected && (
                <span
                  aria-hidden
                  className="absolute top-0 h-[3px] w-10 rounded-b-full bg-[#ffd84d]"
                />
              )}
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
    </nav>
  );
}
