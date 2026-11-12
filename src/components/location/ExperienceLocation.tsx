"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { townById } from "@/domain/discovery/towns";
import { useLocation } from "@/lib/location/useLocation";
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
 * 2. **Change updates the query.** Picking a place sets the address, which
 *    re-runs the server read; the page's results come from Atlas for the new
 *    town, not the same results re-labelled.
 */
export function ExperienceLocation({
  scope,
  experience,
  className,
}: {
  readonly scope: string;
  readonly experience: string;
  readonly className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const location = useLocation(scope);
  const urlAt = townById(params.get("at") ?? undefined)?.id;
  const shared = location.townId;

  const go = (id: string, how: "push" | "replace") => {
    const next = new URLSearchParams(params.toString());
    next.set("at", id);
    router[how](`${pathname}?${next.toString()}`, { scroll: false });
  };

  // `?at=` with nothing after it is Refine's "Anywhere": a choice, not an
  // absence, so it is shown and left alone rather than overwritten.
  const anywhere = !urlAt && params.has("at");

  useEffect(() => {
    if (!params.has("at") && shared) {
      const next = new URLSearchParams(params.toString());
      next.set("at", shared);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [shared, params, pathname, router]);

  return (
    <LocationBar
      scope={scope}
      experience={experience}
      {...(urlAt ? { showing: urlAt } : {})}
      {...(anywhere ? { anywhere } : {})}
      onChange={(id) => go(id, "push")}
      {...(className ? { className } : {})}
    />
  );
}
