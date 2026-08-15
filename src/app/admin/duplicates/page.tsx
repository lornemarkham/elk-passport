import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminDuplicatesView } from "@/components/admin/AdminDuplicatesView";

export const metadata: Metadata = {
  title: "Duplicate Review — Atlas Curator Workbench",
};

// IMP-007 v1: functional, not polished — a content curator's tool for
// resolving Atlas duplicates before more ingestion sources make them
// routine, not a traveler-facing surface or a developer debugging screen.
// The Duplicate Review feature itself (AdminDuplicatesView and below) is
// unchanged here — only the page shell now knows it's the second step,
// reached from the Content Operations overview rather than being the
// landing page.
export default function AdminDuplicatesPage() {
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
        Duplicate Review
      </h1>
      <p className="text-muted-foreground mb-8 max-w-xl text-sm">
        Entries that look like they describe the same real place, organization,
        activity, or event. Review the evidence, pick which one to keep, and
        merge — nothing is ever deleted, only combined.
      </p>
      <AdminDuplicatesView />
    </>
  );
}
