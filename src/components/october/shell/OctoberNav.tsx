"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

/**
 * **The four places October has.**
 *
 * October may become cinematic; this must not. The shell is the part a person
 * has to be able to trust, so it is plain type on a plain bar, it says where
 * you are, and it is in the same place on every October screen. Nothing here
 * animates, hides, or changes its mind.
 *
 * An experience is allowed to take the whole screen and leave this behind —
 * the Video Store and the Secret Room do exactly that, as fixed full-screen
 * layers over this bar, from `/october/store` and `/october/room`.
 * That is the distinction the shell exists to make legible: while you can see
 * this bar you are in the product, and when it goes you are somewhere else.
 */

const DESTINATIONS = [
  { href: "/october", label: "October", hint: "What matters now" },
  { href: "/october/discover", label: "Discover", hint: "What is out there" },
  { href: "/october/mine", label: "My October", hint: "What is mine" },
  { href: "/october/from", label: "From October", hint: "What it keeps" },
] as const;

/**
 * **Rooms that never had the bar, and still do not.**
 *
 * These were built, and are still meant to be met, as whole screens of their
 * own: For Bryan is a letter, the Sketchbook and the Discovery experiments
 * carry their own way out. They lived under `/labs/october`, outside this
 * shell, and moving them under `/october` is a change of address, not of
 * appearance — so the bar steps aside for them rather than appearing above a
 * page that was not designed to sit beneath it.
 */
const OWN_FRAME = [
  "/october/for-bryan",
  "/october/scariest-room",
  "/october/secret-room",
  "/october/sketchbook",
  "/october/discovery",
] as const;

export function OctoberNav({
  displayName,
  activePath = null,
}: {
  readonly displayName: string | null;
  /**
   * **The route this page really is**, when that is not the route the browser
   * is showing.
   *
   * `iamoctober.com/` is served by rewriting the root to `/october/discover`
   * without changing the URL, which is deliberate — but it means
   * `usePathname()` reports `/` and the bar highlighted nothing. The layout
   * passes the rewritten path through when there is one. `null` everywhere
   * else, including Passport's own `/`, which must keep highlighting nothing.
   */
  readonly activePath?: string | null;
}) {
  const browserPath = usePathname() ?? "";
  const pathname = activePath ?? browserPath;

  /** `/october` only matches itself; the others own everything beneath them. */
  const isHere = (href: string) =>
    href === "/october" ? pathname === "/october" : pathname.startsWith(href);

  // **Both of these used to throw away where you were.** Signing in from
  // anywhere in October returned you to `/october`, and tapping your own name
  // landed you in `/account` — a cream Passport page whose only way out is
  // Passport's Discovery. Carrying the current path means auth comes back
  // here, and the account page can offer October as the way back.
  const from = encodeURIComponent(pathname || "/october");

  // **The bar is wider than a phone.** Its five items need about 505px, so on
  // every phone it scrolls sideways — and it opened at the left, which left
  // the tab for the page you were on cut off (or out of sight) on
  // `/october/from`. It still scrolls; it now opens with where you are showing,
  // moving only as far as it takes, and never touching the page's own scroll.
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = bar.current;
    const here = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !here) return;
    const over =
      here.getBoundingClientRect().right - nav.getBoundingClientRect().right;
    if (over > 0) nav.scrollLeft += over + 16;
  }, [pathname]);

  if (
    OWN_FRAME.some((r) => browserPath === r || browserPath.startsWith(`${r}/`))
  )
    return null;

  return (
    <header className="border-b border-[#e9e6da]/10">
      <nav
        ref={bar}
        aria-label="October"
        className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 sm:px-6"
      >
        {DESTINATIONS.map((d) => {
          const here = isHere(d.href);
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={here ? "page" : undefined}
              data-testid={`october-nav-${d.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`-mb-px inline-flex min-h-12 shrink-0 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors ${
                here
                  ? "border-[#d09a4e] text-[#f3efe4]"
                  : "border-transparent text-[#e9e6da]/50 hover:text-[#e9e6da]/80"
              }`}
            >
              {d.label}
            </Link>
          );
        })}

        <span className="flex-1" />

        {displayName ? (
          <Link
            href={`/account?next=${from}`}
            data-testid="october-account"
            className="inline-flex min-h-12 shrink-0 items-center px-3 text-sm text-[#e9e6da]/50 transition-colors hover:text-[#e9e6da]/80"
          >
            {displayName}
          </Link>
        ) : (
          <Link
            href={`/auth?next=${from}`}
            data-testid="october-sign-in"
            className="inline-flex min-h-12 shrink-0 items-center px-3 text-sm text-[#d09a4e] transition-colors hover:text-[#e0b06a]"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
