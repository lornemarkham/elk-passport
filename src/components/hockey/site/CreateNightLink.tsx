"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { createNightPath } from "@/domain/hockey/site";

/**
 * Every "Create a Hockey Night" on the public site. It records one
 * cookieless event — which page it was on and whether it named a game —
 * and nothing about who clicked. The `via` it carries into the start form
 * lets the server count the nights that public pages actually produced
 * (`api/occasions` POST).
 */
export function CreateNightLink({
  from,
  gameId,
  className,
  children,
}: {
  /** "home", "hero", "games", "team", "header"… */
  from: string;
  gameId?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={createNightPath(from, gameId)}
      className={className}
      onClick={() => track("Hockey: create click", { from, game: !!gameId })}
    >
      {children}
    </Link>
  );
}
