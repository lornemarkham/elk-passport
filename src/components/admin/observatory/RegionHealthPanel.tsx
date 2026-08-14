import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type {
  CategoryHealth,
  RegionHealth,
} from "@/lib/knowledge/regionHealth";

/**
 * How well Atlas knows what it knows — by the categories a traveller
 * thinks in, not the ones the schema uses.
 *
 * ## The number this shows, and the one it refuses to
 *
 * It would be easy to print "Okanagan knowledge: 63%". It would also be
 * fiction: Atlas has no denominator, cannot know how many restaurants
 * Vernon has, and any coverage-of-the-world percentage would be invented.
 *
 * So the headline is **completeness of held knowledge** — of the entities
 * Atlas has, how many trace to their own website, carry a photograph, and
 * (for places) have coordinates. The label says exactly that, because a
 * number quietly meaning something other than it appears to is the most
 * durable form of dishonesty available to a dashboard.
 *
 * A category with nothing in it says **"Not yet measurable"** and why —
 * never 0%, which reads as a failing grade for something Atlas has simply
 * never been taught.
 */
export function RegionHealthPanel({ health }: { health: RegionHealth }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">
            What Atlas knows
          </h3>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            How <em>complete</em> Atlas&apos;s knowledge is — not how much of
            the world it covers, which it has no way to know. Each entity is
            checked for a first-party source, a photograph, and a location.
          </p>
        </div>

        {health.completeness !== null && (
          <div className="text-right">
            <p className="text-4xl font-semibold tabular-nums">
              {health.completeness}%
            </p>
            <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
              across {health.totalEntities} entities
            </p>
          </div>
        )}
      </div>

      {health.weakest.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Weakest right now:{" "}
          {health.weakest.map((c, i) => (
            <span key={c.key}>
              {i > 0 && " · "}
              <span className="text-foreground font-medium">
                {c.label}
              </span>{" "}
              {c.completeness}%
            </span>
          ))}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {health.categories.map((category) => (
          <CategoryCard key={category.key} category={category} />
        ))}
      </div>
    </section>
  );
}

function CategoryCard({ category }: { category: CategoryHealth }) {
  const measurable = category.completeness !== null;

  return (
    <div className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{category.label}</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {category.unlocks}
          </p>
        </div>
        {measurable && (
          <span className="text-lg font-semibold tabular-nums">
            {category.completeness}%
          </span>
        )}
      </div>

      {measurable ? (
        <>
          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${
                (category.completeness ?? 0) >= 66
                  ? "bg-emerald-500/70"
                  : (category.completeness ?? 0) >= 33
                    ? "bg-amber-500/70"
                    : "bg-muted-foreground/40"
              }`}
              style={{ width: `${category.completeness}%` }}
            />
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <span>
              <span className="text-foreground font-medium tabular-nums">
                {category.known}
              </span>{" "}
              known
            </span>
            {category.missingFirstPartySource > 0 && (
              <span className="tabular-nums">
                {category.missingFirstPartySource} need a website
              </span>
            )}
            {category.missingImage > 0 && (
              <span className="tabular-nums">
                {category.missingImage} need an image
              </span>
            )}
            {category.missingCoordinates > 0 && (
              <span className="tabular-nums">
                {category.missingCoordinates} need coordinates
              </span>
            )}
          </div>

          <Link
            href="/admin/workspace"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            Open workspace
            <ArrowRight className="h-3 w-3" />
          </Link>
        </>
      ) : (
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            Not yet measurable
          </p>
          <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
            {category.notMeasurable}
          </p>
        </div>
      )}
    </div>
  );
}
