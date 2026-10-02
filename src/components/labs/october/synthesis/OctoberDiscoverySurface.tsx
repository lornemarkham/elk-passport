import Link from "next/link";
import { octoberPool } from "@/lib/labs/october/pool";
import { localDay, weekendDays } from "@/domain/october/calendar";
import type { Days } from "@/lib/labs/october/filters";
import { Simulated } from "@/components/labs/october/atoms";
import { OctoberDiscovery } from "./OctoberDiscovery";
import { OctoberTray } from "@/components/labs/october/OctoberTray";
import { ChoicesLink } from "@/components/labs/october/ChoicesLink";
import { Unanswered } from "@/components/october/shell/atoms";

/**
 * **October's discovery surface — one implementation, rendered by one route.**
 *
 * `/october/discover` is the production route and renders this. The lab route
 * it grew up on renders the same component rather than a copy of it, so there
 * is no version of October that can drift from the one people use.
 *
 * ## A note on where this file lives
 *
 * The modules underneath it still sit under `lib/labs/` and
 * `components/labs/`, which is now inaccurate: they are production code.
 * Moving them is a mechanical rename across about a dozen files and four
 * other labs, and it was not worth doing on the evening of a launch for no
 * behavioural gain. **The disagreement is named rather than papered over**,
 * and the move is the first item on the post-launch list.
 *
 * ## What the server does, and what it refuses to do
 *
 * It reads the October corpus once, works out which local days the temporal
 * questions are about, and hands both to the browser. The days are computed
 * here on purpose: "this weekend" is a question about a calendar in a
 * particular timezone, and a client that worked it out from the device clock
 * would disagree with the server that ranked the results.
 */
export async function OctoberDiscoverySurface({
  sim,
  standalone = false,
}: {
  /** Development-only scenario. `scenarioFrom` is inert in a deployed build. */
  readonly sim?: string;
  /**
   * **Standalone means "nothing above me says October".**
   *
   * In production this sits inside the October layout, whose navigation
   * already carries the wordmark — printing a second "October" directly under
   * the first one is the kind of duplication that makes a promoted page look
   * bolted on. The lab route has no navigation, so there it carries its own.
   */
  readonly standalone?: boolean;
}) {
  const pool = await octoberPool(sim);

  const days: Days = {
    today: pool.today,
    tomorrow: localDay(new Date(pool.now.getTime() + 24 * 60 * 60 * 1000)),
    weekend: weekendDays(pool.now),
  };

  const seed = pool.possibilities
    .filter((p) => pool.page.kept.has(p.id))
    .map((p) => ({ id: p.id, name: p.title, when: p.availability.label }));

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-4xl px-5 pt-8 pb-28 sm:px-6">
        <div
          className={`mb-7 flex items-center gap-4 ${
            standalone ? "justify-between" : "justify-end"
          }`}
        >
          {standalone ? (
            <p className="font-heading text-xl tracking-tight text-[#f3efe4]">
              October
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <Simulated label={pool.simulated} />
            <ChoicesLink seed={seed} signedIn={pool.page.signedIn} />
          </div>
        </div>

        {pool.outage ? <Unanswered /> : null}

        <OctoberDiscovery
          possibilities={pool.possibilities}
          ctx={pool.ctx}
          days={days}
          weather={pool.weather}
          areaName={pool.areaName}
          signedIn={pool.page.signedIn}
          kept={[...pool.page.kept]}
        />

        {standalone ? (
          <p className="mt-16 border-t border-[#e9e6da]/10 pt-5 text-xs text-[#e9e6da]/25">
            This is the same surface as{" "}
            <Link href="/october/discover" className="hover:text-[#e9e6da]/60">
              October Discover
            </Link>
            . The experiments it came from —{" "}
            <Link
              href="/labs/october/discovery"
              className="hover:text-[#e9e6da]/60"
            >
              A, B, C and D
            </Link>{" "}
            — are still there, unchanged.
          </p>
        ) : null}
      </div>

      <OctoberTray seed={seed} signedIn={pool.page.signedIn} title="Choices" />
    </main>
  );
}
