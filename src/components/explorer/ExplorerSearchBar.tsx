"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * The one input in the whole tool.
 *
 * A plain form that navigates — no debounce, no live query, no client-side
 * result cache. Every search is a server render against the live corpus,
 * which is what makes a result trustworthy in an inspection tool: what is on
 * screen is what Atlas holds right now, not what it held when a cache was
 * warmed.
 *
 * Uncontrolled, and keyed on the current query. The box has to show what was
 * actually searched after landing on the results, and has to reset when you
 * follow a related entity out of a search — but a `useState` mirroring the
 * URL means an effect writing state on every navigation, which is both a lint
 * error and a real extra render. `key` says the same thing to React directly:
 * a different query is a different box.
 */
export function ExplorerSearchBar() {
  const router = useRouter();
  const current = useSearchParams().get("q") ?? "";

  return (
    <form
      key={current}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = new FormData(event.currentTarget).get("q");
        const trimmed = typeof query === "string" ? query.trim() : "";
        router.push(
          trimmed ? `/explorer?q=${encodeURIComponent(trimmed)}` : "/explorer",
        );
      }}
      className="relative"
    >
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
      <input
        type="search"
        name="q"
        defaultValue={current}
        placeholder="Search every entity, alias and id…"
        aria-label="Search Atlas"
        className="border-border/70 bg-background focus:ring-ring/40 h-8 w-full rounded-md border pr-2 pl-8 text-sm outline-none focus:ring-2"
      />
    </form>
  );
}
