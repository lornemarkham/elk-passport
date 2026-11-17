"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { townById } from "@/domain/discovery/towns";
import { useLocation } from "@/lib/location/useLocation";
import { shortName } from "@/domain/location/prefs";
import { usePendingRegion } from "@/components/loading/Pending";
import { LocationBar } from "./LocationBar";

/**
 * **The place bar for a page whose server reads the town from `?at=`.**
 *
 * Christmas asks Atlas for distances from the town in its address, so the
 * address — not only the bar — has to change for results to change. Two jobs:
 *
 * 1. **Open on the shared place.** With no `?at=`, once the shared place is
 *    known the address is replaced with it, so the server's next render is
 *    already about where the person is. (`replace`: Back does not land on the
 *    page that had no place.) A town already in the address is left alone — a
 *    shared link opens on the sender's place and changes nobody's saved one.
 *    Where the server already opened on the shared place (`at`, read from the
 *    `ghad-place` cookie the store mirrors), nothing is replaced: rewriting
 *    the address there re-ran the whole server read for the same town on
 *    every visit (M760).
 * 2. **Change updates the query.** Picking a place sets the address, which
 *    re-runs the server read; the page's results come from Atlas for the new
 *    town, not the same results re-labelled.
 * 3. **Say so at once** (P1 loading brief, 2026-11-17). The navigation is
 *    held in a transition (`usePendingRegion`): the old results stay, dimmed
 *    by the page's `PendingContent`, while the bar already names the town
 *    picked and says it is loading. In production it went on naming the old
 *    town for 1.4–8 s with nothing moving.
 */
export function ExperienceLocation({
  scope,
  experience,
  at,
  className,
}: {
  readonly scope: string;
  readonly experience: string;
  /** The town the server rendered for, when it chose one without `?at=`. */
  readonly at?: string;
  readonly className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const location = useLocation(scope);
  const urlAt = townById(params.get("at") ?? undefined)?.id;
  const shared = location.townId;
  const region = usePendingRegion();
  const [asked, setAsked] = useState<string>();

  const go = (id: string, how: "push" | "replace") => {
    const next = new URLSearchParams(params.toString());
    next.set("at", id);
    setAsked(id);
    region.start(shortName(townById(id) ?? { name: id }), () =>
      router[how](`${pathname}?${next.toString()}`, { scroll: false }),
    );
  };
  // The town on its way, while it is on its way; the address once it lands.
  const showing = region.pending && asked ? asked : urlAt;

  // `?at=` with nothing after it is Refine's "Anywhere": a choice, not an
  // absence, so it is shown and left alone rather than overwritten.
  const anywhere = !urlAt && params.has("at");

  useEffect(() => {
    if (!params.has("at") && shared && shared !== at) {
      const next = new URLSearchParams(params.toString());
      next.set("at", shared);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [shared, at, params, pathname, router]);

  return (
    <LocationBar
      scope={scope}
      experience={experience}
      {...(showing ? { showing } : {})}
      {...(anywhere && !region.pending ? { anywhere } : {})}
      {...(region.pending
        ? // The town is already named beside it; a short word keeps
          // "Change" on the same line on a phone.
          { busy: "Loading" }
        : {})}
      onChange={(id) => go(id, "push")}
      {...(className ? { className } : {})}
    />
  );
}
