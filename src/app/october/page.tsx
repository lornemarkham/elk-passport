import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/currentUser";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { MyOctober } from "@/components/october/MyOctober";
import { AccountControl } from "@/components/auth/AccountControl";

export const metadata: Metadata = {
  title: "My October — Passport",
};

/**
 * **My October.** The record of the October this person is going to have,
 * and then had.
 *
 * Two lists and nothing else: what is Ahead, what has been Lived. The rows
 * are the person's (`passport_october_things`); everything a row *shows* —
 * a picture, a place, a date — is read from Atlas at render time, because
 * Atlas owns it and a copy would drift. The join is by entity id against
 * the same candidates Discovery loads, so a Thing that Atlas has since
 * retired still appears, by its remembered name, rather than vanishing from
 * somebody's October.
 *
 * A visitor sees an invitation, not an error: they have no October yet, and
 * that is a fact about them, not a failure.
 */
export default async function OctoberPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-14">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1" />
          <AccountControl displayName={null} returnTo="/october" />
        </div>
        <h1 className="font-heading mt-10 text-4xl font-semibold tracking-tight text-[#2b2015]">
          My October
        </h1>
        <p className="mt-4 max-w-md text-[#2b2015]/65">
          The October you&apos;re going to have, and then the one you had. Sign
          in and the things you mean to do wait for you here — on any device,
          until you say you did them.
        </p>
        <Link
          href="/auth?next=/october"
          className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[#2b2015] px-5 text-sm font-medium text-[#f7ecd3]"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const [things, candidates] = await Promise.all([
    octoberThingsFor(user),
    listDiscoveryCandidates().catch(() => []),
  ]);
  const experiences = candidates.map(candidateToExperience);

  return (
    <MyOctober
      displayName={user.displayName}
      things={things}
      experiences={experiences}
    />
  );
}
