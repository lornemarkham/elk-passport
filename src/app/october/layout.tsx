import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth/currentUser";
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
  const user = await currentUser();
  return (
    <div className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <OctoberNav displayName={user?.displayName ?? null} />
      {children}
    </div>
  );
}
