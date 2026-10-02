import type { Metadata } from "next";
import { octoberPool } from "@/lib/labs/october/pool";
import { Simulated } from "@/components/labs/october/atoms";
import { LabBar } from "@/components/labs/october/LabBar";
import { Dealer } from "@/components/labs/october/Dealer";
import { OctoberTray } from "@/components/labs/october/OctoberTray";
import { Unanswered } from "@/components/october/shell/atoms";

export const metadata: Metadata = { title: "Trust me — Discovery Lab" };

/**
 * **Experiment C's server half.**
 *
 * Same pool, same weather-aware base ordering, handed to a dealer that shows
 * one card at a time. Everything that makes C different from A and B happens
 * after this file: the forks, the reactions and the learned weights all live
 * in the browser and none of them are persisted, which is deliberate for a
 * prototype — a recommender that remembers you is a much bigger decision than
 * one that forgets you the moment you close the tab.
 */
export default async function TrustMeLab({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  const pool = await octoberPool((await searchParams).sim);
  const seed = pool.possibilities
    .filter((p) => pool.page.kept.has(p.id))
    .map((p) => ({ id: p.id, name: p.title, when: p.availability.label }));

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-3xl px-5 pt-10 pb-28 sm:px-6">
        <LabBar here="/labs/october/discovery/c" />
        <Simulated label={pool.simulated} />
        {pool.outage ? <Unanswered /> : null}

        <Dealer
          possibilities={pool.possibilities}
          ctx={pool.ctx}
          signedIn={pool.page.signedIn}
          kept={[...pool.page.kept]}
        />
      </div>

      <OctoberTray seed={seed} signedIn={pool.page.signedIn} />
    </main>
  );
}
