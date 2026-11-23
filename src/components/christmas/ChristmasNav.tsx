"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SuggestSomething } from "@/components/contributions/SuggestSomething";

/**
 * **Christmas's own bar** — Discover · Lights Map · My Christmas List · Plan
 * My Route, and one deliberate way back to Go Have a Day. It sits under the
 * global header on every Christmas page, so somebody who came for Christmas
 * stays among Christmas things.
 *
 * The global bar's generic Discover / My Stuff / Build a Day still sits above
 * it: hiding those inside `/christmas` is a change to the shell's shared
 * contract, proposed in `docs/product/christmas/proposals/shell-nav.patch`
 * rather than made from this lane.
 */
const DESTINATIONS: readonly {
  readonly href: string;
  readonly label: string;
  readonly id: string;
  readonly match: (pathname: string) => boolean;
}[] = [
  {
    href: "/christmas/discover",
    label: "Discover",
    id: "discover",
    match: (p) => p === "/christmas" || p.startsWith("/christmas/discover"),
  },
  {
    href: "/christmas/lights",
    label: "Lights Map",
    id: "lights",
    match: (p) =>
      (p === "/christmas/lights" || p.startsWith("/christmas/lights/")) &&
      !p.startsWith("/christmas/lights/tour"),
  },
  {
    href: "/christmas/list",
    label: "My Christmas List",
    id: "list",
    match: (p) =>
      p.startsWith("/christmas/list") || p.startsWith("/christmas/adventure"),
  },
  {
    href: "/christmas/plan",
    label: "Plan My Route",
    id: "plan",
    match: (p) =>
      p.startsWith("/christmas/plan") ||
      p.startsWith("/christmas/itinerary") ||
      p.startsWith("/christmas/lights/tour"),
  },
];

export function ChristmasNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Christmas"
      data-testid="christmas-nav"
      className="border-b border-black/10 bg-[#082319] text-white"
    >
      <ul className="mx-auto flex max-w-6xl items-center gap-x-1 overflow-x-auto px-3 sm:px-6">
        {DESTINATIONS.map((d) => {
          const current = d.match(pathname);
          return (
            <li key={d.id} className="shrink-0">
              <Link
                href={d.href}
                aria-current={current ? "page" : undefined}
                data-testid={`xmas-nav-${d.id}`}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-2 text-[13px] font-semibold whitespace-nowrap sm:px-3 sm:text-sm",
                  current
                    ? "border-[#ffd98a] text-white"
                    : "border-transparent text-white/70 hover:text-white",
                )}
              >
                {d.label}
              </Link>
            </li>
          );
        })}
        <li className="ml-auto shrink-0 py-1">
          {/* The universal suggestion sheet (mission 1005), worded for
              Christmas: markets, pubs, events, displays — anything missing. */}
          <SuggestSomething
            experience="christmas"
            label="+ Suggest a Stop"
            compact
            className="min-h-9 bg-[#ffd98a] text-[#082319] ring-0"
          />
        </li>
        <li className="shrink-0">
          <Link
            href="/discovery"
            data-testid="xmas-nav-back"
            className="inline-flex min-h-11 items-center px-2 text-[13px] font-semibold whitespace-nowrap text-[#ffd98a] hover:underline sm:text-sm"
          >
            ← Go Have a Day
          </Link>
        </li>
      </ul>
    </nav>
  );
}
