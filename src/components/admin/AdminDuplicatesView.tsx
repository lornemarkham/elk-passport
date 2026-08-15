"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminNotConfiguredError,
  listDuplicateGroups,
  type DuplicateGroup,
  type DuplicateScanResult,
} from "@/lib/data/admin-repo";
import { AdminSetupNotice } from "./AdminSetupNotice";
import { ContentHealthSummary } from "./ContentHealthSummary";
import { DuplicateGroupCard } from "./DuplicateGroupCard";
import { DuplicateReviewEmptyState } from "./DuplicateReviewEmptyState";

type LoadState = "loading" | "ready" | "error" | "not-configured";

/**
 * IMP-007's admin surface: list what Atlas thinks are duplicate entities,
 * let a human compare and merge them. Deliberately client-fetched on
 * mount rather than server-rendered — this is a low-traffic internal tool,
 * not a page that needs to be fast on first paint, and it needs a working
 * "refresh" action regardless (see Goals in the IMP), so there's no real
 * benefit to a server-side first fetch the way Discovery/Boards have.
 */
export function AdminDuplicatesView({
  onChanged,
}: {
  /**
   * Called after a successful merge, so a host that renders counts from
   * the server can refresh them.
   *
   * Without this, `onMerged={load}` refreshed only this component's own
   * list — the Region workspace's duplicate badge kept its server-rendered
   * value and a curator saw "4 groups" after merging one. **A write that
   * updates one view and not another teaches a curator to distrust every
   * count on the page.**
   */
  onChanged?: () => void;
} = {}) {
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  /**
   * Bumping this re-runs the scan. The fetch lives inside the effect
   * rather than in a `load()` the effect calls, because the callback
   * version set state synchronously on the effect's own path — which
   * renders once with stale data and again with fresh, and which
   * `react-hooks/set-state-in-effect` correctly refused.
   *
   * This file had been held out of commits for that error. Fixing it
   * properly was cheaper than continuing to route around it.
   */
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const scan = await listDuplicateGroups();
        if (cancelled) return;
        // High-confidence groups first — those are the fast, safe reviews;
        // putting them ahead lets a curator clear the easy majority quickly
        // before slowing down for the medium-confidence ones that actually
        // need a careful read.
        const sorted = [...scan.groups].sort((a, b) =>
          a.confidence === b.confidence ? 0 : a.confidence === "high" ? -1 : 1,
        );
        setResult(scan);
        setGroups(sorted);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AdminNotConfiguredError) {
          setState("not-configured");
          return;
        }
        console.error("Failed to load duplicate groups:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load duplicate groups.",
        );
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (state === "not-configured") {
    return <AdminSetupNotice />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The "first screen of a product" moment — the state of your
          content before the list of things to do about it. Shown as soon
          as there's a result, including while a refresh is in flight, so
          it doesn't flicker away and back on every reload. */}
      {result && <ContentHealthSummary result={result} />}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {state === "ready" &&
            (groups.length === 0
              ? "Nothing needs your attention right now."
              : `${groups.length} group${groups.length === 1 ? "" : "s"} to review.`)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={state === "loading"}
        >
          <RefreshCw className={state === "loading" ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {state === "loading" && !result && (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Loading…
        </p>
      )}

      {state === "error" && (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">Couldn&apos;t load duplicate groups</p>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
        </div>
      )}

      {state === "ready" && groups.length === 0 && result && (
        <DuplicateReviewEmptyState result={result} />
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <DuplicateGroupCard
              key={`${group.kind}-${group.name}`}
              group={group}
              onMerged={() => {
                reload();
                onChanged?.();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
