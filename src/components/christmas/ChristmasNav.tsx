"use client";

import { useEffect, useSyncExternalStore } from "react";
import { POP_KEY } from "./KeepScroll";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_KEY } from "./home";
import { cn } from "@/lib/utils";
import { SuggestSomething } from "@/components/contributions/SuggestSomething";

/**
 * **Christmas's own bar** — Discover · Advent · Lights Map · My Christmas
 * (owner brief M1154; M1128 named the first "Home"), and one deliberate way back to
 * Go Have a Day. It sits under the global header on every Christmas page, so
 * somebody who came for Christmas always knows where they are and how to get
 * home.
 *
 * - **Discover** is the one Christmas landing page — today, what's coming,
 *   the moods and every listing together — and comes back to the visitor's own last place,
 *   days, distance and categories (`HOME_KEY`, this tab only).
 * - **My Christmas** is everything the visitor kept: their list, their saved
 *   plans and adventures. Planning is reached from there and from the
 *   experiences themselves, not as a rival destination.
 *
 * It stays at the top of the screen (owner brief M1128: "difficult to
 * understand where you are and how to return home"), so Home is one tap
 * from anywhere on a long page — and leaving does not first mean scrolling
 * back up, which is also what lets Back return to the same spot.
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
    href: "/christmas",
    label: "Discover",
    id: "home",
    match: (p) =>
      p === "/christmas" ||
      [
        "/christmas/discover",
        "/christmas/for/",
        "/christmas/event/",
        "/christmas/surprise",
        "/christmas/movies",
      ].some((x) => p.startsWith(x)),
  },
  {
    href: "/christmas/advent",
    label: "Advent",
    id: "advent",
    match: (p) => p.startsWith("/christmas/advent"),
  },
  {
    href: "/christmas/lights",
    label: "Lights Map",
    id: "lights",
    match: (p) =>
      p === "/christmas/lights" || p.startsWith("/christmas/lights/"),
  },
  {
    href: "/christmas/list",
    label: "My Christmas",
    id: "list",
    match: (p) =>
      p.startsWith("/christmas/list") ||
      p.startsWith("/christmas/adventure") ||
      p.startsWith("/christmas/plan") ||
      p.startsWith("/christmas/itinerary"),
  },
];

const noSubscription = () => () => {};
function readHome(): string {
  try {
    return sessionStorage.getItem(HOME_KEY) ?? "";
  } catch {
    return ""; // private mode: Home is the plain landing page
  }
}

export function ChristmasNav() {
  const pathname = usePathname() ?? "";
  // Home goes back to this tab's last discovery — its place, days, distance
  // and categories. Read on every render (the bar re-renders as the path
  // changes); the server's link is the plain landing page.
  const saved = useSyncExternalStore(noSubscription, readHome, () => "");
  const home = `/christmas${saved}`;
  // Back and Forward are marked, so a page can put the visitor back where
  // they were (`KeepScroll`).
  useEffect(() => {
    const mark = () => {
      (window as unknown as Record<string, number>)[POP_KEY] = Date.now();
    };
    window.addEventListener("popstate", mark);
    return () => window.removeEventListener("popstate", mark);
  }, []);
  return (
    <nav
      aria-label="Christmas"
      data-testid="christmas-nav"
      className="sticky top-0 z-40 border-b border-black/10 bg-[#082319] text-white"
    >
      <ul className="mx-auto flex max-w-6xl items-center gap-x-1 overflow-x-auto px-3 sm:px-6">
        {DESTINATIONS.map((d) => {
          const current = d.match(pathname);
          return (
            <li key={d.id} className="shrink-0">
              <Link
                href={d.id === "home" ? home : d.href}
                aria-current={current ? "page" : undefined}
                data-testid={`xmas-nav-${d.id}`}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-1.5 text-[13px] font-semibold whitespace-nowrap min-[380px]:px-2 sm:px-3 sm:text-sm",
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
            label="+ Suggest"
            compact
            className="min-h-9 bg-[#ffd98a] px-2.5 text-[#082319] ring-0 sm:px-4"
          />
        </li>
        <li className="shrink-0">
          <Link
            href="/discovery"
            data-testid="xmas-nav-back"
            aria-label="Back to Go Have a Day"
            className="inline-flex min-h-11 items-center px-2 text-[13px] font-semibold whitespace-nowrap text-[#ffd98a] hover:underline sm:text-sm"
          >
            ←<span className="hidden sm:inline">&nbsp;Go Have a Day</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
