import type { Metadata } from "next";
import Link from "next/link";
import { groupStandings } from "@/domain/hockey/league";
import { hockeyPath, hockeyUrl } from "@/domain/hockey/site";
import { SiteShell } from "@/components/hockey/site/SiteShell";
import {
  LeagueDown,
  StandingsTable,
} from "@/components/hockey/site/StandingsTable";
import styles from "@/components/hockey/site/site.module.css";
import { standings } from "../_server/league";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NHL standings — by division, conference and league — Hockey Night",
  description:
    "The NHL standings as the league publishes them: points, record, goal differential, last ten and streak for all 32 clubs, by division, conference or the whole league.",
  alternates: { canonical: hockeyUrl("/standings") },
};

const VIEWS = [
  { id: "division", label: "Division" },
  { id: "conference", label: "Conference" },
  { id: "league", label: "League" },
] as const;
type View = (typeof VIEWS)[number]["id"];

/** `/hockey/standings?view=`: the league's table three ways. */
export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: asked } = await searchParams;
  const view: View = VIEWS.some((v) => v.id === asked)
    ? (asked as View)
    : "division";
  const table = await standings();

  return (
    <SiteShell>
      <main className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className={`${styles.display} text-[40px] leading-none`}>
          Standings
        </h1>
        <nav
          aria-label="Standings view"
          className="mt-4 inline-flex rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
        >
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              href={hockeyPath(
                `/standings${v.id === "division" ? "" : `?view=${v.id}`}`,
              )}
              aria-current={v.id === view ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-full px-4 text-[14px] font-bold transition ${v.id === view ? "bg-white text-[#05080f]" : "text-white/70 hover:text-white"}`}
            >
              {v.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          {!table ? (
            <LeagueDown what="standings" />
          ) : view === "league" ? (
            <StandingsTable
              title="National Hockey League"
              rows={table.rows}
              rank="leagueRank"
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {groupStandings(table.rows, view).map((g) => (
                <StandingsTable
                  key={g.name}
                  title={
                    view === "division"
                      ? `${g.name} Division`
                      : `${g.name} Conference`
                  }
                  rows={g.rows}
                  rank={view === "division" ? "divisionRank" : "conferenceRank"}
                  {...(view === "division" ? { cutLine: 3 } : {})}
                />
              ))}
            </div>
          )}
        </div>
        {table && (
          <p className="mt-4 text-[12.5px] text-white/45">
            As of {table.date}.{" "}
            {view === "division"
              ? "The line marks the top three in each division; two wild cards per conference join them in the playoffs."
              : "GP games played · OT overtime and shootout losses · P% points percentage · L10 last ten games."}
          </p>
        )}
      </main>
    </SiteShell>
  );
}
