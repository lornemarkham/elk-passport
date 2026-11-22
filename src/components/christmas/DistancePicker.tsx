"use client";

import Link from "next/link";
import { DISTANCES, writeAsk, type Ask } from "@/domain/christmas/discover";
import { cn } from "@/lib/utils";
import { rememberDistance } from "./RememberDistance";

/**
 * **How far?** — six answers, one tap each: 2, 5, 10, 20, 30 or 50 km. A plain
 * set of links (the address is the state, so it works before any script and
 * every choice is shareable), keeping everything else already said.
 */
export function DistancePicker({
  ask,
  path,
  className,
}: {
  readonly ask: Ask;
  /** The page it sits on; the rest of the ask rides along. */
  readonly path: string;
  readonly className?: string;
}) {
  return (
    <nav
      aria-label="How far"
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-testid="distance-picker"
    >
      <span className="text-sm font-semibold">Within</span>
      {DISTANCES.map((km) => {
        const on = ask.km === km;
        const q = writeAsk({ ...ask, km });
        // The default is left out of the address, so spell it for the link.
        const query = new URLSearchParams(q);
        query.set("km", String(km));
        return (
          <Link
            key={km}
            href={`${path}?${query.toString()}`}
            onClick={() => rememberDistance(km)}
            aria-current={on ? "true" : undefined}
            scroll={false}
            data-testid={`km-${km}`}
            className={cn(
              "inline-flex min-h-11 min-w-14 items-center justify-center rounded-full border-2 px-3 text-sm font-bold",
              on
                ? "border-white bg-white text-[#082319]"
                : "border-white/40 text-white hover:border-white/80",
            )}
          >
            {km} km
          </Link>
        );
      })}
    </nav>
  );
}
