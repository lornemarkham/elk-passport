import { Card, CardContent } from "@/components/ui/card";
import type { DuplicateScanResult } from "@/lib/data/admin-repo";
import { scoreTextColor } from "./knowledgeScorePresentation";

function formatScannedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The duplicate-scan overview — deliberately scoped to just what
 * `AdminDuplicatesView`'s own scan produces (data-integrity stats: same
 * real place described more than once). Sprint 2: the broader
 * Completeness/Knowledge Health picture (missing images, missing
 * coordinates, per-dimension scores) moved to its own card,
 * `KnowledgeHealthPanel`, once it grew real per-dimension data worth
 * showing on its own rather than as four extra cells bolted onto this
 * one — two cards each answering one clear question beats one card
 * answering two.
 */
export function ContentHealthSummary({
  result,
}: {
  result: DuplicateScanResult;
}) {
  const counts = result.countsByKind;
  const totalChecked =
    counts.Place + counts.Organization + counts.Activity + counts.Event;
  const recordsNeedingAttention = result.groups.reduce(
    (sum, g) => sum + g.entities.length,
    0,
  );
  const needsCarefulReview = result.groups.filter(
    (g) => g.confidence === "medium",
  ).length;
  const healthPercent =
    totalChecked === 0
      ? null
      : Math.round(
          ((totalChecked - recordsNeedingAttention) / totalChecked) * 100,
        );

  const stats: { label: string; value: string; accent?: string }[] = [
    {
      label: "Duplicate-free rate",
      value: healthPercent === null ? "—" : `${healthPercent}%`,
      accent: scoreTextColor(healthPercent),
    },
    { label: "Entries checked", value: totalChecked.toLocaleString() },
    { label: "Duplicate groups", value: result.groups.length.toLocaleString() },
    {
      label: "Need careful review",
      value: needsCarefulReview.toLocaleString(),
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Overview</p>
          <p className="text-muted-foreground text-xs">
            Last checked {formatScannedAt(result.scannedAt)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-muted-foreground text-xs">{stat.label}</dt>
              <dd className={`text-2xl font-semibold ${stat.accent ?? ""}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
