import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { loadRegions } from "@/lib/knowledge/regions";

export const metadata: Metadata = { title: "Regions — Atlas" };

/**
 * **Regions — the level between Atlas and an entity.**
 *
 * ## The one question this page answers
 *
 * *"Which destinations does Atlas cover, and where do I go?"*
 *
 * ## Why this page exists at all
 *
 * Geography is fundamental to Atlas. A curator's real unit of work is
 * *"grow the Okanagan"*, not *"crawl entity #1234"* — and until this page
 * existed the hierarchy had no place to say so. Every entity sat in one
 * flat list of 167, and the product concept that organises the whole
 * business was invisible.
 *
 * ## Unassigned is shown, not hidden
 *
 * Almost every entity Atlas holds belongs to no region yet, because
 * membership is asserted by a curator and nobody has asserted much. That
 * number is displayed as prominently as the regions themselves.
 *
 * Hiding it would make this page a pleasant fiction — the same defect as a
 * knowledge section that omits a fact nobody wrote a template for, and the
 * exact failure the previous reorganization made by opening the admin with
 * category completeness that answered nobody's question.
 */
export default async function RegionsPage() {
  const { regions, unassignedIds } = await loadRegions();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Atlas
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Regions</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Atlas grows one destination at a time. A region owns the health of the
          knowledge inside it.
        </p>
      </div>

      {regions.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-8">
          <p className="font-medium">
            The benchmark region, Okanagan, has not been created yet.
          </p>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            A region is a Place with{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
              placeType: region
            </code>
            , and membership is the{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
              contains
            </code>{" "}
            relationship Atlas already uses. Nothing is inferred from
            coordinates — a curator states which destination an entity belongs
            to.
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            Create one:{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
              npm run define-region -- &quot;Okanagan&quot; --lat 49.8 --lon
              -119.5 --assign &quot;Big White Ski Resort&quot;
            </code>
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {regions.map((region) => (
            <Link
              key={region.id}
              href={`/admin/regions/${region.id}`}
              className="border-border hover:border-foreground/30 hover:bg-muted/30 group flex flex-col gap-2 rounded-xl border p-6 transition"
            >
              <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <MapPin className="text-muted-foreground h-4 w-4" />
                {region.name}
              </p>
              <p className="text-muted-foreground text-sm tabular-nums">
                {region.memberIds.length} entit
                {region.memberIds.length === 1 ? "y" : "ies"} placed here
              </p>
              {region.description && (
                <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                  {region.description}
                </p>
              )}
              <span className="text-muted-foreground group-hover:text-foreground mt-1 inline-flex items-center gap-1.5 text-sm">
                Open region
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Stated plainly. This is the honest shape of the corpus today. */}
      <section className="border-border rounded-xl border p-6">
        <p className="text-sm font-medium">
          {unassignedIds.length} entit{unassignedIds.length === 1 ? "y" : "ies"}{" "}
          belong to no region
        </p>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Membership is asserted by a curator, never inferred from coordinates —
          &ldquo;inside this rectangle&rdquo; is not the same statement as
          &ldquo;belongs to this destination&rdquo;. Until someone places them,
          these entities are reachable through the full list rather than through
          a region.
        </p>
        <Link
          href="/admin/entities"
          className="border-border hover:bg-muted/40 mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
        >
          Browse all entities
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
