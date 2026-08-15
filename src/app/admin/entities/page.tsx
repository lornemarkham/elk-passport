import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  EntityPicker,
  type PickerEntity,
} from "@/components/admin/entities/EntityPicker";
import { AdminSetupNotice } from "@/components/admin/AdminSetupNotice";
import { buildEntityRows } from "@/lib/knowledge/entityRows";
import {
  loadWorkspaceBundle,
  WorkspaceNotConfiguredError,
  WorkspaceUnreachableError,
} from "@/lib/knowledge/workspaceData";

export const metadata: Metadata = {
  title: "All entities — Atlas",
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

  // `buildEntityRows` with no scope — every entity Atlas holds. This page
  // had its own inline copy of that mapping, which is the drift
  // `entityRows.ts` was extracted to prevent, and it duly drifted: the
  // region list gained a "contains" count and this one silently did not.
  // One mapping, two scopes.
  const picker: PickerEntity[] = buildEntityRows(bundle);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Atlas
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">All entities</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Everything Atlas holds, whether or not a region has claimed it. To
          work a destination instead, start from Regions.
        </p>
      </div>

      <EntityPicker entities={picker} />
    </div>
  );
}
