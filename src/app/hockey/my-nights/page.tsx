import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/currentUser";
import { NightsShelf } from "@/components/hockey/NightsShelf";
import { suggestedGame } from "@/domain/hockey/schedule";
import { hockeyPath } from "@/domain/hockey/site";
import { myCups, myNights } from "../_server/night";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Hockey Nights",
  robots: { index: false, follow: false },
};

/**
 * **Your nights** — what `/hockey` was for a signed-in person until the
 * public site took the front door (2026-11-01). The same shelf, the same
 * Cup, the same start form; `?game=` opens the form on a game somebody
 * chose from a public page, and `?via=` says which page that was.
 */
export default async function MyHockeyNights({
  searchParams,
}: {
  searchParams: Promise<{ gone?: string; game?: string; via?: string }>;
}) {
  const [user, query] = await Promise.all([currentUser(), searchParams]);
  if (!user) {
    const back = new URLSearchParams();
    if (query.game) back.set("game", query.game);
    if (query.via) back.set("via", query.via);
    const next = hockeyPath(`/my-nights${back.size ? `?${back}` : ""}`);
    redirect(`/auth?next=${encodeURIComponent(next)}`);
  }
  const nights = await myNights(user);
  const cups = await myCups(user, nights);
  const game = Number(query.game);
  const via =
    query.via && /^[a-z-]{1,20}$/.test(query.via) ? query.via : undefined;
  return (
    <NightsShelf
      nights={nights}
      cups={cups}
      name={user.displayName}
      gone={query.gone === "1"}
      suggestion={suggestedGame(new Date())}
      {...(Number.isInteger(game) && game > 0 ? { gameId: game } : {})}
      {...(via ? { via } : {})}
    />
  );
}
