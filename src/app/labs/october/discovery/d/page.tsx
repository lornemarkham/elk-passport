import type { Metadata } from "next";
import { octoberPool } from "@/lib/labs/october/pool";
import { localDay, weekendDays } from "@/domain/october/calendar";
import type { Days } from "@/lib/labs/october/filters";
import { Simulated } from "@/components/labs/october/atoms";
import { LabBar } from "@/components/labs/october/LabBar";
import { Discover } from "@/components/labs/october/Discover";
import { OctoberTray } from "@/components/labs/october/OctoberTray";
import { Unanswered } from "@/components/october/shell/atoms";

export const metadata: Metadata = { title: "Discover — October" };

/**
 * **Experiment D's server half: read the pool, work out which days the
 * temporal filters are about, hand both over.**
 *
 * The days are computed here rather than in the browser on purpose. "This
 * weekend" is a question about a calendar in a particular timezone, and a
 * client that works it out from the device clock will disagree with the server
 * that ranked the results — which shows up as a page that says one thing and
 * filters by another. One answer, computed once, where the corpus's own
 * timezone already lives.
 */
export default async function DiscoverLab({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  const pool = await octoberPool((await searchParams).sim);

  const tomorrow = localDay(new Date(pool.now.getTime() + 24 * 60 * 60 * 1000));
  const days: Days = {
    today: pool.today,
    tomorrow,
    weekend: weekendDays(pool.now),
  };

  const seed = pool.possibilities
    .filter((p) => pool.page.kept.has(p.id))
    .map((p) => ({ id: p.id, name: p.title, when: p.availability.label }));

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-3xl px-5 pt-8 pb-28 sm:px-6">
        <LabBar here="/labs/october/discovery/d" />
        <Simulated label={pool.simulated} />

        <header className="mb-6">
          <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
            October{pool.areaName ? ` · ${pool.areaName}` : ""}
          </p>
          <h1 className="font-heading mt-1 text-3xl tracking-tight text-[#f3efe4] sm:text-4xl">
            Discover
          </h1>
        </header>

        {pool.outage ? <Unanswered /> : null}

        <Discover
          possibilities={pool.possibilities}
          ctx={pool.ctx}
          days={days}
          signedIn={pool.page.signedIn}
          kept={[...pool.page.kept]}
        />
      </div>

      <OctoberTray seed={seed} signedIn={pool.page.signedIn} title="Choices" />
    </main>
  );
}
