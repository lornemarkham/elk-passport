"use client";

import { useSyncExternalStore } from "react";
import {
  destinationFor,
  preferredOrder,
  walkingLinks,
  type MapLink,
} from "@/domain/hockey/directions";

const noChange = () => () => {};

/**
 * **Walking directions in the map app the person already trusts** — Hockey
 * Night's `directions.ts`, unchanged: Passport hands the two ends to Google
 * or Apple Maps and routes nothing itself. Apple first on an iPhone.
 */
export function Directions({
  name,
  at,
  compact = false,
}: {
  name: string;
  at: readonly [number, number];
  compact?: boolean;
}) {
  // The phone's own browser decides the order; the server renders Google first.
  const agent = useSyncExternalStore(
    noChange,
    () => navigator.userAgent,
    () => "",
  );
  const links: MapLink[] = preferredOrder(
    walkingLinks(destinationFor({ name, at }, undefined)),
    agent,
  );
  return (
    <span className="flex flex-wrap gap-2">
      {(compact ? links.slice(0, 1) : links).map((l) => (
        <a
          key={l.app}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="border-cf-line text-cf-ink hover:border-cf-ink/30 inline-flex min-h-10 items-center rounded-full border bg-white px-4 text-[13px] font-semibold transition"
          aria-label={`Directions to ${name} in ${l.label}`}
        >
          {compact ? "Directions" : l.label}
        </a>
      ))}
    </span>
  );
}
