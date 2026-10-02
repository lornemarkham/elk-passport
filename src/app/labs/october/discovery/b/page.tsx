import type { Metadata } from "next";
import { octoberPool } from "@/lib/labs/october/pool";
import { Simulated } from "@/components/labs/october/atoms";
import { LabBar } from "@/components/labs/october/LabBar";
import { IntentExplorer } from "@/components/labs/october/IntentExplorer";
import { OctoberTray } from "@/components/labs/october/OctoberTray";
import { Unanswered } from "@/components/october/shell/atoms";
import { eveningLine } from "@/lib/labs/october/fit";

export const metadata: Metadata = {
  title: "What do you feel like? — Discovery Lab",
};

/**
 * **Experiment B's server half: read the pool, hand it over, get out of the
 * way.**
 *
 * The whole interaction is in the browser because an intention changes
 * everything on screen and a round trip for each one would make the page feel
 * like a form. The pool is a few hundred plain objects — small enough to send
 * once and reorder locally, which is also what makes the prototype feel
 * instant enough to judge honestly.
 *
 * The sky is still read on the server and still moves the base ordering; the
 * intention is added on top of it. So "stay in" on a clear night and "stay in"
 * in the rain are not the same page.
 */
export default async function IntentLab({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  const pool = await octoberPool((await searchParams).sim);
  const evening = eveningLine(pool.weather);
  const seed = pool.possibilities
    .filter((p) => pool.page.kept.has(p.id))
    .map((p) => ({ id: p.id, name: p.title, when: p.availability.label }));

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-4xl px-5 pt-10 pb-28 sm:px-6">
        <LabBar here="/labs/october/discovery/b" />
        <Simulated label={pool.simulated} />

        <p className="mb-7 text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
          {pool.areaName ?? "October"}
          {evening ? ` · ${evening.replace(/\.$/, "")}` : ""}
        </p>

        {pool.outage ? <Unanswered /> : null}

        <IntentExplorer
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
