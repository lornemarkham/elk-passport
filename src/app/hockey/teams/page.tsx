import type { Metadata } from "next";
import Link from "next/link";
import { NHL_TEAMS, teamByAbbr, type NhlTeam } from "@/domain/hockey/fans";
import {
  groupStandings,
  recordOf,
  teamSlug,
  type StandingRow,
} from "@/domain/hockey/league";
import { HOCKEY_SITE, hockeyPath, hockeyUrl } from "@/domain/hockey/site";
import { SiteShell } from "@/components/hockey/site/SiteShell";
import { TeamMark } from "@/components/hockey/site/TeamMark";
import styles from "@/components/hockey/site/site.module.css";
import { standings } from "../_server/league";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All 32 NHL teams — schedules, records and stats — Hockey Night",
  description:
    "Every NHL club by division, with its record and points: open any team for its schedule, results, standings and player statistics.",
  alternates: { canonical: hockeyUrl("/teams") },
};

function Tile({ team, row }: { team: NhlTeam; row?: StandingRow }) {
  const featured = team.abbr === HOCKEY_SITE.featuredTeam;
  return (
    <Link
      href={hockeyPath(`/teams/${teamSlug(team)}`)}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 ring-1 transition hover:-translate-y-0.5 ${featured ? "ring-[color:var(--gold)]/70" : "ring-white/10 hover:ring-white/30"}`}
      style={{
        background: `linear-gradient(110deg, color-mix(in srgb, ${team.colours.primary} 55%, #05080f) 0%, #0c1220 70%)`,
      }}
    >
      <TeamMark abbr={team.abbr} size={46} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-white/60">
          {team.city}
        </span>
        <span
          className={`${styles.display} block truncate text-[22px] leading-none`}
        >
          {team.name}
        </span>
        {row && (
          <span className="mt-1 block text-[12px] text-white/55 tabular-nums">
            {recordOf(row)} · {row.points} pts
          </span>
        )}
      </span>
      {featured && (
        <span className="absolute top-2 right-2.5 text-[10px] font-extrabold tracking-[0.14em] text-[color:var(--gold)] uppercase">
          Our team
        </span>
      )}
    </Link>
  );
}

/** `/hockey/teams`: all 32, by division as the table has them; alphabetical by city when it can't be read. */
export default async function Teams() {
  const table = await standings();
  const groups = table
    ? groupStandings(table.rows, "division").map((g) => ({
        name: `${g.name} Division`,
        rows: g.rows,
      }))
    : null;

  return (
    <SiteShell>
      <main className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className={`${styles.display} text-[40px] leading-none`}>Teams</h1>
        {groups ? (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            {groups.map((g) => (
              <section key={g.name} aria-label={g.name}>
                <h2 className="text-[13px] font-extrabold tracking-[0.16em] text-white/55 uppercase">
                  {g.name}
                </h2>
                <ul className="mt-3 grid gap-2">
                  {g.rows.map((r) => {
                    const team = teamByAbbr(r.abbr);
                    return team ? (
                      <li key={r.abbr}>
                        <Tile team={team} row={r} />
                      </li>
                    ) : null;
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {NHL_TEAMS.map((t) => (
              <li key={t.abbr}>
                <Tile team={t} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </SiteShell>
  );
}
