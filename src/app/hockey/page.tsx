import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/currentUser";
import { HockeyLanding } from "@/components/hockey/HockeyLanding";
import { NightsShelf } from "@/components/hockey/NightsShelf";
import { suggestedGame } from "@/domain/hockey/schedule";
import { myCups, myNights } from "./_server/night";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hockey Night — plan it, pick your teams, talk trash, compete",
  description:
    "Hockey is better with your crew. Plan the night, pick your teams, make predictions, compete for the Cup and keep the memories. Any NHL game, any arena. By Go Have a Day.",
  // The front door is public; every night behind it is invitation-only and
  // never indexed (`[id]/page.tsx`).
  robots: { index: true, follow: true },
};

/**
 * `/hockey`: the public front door when signed out; your nights when signed
 * in. Nothing about any night is on the signed-out page.
 */
export default async function HockeyPage({
  searchParams,
}: {
  searchParams: Promise<{ gone?: string }>;
}) {
  const user = await currentUser();
  if (!user) return <HockeyLanding />;
  const [nights, { gone }] = await Promise.all([myNights(user), searchParams]);
  const cups = await myCups(user, nights);
  return (
    <NightsShelf
      nights={nights}
      cups={cups}
      name={user.displayName}
      gone={gone === "1"}
      suggestion={suggestedGame(new Date())}
    />
  );
}
