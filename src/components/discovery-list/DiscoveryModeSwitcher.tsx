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
      className="flex flex-wrap items-center gap-1.5 border-b border-[#2b2015]/10 pb-2"
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        if (!mode.enabled) {
          // Reserved, not advertised. Three "COMING SOON" labels wrapped onto
          // four lines at 375px and pushed the first actual discovery to
          // y≈704 — most of a phone screen spent telling the traveller about
          // features that do not exist. The slot is kept, the announcement is
          // not.
          return (
            <span
              key={mode.label}
              aria-disabled="true"
              title={`${mode.label} — coming soon`}
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-[#2b2015]/30"
            >
              <Icon className="h-3.5 w-3.5" />
              {mode.label}
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
