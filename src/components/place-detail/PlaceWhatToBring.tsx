import { Backpack, CreditCard, Flame, Accessibility } from "lucide-react";
import type { PlaceSectionProps } from "./types";

interface BringHint {
  readonly label: string;
  readonly Icon: typeof Backpack;
}

/**
 * Phase 7.6 — rebuilt as a compact chip tray, distinct from the timeline
 * and the featured-image section around it — small, dense, scannable, a
 * different rhythm beat than either neighbor. Same real, derived hints as
 * Phase 7.5 (fee, active fire ban, wheelchair accessibility) — the
 * "Atlas doesn't yet track..." coverage note is gone entirely, per Phase
 * 7.6's product direction: a traveler-facing page never states what it
 * doesn't know, it just shows what it does.
 *
 * Returns `null` when there are no real hints — no disclaimer, no
 * near-empty section, nothing.
 */
export function PlaceWhatToBring({ place }: PlaceSectionProps) {
  const hints: BringHint[] = [];

  if (place.feeRequired === true) {
    hints.push({ label: "A way to pay", Icon: CreditCard });
  }
  if (place.hasActiveFireBan === true) {
    hints.push({ label: "No firewood needed", Icon: Flame });
  }
  if (place.wheelchairAccessible === "limited") {
    hints.push({
      label: "Limited accessibility — plan ahead",
      Icon: Accessibility,
    });
  } else if (place.wheelchairAccessible === "no") {
    hints.push({ label: "Not wheelchair accessible", Icon: Accessibility });
  }

  if (hints.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
        <Backpack className="h-3.5 w-3.5" aria-hidden />
        What To Bring
      </h2>
      <div className="flex flex-wrap gap-2">
        {hints.map(({ label, Icon }) => (
          <span
            key={label}
            className="border-border bg-muted/40 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
          >
            <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
