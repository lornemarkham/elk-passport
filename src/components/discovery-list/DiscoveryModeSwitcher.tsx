import { Bot, ListChecks, Map, Sparkles } from "lucide-react";

/** A mode is a future way of browsing the same catalogue — only "List"
 * has anything behind it yet. Map and AI don't exist at all; Inspiration
 * is the current immersive Discovery experience (still fully intact at
 * /labs/discovery-space), just not wired into this switcher yet — see
 * the Discovery MVP Pivot prompt this was built against. All three are
 * reserved, disabled slots, not broken links. */
interface DiscoveryMode {
  label: string;
  icon: typeof ListChecks;
  enabled: boolean;
}

const MODES: DiscoveryMode[] = [
  { label: "List", icon: ListChecks, enabled: true },
  { label: "Map", icon: Map, enabled: false },
  { label: "Inspiration", icon: Sparkles, enabled: false },
  { label: "AI", icon: Bot, enabled: false },
];

export function DiscoveryModeSwitcher() {
  return (
    <nav
      aria-label="Discovery modes"
      className="flex flex-wrap items-center gap-2 border-b border-[#2b2015]/10 pb-3"
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        if (!mode.enabled) {
          return (
            <span
              key={mode.label}
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[#2b2015]/35"
            >
              <Icon className="h-3.5 w-3.5" />
              {mode.label}
              <span className="ml-0.5 text-[10px] tracking-wide text-[#2b2015]/25 uppercase">
                Coming Soon
              </span>
            </span>
          );
        }
        return (
          <span
            key={mode.label}
            aria-current="page"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#2b2015] px-3 py-1.5 text-sm font-medium text-[#f7ecd3]"
          >
            <Icon className="h-3.5 w-3.5" />
            {mode.label}
          </span>
        );
      })}
    </nav>
  );
}
