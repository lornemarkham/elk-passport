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
 * Deliberately *not* under this shell: the Video Store, which lives at
 * `/labs/october/video-store` and takes the whole screen. An authored
 * experience is allowed to break the frame — that is most of what makes it one
 * — and keeping it on its own route means it breaks the frame by being
 * somewhere else rather than by tearing the shell up from inside.
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
