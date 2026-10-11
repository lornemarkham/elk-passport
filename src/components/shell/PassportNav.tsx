"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemePicker, ThemeProvider } from "@/components/ghad/theme";
import { Wordmark } from "@/components/ghad/Wordmark";

/**
 * **The bar, in the product's own identity.**
 *
 * Walked the deployed product before this existed:
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
 * It is still that bar — plain type that says where you are and stays in one
 * place — now wearing the consumer identity: white ground, near-black type,
 * and the accent on exactly one thing, which is where you are.
 *
 * ## Why the wordmark changed and the repository did not
 *
 * This bar said **Passport**, which is the name of the software. GO HAVE A DAY
 * is the name of the product, so it is what a person reads. Nothing else is
 * renamed; see `Wordmark`.
 *
 * ## Why the theme picker lives here
 *
 * It is one choice that applies to every screen, so it belongs on the one
 * component every screen already has — rather than on Discovery, where it
 * would have looked like a property of Discovery.
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
    <ThemeProvider>
      <header className="border-b border-black/10 bg-white">
        <nav
          aria-label="Go Have A Day"
          className="mx-auto flex max-w-6xl items-center gap-1 px-4 sm:px-6"
        >
          {/* The wordmark is the way home, which is the one navigation
              convention it is safe to assume everybody already knows. */}
          <span className="mr-4 inline-flex min-h-12 shrink-0 items-center">
            <Wordmark href="/" lines={1} />
          </span>

          {DESTINATIONS.map((d) => {
            const current = here(d);
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={current ? "page" : undefined}
                data-testid={`passport-nav-${d.label.toLowerCase()}`}
                style={
                  current ? { borderColor: "var(--ghad-accent)" } : undefined
                }
                className={`-mb-px inline-flex min-h-12 shrink-0 items-center border-b-2 px-2.5 text-[14px] font-semibold whitespace-nowrap transition-colors sm:px-3 ${
                  current
                    ? "text-[#111]"
                    : "border-transparent text-black/45 hover:text-black/80"
                }`}
              >
                {d.label}
              </Link>
            );
          })}

          <span className="flex-1" />

          <ThemePicker className="mr-1 shrink-0 sm:mr-2" />

          {/* Carries where you are, so auth and the account page can bring you
              back — the same fix October's bar already had. */}
          {displayName ? (
            <Link
              href={`/account?next=${from}`}
              data-testid="passport-account"
              className="inline-flex min-h-12 shrink-0 items-center px-2.5 text-[14px] text-black/45 transition-colors hover:text-black/80 sm:px-3"
            >
              {displayName}
            </Link>
          ) : (
            <Link
              href={`/auth?next=${from}`}
              data-testid="passport-sign-in"
              style={{ color: "var(--ghad-accent)" }}
              className="inline-flex min-h-12 shrink-0 items-center px-2.5 text-[14px] font-semibold sm:px-3"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>
    </ThemeProvider>
  );
}
