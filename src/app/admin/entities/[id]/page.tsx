import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadWorkspaceBundle } from "@/lib/knowledge/workspaceData";
import {
  buildEntityKnowledgeView,
  entityProfile,
  type RelatedEntity,
} from "@/lib/knowledge/entityKnowledgeView";
import { resolveTemplate } from "@/lib/knowledge/entityTemplates";
import {
  loadComposition,
  resolveComposition,
  visibleSections,
} from "@/lib/passport/composition";
import { BaselineEntityTemplate } from "@/components/admin/entities/BaselineEntityTemplate";
import {
  loadMissionsForEntity,
  loadResearchTopics,
} from "@/lib/knowledge/researchMissions";
import { loadRegions, regionForEntity } from "@/lib/knowledge/regions";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Entity Workspace — ${id.slice(0, 8)}` };
}

/**
 * The Entity Workspace route.
 *
 * Deliberately thin: it loads, it resolves a template, it renders. Every
 * decision about *what* to show lives in `buildEntityKnowledgeView`, and
 * every decision about *how* lives in the template — so this file never
 * needs to change when either does, and a second template will not turn it
 * into a switch statement.
 */
export default async function EntityWorkspacePage({ params }: Props) {
  const { id } = await params;

  const bundle = await loadWorkspaceBundle().catch(() => null);
  if (!bundle) return <AdminSetupNotice />;

  const entities = (bundle.entities ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const entity = entities.find((e) => e.id === id);
  if (!entity) notFound();

  // Direction is carried through, not discarded. A `contains` edge read from
  // the wrong end says the resort is part of the restaurant inside it.
  const related = (bundle.relationships ?? [])
    .filter((r) => r.sourceEntityId === id || r.targetEntityId === id)
    .filter((r) => r.type !== "describes")
    .map((r): RelatedEntity | null => {
      const outgoing = r.sourceEntityId === id;
      const other = entities.find(
        (e) => e.id === (outgoing ? r.targetEntityId : r.sourceEntityId),
      );
      return other && other.kind !== "SourceRecord"
        ? {
            id: String(other.id),
            name: String(other.name),
            kind: String(other.kind),
            relationship: r.type,
            direction: outgoing ? "outgoing" : "incoming",
          }
        : null;
    })
    .filter((r): r is RelatedEntity => r !== null);

  const describedBy = new Set(
    (bundle.relationships ?? [])
      .filter((r) => r.type === "describes" && r.targetEntityId === id)
      .map((r) => r.sourceEntityId),
  );
  const sources = (bundle.sources ?? [])
    .filter((s) => describedBy.has(s.id))
    .map((s) => ({
      id: s.id,
      sourceType: s.sourceType,
      url: s.source,
      retrievedAt: s.retrievedAt,
    }));

  const saved = await loadComposition(id);
  const composition = resolveComposition(id, String(entity.kind), saved);

  const view = buildEntityKnowledgeView({
    entity,
    related,
    sources,
    visibleSections: visibleSections(composition),
    status: composition.status,
  });

  // Missions degrade to [] when Atlas is unreachable — an optional panel
  // must never blank the page whose whole job is showing what Atlas knows.
  const [missions, researchTopics, regionsResult] = await Promise.all([
    loadMissionsForEntity(id),
    loadResearchTopics(),
    loadRegions(),
  ]);

  // The last link in Atlas → Region → Entities → Entity. Absent when no
  // region has claimed this entity, which is currently most of them and is
  // said plainly rather than papered over.
  const region = regionForEntity(regionsResult, id);

  // One template today. The seam exists so that stays a one-line change.
  const template = resolveTemplate(entityProfile(entity));

  return (
    <div className="flex flex-col gap-8">
      <Link
        // Back to the region itself, not to a list *of* the region. The
        // intermediate entities page is gone (ADR 028) and the breadcrumb
        // is now literally true: Atlas → Okanagan → Big White.
        href={region ? `/admin/regions/${region.id}` : "/admin/entities"}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        {region ? region.name : "All entities"}
      </Link>

      {template === "baseline" && (
        <BaselineEntityTemplate
          view={view}
          missions={missions}
          researchTopics={researchTopics}
        />
      )}
    </div>
  );
}
