import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EntityPicker } from "@/components/admin/entities/EntityPicker";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";
import { loadRegions, findRegion } from "@/lib/knowledge/regions";
import { buildEntityRows } from "@/lib/knowledge/entityRows";
import { loadWorkspaceBundle } from "@/lib/knowledge/workspaceData";

type Props = { params: Promise<{ regionId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regionId } = await params;
  const region = findRegion(await loadRegions(), regionId);
  return {
    title: region ? `${region.name} entities — Atlas` : "Entities — Atlas",
  };
}

/**
 * **The entities in one region.**
 *
 * ## The one question this page answers
 *
 * *"Which entities in this destination need attention?"*
 *
 * A browser, not a dashboard. No health summary, no counters, no next
 * actions — the region page above it owns all of that, and repeating any of
 * it here would recreate the two-pages-one-job defect this reorganization
 * exists to remove.
 *
 * ## Reused wholesale
 *
 * `EntityPicker` is the same component the global list uses, with the same
 * search, kind filter and sorts. Only the scope differs, and the scope is
 * real membership rather than a UI filter over a fiction.
 */
export default async function RegionEntitiesPage({ params }: Props) {
  const { regionId } = await params;

  const regionsResult = await loadRegions();
  const region = findRegion(regionsResult, regionId);
  if (!region) notFound();

  const bundle = await loadWorkspaceBundle().catch(() => null);
  if (!bundle) return <AdminSetupNotice />;

  const rows = buildEntityRows(bundle, new Set(region.memberIds));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/admin/regions/${region.id}`}
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {region.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          Entities in {region.name}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {rows.length} entit{rows.length === 1 ? "y" : "ies"} placed in this
          region. Sorted by what needs work.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-sm">
          Nothing has been placed in {region.name} yet. Membership is asserted
          by a curator — Atlas will not guess it from coordinates.
        </p>
      ) : (
        <EntityPicker entities={rows} />
      )}
    </div>
  );
}
