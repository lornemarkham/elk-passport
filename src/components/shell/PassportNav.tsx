"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * **Passport's own bar. There wasn't one.**
 *
 * Walked the deployed product before writing this:
 *
 * ```
 * /            no header, no nav, two links, no sign-in
 * /places      a header of its own, no nav
 * /discovery   a header of its own, and a nav that switches modes
 * /boards      no header, no nav, ZERO links — a dead end
 * /account     no header, no nav, ZERO links — a dead end
 * /october     a real bar, on every October screen
 * ```
 *
 * October had a shell and Passport did not, which is why Passport read as a
 * good Discovery page sitting inside unfinished chrome: you could arrive at
 * your own boards and have no way back to anything, and nothing on any screen
 * told you what the product was or where you were in it.
 *
 * This is the same shape as `OctoberNav` and deliberately so — a bar a person
 * can trust is plain type that says where you are and stays in one place. It
 * is not a new product area: every destination here is a finished route that
 * already existed and was simply unreachable.
 *
 * ## What is deliberately not on it
 *
 * Inspiration, the planner, LIVE, Experiences-as-a-concept. The doctrine
 * fences those off (§13, §14), and a nav is the loudest possible place to
 * promise something that does not exist — which is exactly what the greyed-out
 * `Map` and `AI` tabs were doing on Discovery for months before they were
 * removed. October is reachable from Discovery's own door, not from here,
 * because an Experience is not a Passport section (§10, still open).
 */

const DESTINATIONS = [
  { href: "/discovery", label: "Discover" },
  { href: "/places", label: "Places" },
  // **Saved means what somebody saved, not the index of their boards.** This
  // pointed at `/boards`, which is the administration screen the owner's
  // route through Discovery → My Places → Back to Boards → Your Boards came
  // out of. `/boards` is still there for anybody who goes looking for it.
  {
    href: "/saved",
    label: "Saved",
    /**
     * A board **is** a saved collection, so somebody looking at one is in this
     * section even though the link points elsewhere. Without this, opening a
     * board unlit the only nav item that described where they were.
     */
    also: ["/boards"],
  },
] as const;

export function PassportNav({
  displayName = null,
}: {
  /** The signed-in person's name, or `null` for a visitor. */
  readonly displayName?: string | null;
}) {
  const pathname = usePathname() ?? "";
  const inside = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const here = (destination: { href: string; also?: readonly string[] }) =>
    inside(destination.href) || (destination.also ?? []).some(inside);
  const from = encodeURIComponent(pathname || "/discovery");

  return (
    <header className="border-b border-[#8a5a24]/15">
      <nav
        aria-label="Passport"
        className="mx-auto flex max-w-6xl items-center gap-1 px-4 sm:px-6"
      >
        {/* The wordmark is the way home, which is the one navigation
            convention it is safe to assume everybody already knows. */}
        <Link
          href="/"
          data-testid="passport-home"
          className="font-heading mr-2 inline-flex min-h-12 shrink-0 items-center text-sm font-semibold tracking-tight text-[#2b2015]"
        >
          Passport
        </Link>

        {DESTINATIONS.map((d) => {
          const current = here(d);
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={current ? "page" : undefined}
              data-testid={`passport-nav-${d.label.toLowerCase()}`}
              className={`-mb-px inline-flex min-h-12 shrink-0 items-center border-b-2 px-2.5 text-sm whitespace-nowrap transition-colors sm:px-3 ${
                current
                  ? "border-[#8a5a24] text-[#2b2015]"
                  : "border-transparent text-[#2b2015]/55 hover:text-[#2b2015]/85"
              }`}
            >
              {d.label}
            </Link>
          );
        })}

        <span className="flex-1" />

        {/* Carries where you are, so auth and the account page can bring you
            back — the same fix October's bar already had. */}
        {displayName ? (
          <Link
            href={`/account?next=${from}`}
            data-testid="passport-account"
            className="inline-flex min-h-12 shrink-0 items-center px-2.5 text-sm text-[#2b2015]/55 transition-colors hover:text-[#2b2015]/85 sm:px-3"
          >
            {displayName}
          </Link>
        ) : (
          <Link
            href={`/auth?next=${from}`}
            data-testid="passport-sign-in"
            className="inline-flex min-h-12 shrink-0 items-center px-2.5 text-sm font-medium text-[#8a5a24] transition-colors hover:text-[#6b4419] sm:px-3"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
