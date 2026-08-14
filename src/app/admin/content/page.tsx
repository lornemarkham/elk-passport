import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContentOperationsOverview } from "@/components/admin/ContentOperationsOverview";

export const metadata: Metadata = {
  title: "Atlas Curator Workbench",
};

// Atlas's curator workbench — hosted inside Passport's app for practical
// reasons (the UI kit, auth pattern, and routing already exist here; none
// of that exists in Atlas's own plain Node server), not because this is
// conceptually a Passport feature. Every capability added under
// admin/content should answer "does this help Atlas's knowledge grow
// faster and with higher quality" — not "does this serve Passport."
// Duplicate Review and the Content Explorer are launched from here, not
// reached directly.
export default function ContentOperationsPage() {
  return (
    <>
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Passport
      </Link>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        Atlas Curator Workbench
      </h1>
      <p className="text-muted-foreground mb-8 max-w-xl text-sm">
        The state of Atlas&apos;s knowledge, and what would grow it fastest
        right now.
      </p>
      <ContentOperationsOverview />
    </>
  );
}
