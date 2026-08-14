import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DuplicateScanResult } from "@/lib/data/admin-repo";

/**
 * The counts and scan time live in ContentHealthSummary now, shown above
 * this regardless of whether anything was found — this just needs to
 * confirm the good outcome and say what to do next. Kept separate from
 * ContentHealthSummary rather than folded in, since "nothing to review"
 * is a distinct, positive moment worth its own visual weight, not a
 * caption under a stats grid.
 */
export function DuplicateReviewEmptyState({
  result,
}: {
  result: DuplicateScanResult;
}) {
  const counts = result.countsByKind;
  const totalChecked =
    counts.Place + counts.Organization + counts.Activity + counts.Event;

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
        <p className="text-lg font-medium">Nothing to review</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {totalChecked === 0
            ? "There's no content to check yet — this will fill in once ingestion has run."
            : "Everything currently in Atlas looks unique. Check back after the next round of content is added."}
        </p>
      </CardContent>
    </Card>
  );
}
