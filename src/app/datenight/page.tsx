import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { MARKHAM } from "@/domain/date-night/adventures/markham";
import { currentUser } from "@/lib/auth/currentUser";
import { OpenNight } from "@/components/night/OpenNight";
import { atlasStopsFor } from "@/lib/adventures/atlas-names";

/** Kalamalka Lake Park: a landscape, chosen because it says nothing about anyone. */
const BACKDROP = "d3c70f99-3412-46d2-87f8-45e4854b7d48";

export const metadata: Metadata = {
  title: "The Markham Adventure ❤️",
  robots: { index: false },
};

/**
 * The front door of the Markham Adventure. It shows nothing private: a
 * title and a button. The adventure itself is made for you when you press it
 * (signed in), and is yours alone until you invite somebody.
 */
export default async function DateNightPage() {
  const [user, stops] = await Promise.all([
    currentUser().catch(() => null),
    atlasStopsFor([BACKDROP]).catch(() => null),
  ]);
  const backdrop = stops?.experiences[BACKDROP];
  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <OpenNight
        slug={MARKHAM.slug}
        title={MARKHAM.title}
        tagline="An adventure for two. Private until you invite someone."
        signedIn={user !== null}
        {...(backdrop ? { backdrop } : {})}
      />
    </>
  );
}
