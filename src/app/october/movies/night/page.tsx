import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/currentUser";
import { reactionsFor } from "@/lib/movies/reactions";
import { MovieNight } from "@/components/october/movies/MovieNight";

export const metadata: Metadata = { title: "Movie Night — Passport" };

/**
 * Movie Night, unchanged, moved here from `/october/movies` so the ordinary
 * browsable catalogue could have the plain URL. This is the theatrical
 * presentation of the same capability: same catalogue, same films, same row in
 * `passport_october_things` — three questions instead of a grid, for the
 * evening when choosing is the hard part.
 *
 * Works signed out — choosing something great needs no account. Only *keeping*
 * it does, which is the one thing it then offers.
 */
export default async function MovieNightPage() {
  const user = await currentUser();
  const reactions = user ? await reactionsFor(user) : [];
  return <MovieNight signedIn={Boolean(user)} reactions={reactions} />;
}
