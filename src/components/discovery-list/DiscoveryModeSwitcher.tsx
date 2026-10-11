import { ListChecks, Sparkles } from "lucide-react";

/** A mode is a way of browsing the same catalogue.
 *
 * **Discover** composes what Passport can offer today. **Inspiration** answers
 * the other question — *what could make today better?* — over the identical
 * `Experience[]`, which is why enabling it needed no new data path.
 *
 * ## What used to be here, and why it is not
 *
 * Five peers: List, Inspiration, October, Map, AI. Three problems with that.
 *
 * **Map and AI did not exist.** They sat greyed out with a `title` nobody on a
 * phone can read, which is a promise the product cannot keep printed in the
 * one place a person looks to find out what it does. A reserved slot is only
 * honest while somebody is about to build it; after months it is just a dead
 * control. The routes were never there to delete — nothing is lost.
 *
 * **AI as a peer mode contradicts the product.** The doctrine is explicit:
 * *AI is not a tab.* Intelligence belongs inside composing, ranking and
 * understanding what somebody meant — not behind a button that says the word.
 * Offering it as a fourth way to browse teaches exactly the wrong model.
 *
 * **October is not a view mode.** It is an Experience with its own front door,
 * its own navigation and its own route tree at `/october`. Rendering it as a
 * third way to look at this page quietly answered an architectural question
 * (see the doctrine, §10) that is explicitly still open. It is now a link out,
 * not a tab — the smallest change that stops asserting the wrong answer.
 *
 * The immersive spatial experiment remains untouched at
 * /labs/discovery-space; it is a different idea from this feed, not an earlier
 * draft of it. */
export type DiscoveryMode = "Discover" | "Inspiration";

interface DiscoveryModeOption {
  label: DiscoveryMode;
  icon: typeof ListChecks;
}

const MODES: DiscoveryModeOption[] = [
  { label: "Discover", icon: ListChecks },
  { label: "Inspiration", icon: Sparkles },
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
    <nav aria-label="Discovery modes" className="flex items-center gap-1.5">
      {MODES.map((option) => {
        const Icon = option.icon;
        const selected = mode === option.label;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onModeChange(option.label)}
            aria-current={selected ? "page" : undefined}
            data-testid={`mode-${option.label.toLowerCase()}`}
            className={
              selected
                ? "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#111] px-4 text-sm font-medium text-white"
                : "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-black/60 transition-colors hover:bg-[#111]/8 hover:text-[#111]"
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
