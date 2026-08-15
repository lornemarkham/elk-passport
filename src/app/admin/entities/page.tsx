import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  EntityPicker,
  type PickerEntity,
} from "@/components/admin/entities/EntityPicker";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";
import {
  loadWorkspaceBundle,
  WorkspaceNotConfiguredError,
  WorkspaceUnreachableError,
} from "@/lib/knowledge/workspaceData";

export const metadata: Metadata = {
  title: "Entity Workspace — Atlas Curator Workbench",
};

export default async function WorkspaceIndexPage() {
  let bundle;
  try {
    bundle = await loadWorkspaceBundle();
  } catch (error) {
    if (error instanceof WorkspaceNotConfiguredError)
      return <AdminSetupNotice />;
    if (error instanceof WorkspaceUnreachableError) {
      return (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-sm">
          {(error as Error).message}
        </p>
      );
    }
    throw error;
  }

  const { entities, sources, relationships, scores } = bundle;
  const scoreById = new Map(scores.map((s) => [s.entityId, s.overallPercent]));

  const sourceCountById = new Map<string, number>();
  const sourceIds = new Set(sources.map((s) => s.id));
  for (const r of relationships) {
    if (r.type !== "describes" || !sourceIds.has(r.sourceEntityId)) continue;
    sourceCountById.set(
      r.targetEntityId,
      (sourceCountById.get(r.targetEntityId) ?? 0) + 1,
    );
  }

  const picker: PickerEntity[] = entities.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    subtype:
      (e.placeType as string) ??
      (e.organizationType as string) ??
      (e.activityType as string) ??
      (e.eventType as string),
    score: scoreById.get(e.id) ?? null,
    sourceCount: sourceCountById.get(e.id) ?? 0,
    hasImage: Boolean(e.imageUrl),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Curator Workbench
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Entity Workspace</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Everything Atlas knows about an entity, where it came from, and what
          the traveler page actually does with it. Pick an entity to begin.
        </p>
      </div>

      <EntityPicker entities={picker} />
    </div>
  );
}
