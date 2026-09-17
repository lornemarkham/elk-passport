import { DollarSign } from "lucide-react";
import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";
import { asOfCaption } from "./asOf";

/**
 * `feeRequired` is a plain boolean — `false` renders "No fee" just as
 * confidently as `true` renders "A fee applies", because both are real,
 * stated facts (Atlas never assumes free-by-default; see `Place.ts`'s own
 * doc comment). `undefined` — a source simply hasn't said — renders
 * nothing, per this whole page's "if Atlas doesn't know, hide it" rule.
 */
export function PlaceFees({ place, temporal }: PlaceSectionProps) {
  if (place.feeRequired === undefined) return null;
  const asOf = asOfCaption(temporal, "feeRequired");

  return (
    <SectionShell title="Fees">
      <p className="flex items-center gap-2 text-sm">
        <DollarSign className="text-muted-foreground h-4 w-4 shrink-0" />
        {place.feeRequired ? "A fee applies." : "No fee."}
        {asOf && <span className="text-muted-foreground text-xs">{asOf}</span>}
      </p>
    </SectionShell>
  );
}
