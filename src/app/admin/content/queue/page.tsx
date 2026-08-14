import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CuratorQueueView } from "@/components/admin/CuratorQueueView";

export const metadata: Metadata = {
  title: "Curator Queue — Atlas Curator Workbench",
};

// Sprint 1, Knowledge Operations — same page-shell pattern as
// /admin/content/duplicates: a thin wrapper, all the real logic lives in
// the view component.
export default function CuratorQueuePage() {
  return (
    <>
      <Link
        href="/admin/content"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Atlas Curator Workbench
      </Link>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Curator Queue</h1>
      <p className="text-muted-foreground mb-8 max-w-xl text-sm">
        Every entity Atlas knows about, ranked by Completeness Score, worst
        first — each with the real, specific traveler questions its own missing
        fields imply. Nothing here is invented; every question traces back to a
        real field on the real entity.
      </p>
      <CuratorQueueView />
    </>
  );
}
