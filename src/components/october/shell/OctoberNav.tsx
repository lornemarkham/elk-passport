"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * **The three places October has.**
 *
 * October may become cinematic; this must not. The shell is the part a person
 * has to be able to trust, so it is plain type on a plain bar, it says where
 * you are, and it is in the same place on every October screen. Nothing here
 * animates, hides, or changes its mind.
 *
 * An experience is allowed to take the whole screen and leave this behind —
 * the Video Store does exactly that, from its own route outside `/october`.
 * That is the distinction the shell exists to make legible: while you can see
 * this bar you are in the product, and when it goes you are somewhere else.
 */

const DESTINATIONS = [
  { href: "/october", label: "October", hint: "What matters now" },
  { href: "/october/discover", label: "Discover", hint: "What is out there" },
  { href: "/october/mine", label: "My October", hint: "What is mine" },
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

  return (
    <header className="border-b border-[#e9e6da]/10">
      <nav
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
            href="/account"
            data-testid="october-account"
            className="inline-flex min-h-12 shrink-0 items-center px-3 text-sm text-[#e9e6da]/50 transition-colors hover:text-[#e9e6da]/80"
          >
            {displayName}
          </Link>
        ) : (
          <Link
            href="/auth?next=/october"
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
