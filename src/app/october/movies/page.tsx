import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/currentUser";
import { reactionsFor } from "@/lib/movies/reactions";
import { keptOnThisPage } from "@/lib/october/keptOnThisPage";
import { Films } from "@/components/october/movies/Films";

export const metadata: Metadata = { title: "Movies — October" };

/**
 * The ordinary movies surface: the whole catalogue as edited shelves, with
 * the same save control every other October card carries. Movie Night — the
 * guided three-question version — lives at `/october/movies/night`.
 *
 * Two server reads, both once for the whole page: what they have kept, and
 * what they have already said about a film. Neither is a per-card request.
 *
 * Works signed out: reading the catalogue needs no account, `keptOnThisPage`
 * answers with an empty set and `signedIn: false`, and there are no reactions
 * to show because a visitor has made none.
 */
export default async function MoviesPage() {
  const user = await currentUser().catch(() => null);
  const [page, reactions] = await Promise.all([
    keptOnThisPage(),
    user ? reactionsFor(user).catch(() => []) : Promise.resolve([]),
  ]);
  return (
    <Films
      kept={page.kept}
      signedIn={page.signedIn}
      reactions={reactions.map((r) => [r.filmId, r.verdict] as const)}
    />
  );
}
