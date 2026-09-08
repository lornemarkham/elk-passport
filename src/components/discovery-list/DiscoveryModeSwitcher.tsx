import { Bot, ListChecks, Map, Sparkles } from "lucide-react";

/** A mode is a way of browsing the same catalogue.
 *
 * **List** finds the thing you already have in mind. **Inspiration** answers
 * the other question — *what could make today better?* — over the identical
 * `Experience[]`, which is why enabling it needed no new data path.
 *
 * Map and AI do not exist at all and stay reserved, disabled slots rather than
 * broken links. The immersive spatial experiment remains untouched at
 * /labs/discovery-space; it is a different idea from this feed, not an earlier
 * draft of it. */
export type DiscoveryMode = "List" | "Inspiration";

interface DiscoveryModeOption {
  label: string;
  icon: typeof ListChecks;
  enabled: boolean;
}

const MODES: DiscoveryModeOption[] = [
  { label: "List", icon: ListChecks, enabled: true },
  { label: "Inspiration", icon: Sparkles, enabled: true },
  { label: "Map", icon: Map, enabled: false },
  { label: "AI", icon: Bot, enabled: false },
];

interface DiscoveryModeSwitcherProps {
  mode: DiscoveryMode;
  onModeChange: (mode: DiscoveryMode) => void;
}

export function DiscoveryModeSwitcher({
  mode,
  onModeChange,
}: DiscoveryModeSwitcherProps) {
  return (
    <nav
      aria-label="Discovery modes"
      className="flex flex-wrap items-center gap-1.5 border-b border-[#2b2015]/10 pb-2"
    >
      {MODES.map((option) => {
        const Icon = option.icon;
        if (!option.enabled) {
          // Reserved, not advertised. Three "COMING SOON" labels wrapped onto
          // four lines at 375px and pushed the first actual discovery to
          // y≈704 — most of a phone screen spent telling the traveller about
          // features that do not exist. The slot is kept, the announcement is
          // not.
          return (
            <span
              key={option.label}
              aria-disabled="true"
              title={`${option.label} — coming soon`}
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-[#2b2015]/30"
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </span>
          );
        }
        const selected = mode === option.label;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onModeChange(option.label as DiscoveryMode)}
            aria-current={selected ? "page" : undefined}
            className={
              selected
                ? "inline-flex items-center gap-1.5 rounded-full bg-[#2b2015] px-3 py-1.5 text-sm font-medium text-[#f7ecd3]"
                : "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-[#2b2015]/60 transition-colors hover:bg-[#2b2015]/8 hover:text-[#2b2015]"
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}
