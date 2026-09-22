import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/currentUser";
import { reactionsFor } from "@/lib/movies/reactions";
import { MovieNight } from "@/components/october/movies/MovieNight";

export const metadata: Metadata = { title: "Movie Night — Passport" };

/**
 * Movie Night works signed out — choosing something great needs no account.
 * Only *keeping* it does, which is the one thing it then offers.
 */
export default async function MovieNightPage() {
  const user = await currentUser();
  const reactions = user ? await reactionsFor(user) : [];
  return <MovieNight signedIn={Boolean(user)} reactions={reactions} />;
}
