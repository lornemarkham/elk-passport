"use client";

import Link from "next/link";

/**
 * The link into a quick experience, as a client component.
 *
 * It needs `stopPropagation` — the card underneath is one big overlay link to
 * the detail page, and without it pressing "why you'd stand outside for this"
 * navigates to exactly the reference page it is offering an alternative to.
 * An event handler cannot cross the server boundary, so this cannot live in
 * the server-side helper that decides whether to render it.
 */
export function QuickEntry({
  href,
  label,
}: {
  readonly href: string;
  readonly label: string;
}) {
  return (
    <Link
      href={href}
      data-testid="quick-entry"
      onClick={(event) => event.stopPropagation()}
      className="relative z-10 mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium tracking-wider text-[#d09a4e] uppercase underline-offset-4 hover:underline"
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}
