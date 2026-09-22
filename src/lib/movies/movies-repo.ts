import { SignedOutError } from "@/lib/data/boards-repo";
import type { Fear } from "./catalogue";
import type { MovieReaction, Verdict } from "./types";

/** Browser side. Passport decides whose reaction this is. */
export async function saveReaction(
  filmId: string,
  reaction: { verdict: Verdict; felt?: Fear; gotMe?: string },
): Promise<MovieReaction> {
  const response = await fetch(
    `/api/october/movies/${encodeURIComponent(filmId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reaction),
    },
  );
  if (response.status === 401) {
    throw new SignedOutError("Sign in to keep this.");
  }
  if (!response.ok) throw new Error("Couldn't save that.");
  return response.json();
}
