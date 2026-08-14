"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitMerge,
  Inbox,
  Gauge,
  MapPinned,
  Clock,
  GitCompare,
  Search,
  ListChecks,
  Layers,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AdminNotConfiguredError,
  AtlasUnreachableError,
  getContentHealth,
  listDuplicateGroups,
  type ContentHealthResult,
  type DuplicateScanResult,
} from "@/lib/data/admin-repo";
import { AdminSetupNotice } from "./AdminSetupNotice";
import { ContentHealthSummary } from "./ContentHealthSummary";
import { KnowledgeHealthPanel } from "./KnowledgeHealthPanel";

type LoadState =
  "loading" | "ready" | "error" | "unreachable" | "not-configured";

interface OperationDef {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

// The full list of operations this center is meant to grow into (see
// IMP-007's Content Operations Center direction). Only Duplicate Review is
// real today — the rest are named honestly as not-yet-built, not hidden
// and not faked with invented counts. Adding a real one later means moving
// its key out of FUTURE_OPERATIONS and into a live status card, not
// redesigning this page.
const FUTURE_OPERATIONS: OperationDef[] = [
  {
    key: "new-entities",
    title: "New entities awaiting review",
    description: "Recently ingested content that hasn't been reviewed yet.",
    icon: Inbox,
  },
  {
    key: "low-confidence",
    title: "Low-confidence extractions",
    description: "Content the AI extracted with low certainty.",
    icon: Gauge,
  },
  {
    key: "needs-verification",
    title: "Needs local verification",
    description: "Content worth confirming against a real, local source.",
    icon: MapPinned,
  },
  {
    key: "freshness",
    title: "Content freshness",
    description: "Entries that haven't been checked in a while.",
    icon: Clock,
  },
  {
    key: "conflicts",
    title: "Conflicting source information",
    description: "Entries where two sources disagree on the facts.",
    icon: GitCompare,
  },
];

/**
 * The front door of Atlas's curator workbench — a curator lands here
 * first, sees the state of Atlas's knowledge, and picks what to work on.
 * Duplicate Review and the Content Explorer are launched from here, not
 * reached directly; this page owns that entry point instead of it living
 * implicitly at whatever URL happened to be typed in.
 *
 * The filter for anything added here going forward: does it help Atlas's
 * knowledge grow faster or with higher quality? Not "does it serve
 * Passport" — this is hosted inside Passport's app for practical reasons
 * (the UI kit and auth pattern already exist here), it isn't a Passport
 * feature.
 */
export function ContentOperationsOverview() {
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [contentHealth, setContentHealth] =
    useState<ContentHealthResult | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  // Sprint 2 Refinement — see CuratorQueueView's own comment on this same
  // field: bumping it re-triggers the fetch, both for an automatic single
  // retry after a real observed cold-start failure and for a manual "Try
  // again."
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((prev) => (prev === "ready" ? prev : "loading"));
      try {
        // Two independent admin reads, fetched together — neither depends
        // on the other, and a failure in one (e.g. content-health erroring)
        // shouldn't be allowed to take down the duplicate-review card that
        // already works. `allSettled`, not `all`.
        const [scanResult, healthResult] = await Promise.allSettled([
          listDuplicateGroups(),
          getContentHealth(),
        ]);
        if (cancelled) return;

        if (scanResult.status === "fulfilled") {
          setResult(scanResult.value);
        } else if (scanResult.reason instanceof AdminNotConfiguredError) {
          setState("not-configured");
          return;
        } else if (scanResult.reason instanceof AtlasUnreachableError) {
          console.warn(
            "Atlas not reachable yet (likely still starting up):",
            scanResult.reason.message,
          );
          setState("unreachable");
          return;
        } else {
          console.error("Failed to load duplicate scan:", scanResult.reason);
        }

        if (healthResult.status === "fulfilled") {
          setContentHealth(healthResult.value);
        } else {
          console.error("Failed to load content health:", healthResult.reason);
        }

        setState(scanResult.status === "fulfilled" ? "ready" : "error");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AdminNotConfiguredError) {
          setState("not-configured");
          return;
        }
        console.error("Failed to load content operations overview:", err);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  // One automatic retry a couple of seconds after a real "Atlas isn't
  // ready yet" failure — see CuratorQueueView for the same real, observed
  // cold-start case this resolves without a curator needing to reload.
  useEffect(() => {
    if (state !== "unreachable") return;
    const timeout = window.setTimeout(() => setRetryNonce((n) => n + 1), 2500);
    return () => window.clearTimeout(timeout);
  }, [state]);

  if (state === "not-configured") {
    return <AdminSetupNotice />;
  }

  if (state === "unreachable") {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center">
        <p className="font-medium">Atlas isn&apos;t responding yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          This usually means Atlas&apos;s own server is still starting up.
          Retrying automatically…
        </p>
        <button
          type="button"
          onClick={() => setRetryNonce((n) => n + 1)}
          className="text-primary mt-3 text-sm underline underline-offset-2"
        >
          Try again now
        </button>
      </div>
    );
  }

  const duplicateCount = result?.groups.length ?? null;
  const duplicateStatus =
    state === "loading"
      ? "Checking…"
      : state === "error"
        ? "Couldn't check"
        : duplicateCount === 0
          ? "All clear"
          : `${duplicateCount} group${duplicateCount === 1 ? "" : "s"} need review`;
  const duplicateNeedsAttention =
    state === "ready" && (duplicateCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      {contentHealth && <KnowledgeHealthPanel contentHealth={contentHealth} />}
      {result && <ContentHealthSummary result={result} />}

      {state === "error" && !result && (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="font-medium">Couldn&apos;t load the content overview</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Something went wrong reaching Atlas. Please try again in a moment.
          </p>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-medium">Operations</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/admin/content/duplicates">
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardContent className="flex items-start gap-3 py-4">
                <GitMerge className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Duplicate Review</p>
                    <Badge
                      variant="outline"
                      className={
                        duplicateNeedsAttention
                          ? "border-amber-500 text-amber-700 dark:text-amber-400"
                          : "border-green-600 text-green-700 dark:text-green-400"
                      }
                    >
                      {duplicateStatus}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Entries that look like the same real place, organization,
                    activity, or event.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/ingestion">
            <Card className="border-foreground/25 hover:border-primary/40 h-full transition-colors">
              <CardContent className="flex items-start gap-3 py-4">
                <Activity className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Ingestion Observatory</p>
                    <span className="border-foreground/25 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                      new
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Watch Atlas learn — every run, what it read, what it
                    created, and what still needs a human.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/workspace">
            <Card className="border-foreground/25 hover:border-primary/40 h-full transition-colors">
              <CardContent className="flex items-start gap-3 py-4">
                <Layers className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Entity Workspace</p>
                    <span className="border-foreground/25 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                      new
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Everything Atlas knows about an entity, where it came from,
                    and what the traveler page actually uses.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/content/explorer">
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardContent className="flex items-start gap-3 py-4">
                <Search className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Content Explorer</p>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    The original field-level inspector. Kept for batch review
                    until the Workspace covers it.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/content/queue">
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardContent className="flex items-start gap-3 py-4">
                <ListChecks className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Curator Queue</p>
                    <Badge variant="outline">
                      {contentHealth
                        ? `${contentHealth.scores.length} scored`
                        : "Checking…"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Every entity, ranked by Completeness Score, with real,
                    specific gaps to close next.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {FUTURE_OPERATIONS.map((operation) => (
            <Card key={operation.key} className="h-full opacity-60">
              <CardContent className="flex items-start gap-3 py-4">
                <operation.icon className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{operation.title}</p>
                    <Badge variant="secondary">Coming soon</Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {operation.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
