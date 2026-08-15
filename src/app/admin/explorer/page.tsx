import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { ContentExplorerView } from "@/components/admin/ContentExplorerView";

export const metadata: Metadata = {
  title: "Content Explorer — Atlas Curator Workbench",
};

// Atlas's own inspection tool — see what it actually knows (entities,
// their fields, source provenance, relationships) before or instead of
// the four-separate-curl-calls review this replaces. Not the traveler
// experience; nothing here is meant for Discovery.
//
// Sprint 2: `ContentExplorerView` reads `?entityId=` (via `useSearchParams`)
// to auto-select an entity on load — the Curator Queue's "Open in Content
// Explorer" links land directly on the flagged entity instead of a bare
// list. `useSearchParams` requires a Suspense boundary around whatever
// reads it; this page had none of its own dynamic data, so adding one here
// is the entire cost of that.
export default function ContentExplorerPage() {
  return (
    <>
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Atlas Curator Workbench
      </Link>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        Content Explorer
      </h1>
      <p className="text-muted-foreground mb-8 max-w-xl text-sm">
        Every entity Atlas knows about, its fields, where each came from, and
        what it&apos;s connected to. Built for reviewing ingestion batches fast,
        not for travelers.
      </p>
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
      >
        <ContentExplorerView />
      </Suspense>
    </>
  );
}
