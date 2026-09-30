import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/currentUser";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { MyOctober } from "@/components/october/MyOctober";
import { reactionsFor } from "@/lib/movies/reactions";

export const metadata: Metadata = {
  title: "My October — Passport",
};

/**
 * **My October.** The record of the October this person is going to have,
 * and then had.
 *
 * Moved here from `/october`, which is now the control room. The page itself
 * is unchanged: two lists and nothing else, what is Ahead and what has been
 * Lived. The rows are the person's (`passport_october_things`); everything a
 * row *shows* — a picture, a place, a date — is read from Atlas at render
 * time, because Atlas owns it and a copy would drift.
 *
 * This is where accumulated October will keep arriving: plans, discoveries,
 * reactions, the experiences somebody has been through, and the threads that
 * run between them. It accumulates and it is never finished, so there is no
 * total to be a percentage of.
 *
 * A visitor sees an invitation, not an error: they have no October yet, and
 * that is a fact about them, not a failure.
 */
export default async function MyOctoberPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-heading text-4xl tracking-tight text-[#f3efe4]">
          My October
        </h1>
        <p className="mt-4 max-w-md text-[#e9e6da]/55">
          The October you&apos;re going to have, and then the one you had. Sign
          in and the things you mean to do wait for you here — on any device,
          until you say you did them.
        </p>
        <Link
          href="/auth?next=/october/mine"
          className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[#e9e6da] px-5 text-sm font-medium text-[#0c0a0c]"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const [things, candidates, reactions] = await Promise.all([
    octoberThingsFor(user),
    discoveryCandidates().then((a) => a.candidates),
    reactionsFor(user),
  ]);
  const experiences = candidates.map(candidateToExperience);

  return (
    <MyOctober
      things={things}
      experiences={experiences}
      reactions={reactions}
    />
  );
}
