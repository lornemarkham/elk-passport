import type { ReactNode } from "react";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth/currentUser";
import { EXPERIENCE_PATH_HEADER } from "@/lib/domains/experience-domains";
import { OctoberNav } from "@/components/october/shell/OctoberNav";

/**
 * **The October product shell.**
 *
 * Everything under `/october` gets the same bar in the same place, including
 * Movie Night, which used to be a screen you could only arrive at and never
 * leave sideways.
 *
 * Deliberately *not* shown through this shell: the Video Store
 * (`/october/store`) and the
 * Secret Room (`/october/room`). They take the whole screen as a fixed layer
 * above this bar. An authored experience is allowed to break the frame — that
 * is most of what makes it one — and they live under `/october` rather than
 * `/labs` so the host mapping, the theme and the sign-in return path all still
 * know they are October.
 */
export default async function OctoberLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [user, requestHeaders] = await Promise.all([currentUser(), headers()]);
  // On `iamoctober.com/` the middleware rewrote the root to a route under
  // `/october`, and the browser still shows `/`. The nav is told which route
  // it is actually on; everywhere else this is absent and the browser path
  // decides, exactly as before.
  const activePath = requestHeaders.get(EXPERIENCE_PATH_HEADER);
  return (
    <div className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <OctoberNav
        displayName={user?.displayName ?? null}
        activePath={activePath}
      />
      {children}
    </div>
  );
}
