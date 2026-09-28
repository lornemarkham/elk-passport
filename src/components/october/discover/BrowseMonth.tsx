"use client";

import { useState } from "react";
import type { DiscoveryUnit } from "@/domain/discovery/discoveryUnits";
import { BrowseRow } from "./cards";

/**
 * **Browse the month, opened a bit at a time.**
 *
 * Eighty-eight rows is the whole dated month at one visual weight, which is a
 * database dump wearing a heading — a reader scrolls it rather than reads it,
 * and the sections below it effectively disappear.
 *
 * So the lane opens with enough to be useful and says exactly how much more
 * there is. **Every unit stays reachable**: this hides nothing permanently,
 * adds no filter, no search and no pagination, and the closed state is only a
 * default.
 *
 * Deliberately not a new browsing application. One button, one piece of state.
 */
const FIRST = 24;

export interface BrowseRowData {
  readonly unit: DiscoveryUnit;
  /** Resolved on the server, which is the side that knows the window. */
  readonly day?: string;
}

export function BrowseMonth({
  rows,
}: {
  readonly rows: readonly BrowseRowData[];
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST);
  const rest = rows.length - shown.length;

  return (
    <>
      <div
        data-testid="browse-grid"
        className="grid grid-cols-1 gap-x-10 sm:grid-cols-2"
      >
        {shown.map(({ unit, day }) => (
          <BrowseRow key={unit.head.id} unit={unit} day={day} />
        ))}
      </div>
      {rest > 0 ? (
        <button
          type="button"
          data-testid="browse-show-all"
          onClick={() => setAll(true)}
          className="mt-6 min-h-11 cursor-pointer text-sm text-[#d09a4e]/90 underline-offset-4 transition-colors hover:text-[#d09a4e] hover:underline"
        >
          Show all {rows.length}
        </button>
      ) : null}
    </>
  );
}
