import Link from "next/link";
import { Suspense } from "react";
import { Telescope } from "lucide-react";
import { ExplorerSearchBar } from "@/components/explorer/ExplorerSearchBar";

/**
 * The Atlas Explorer shell.
 *
 * A sibling of `/admin` rather than a page inside it, for two reasons worth
 * writing down. The admin layout mounts the Learning Tracer provider and a
 * fixed panel over everything, which is a curator's workbench concern and
 * noise here. And every page under `/admin` reads Atlas at a hardcoded
 * `localhost:3000`, so the whole area is dark whenever Atlas runs elsewhere —
 * this tool exists to be reliable during exactly the sessions when that is
 * true.
 *
 * Wider than the admin measure (1100px) because a dossier is two columns of
 * genuinely different things — the record on one side, the graph and its
 * evidence on the other — and squeezing them into one column is what turns
 * an instrument into a scroll.
 */
export default function ExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background min-h-screen">
      <div className="border-border/70 sticky top-0 z-10 border-b bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <Link
            href="/explorer"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold"
          >
            <Telescope className="h-4 w-4" />
            Atlas Explorer
          </Link>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            everything Atlas knows, unfiltered
          </span>
          <div className="ml-auto w-full sm:w-96">
            {/* `useSearchParams` needs a boundary, and the shell must not be
                what makes a dossier wait to render. */}
            <Suspense fallback={<div className="h-8" />}>
              <ExplorerSearchBar />
            </Suspense>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] px-6 py-8">{children}</div>
    </main>
  );
}
