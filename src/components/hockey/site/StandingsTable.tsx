import Link from "next/link";
import { teamByAbbr } from "@/domain/hockey/fans";
import { teamSlug, type StandingRow } from "@/domain/hockey/league";
import { HOCKEY_SITE, hockeyPath } from "@/domain/hockey/site";
import { TeamMark } from "./TeamMark";
import styles from "./site.module.css";

const pct = (n: number) => n.toFixed(3).replace(/^0/, "");
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * A standings table as the league publishes it. `compact` keeps the columns
 * a phone can show without sliding: GP, W, L, OT, PTS.
 */
export function StandingsTable({
  title,
  rows,
  rank,
  compact = false,
  cutLine,
}: {
  title: string;
  rows: readonly StandingRow[];
  rank: "divisionRank" | "conferenceRank" | "leagueRank";
  compact?: boolean;
  /** Draw a line under this many rows (the playoff line). */
  cutLine?: number;
}) {
  return (
    <div className={`${styles.card} overflow-hidden rounded-2xl`}>
      <h3 className="px-4 pt-3.5 pb-2 text-[15px] font-extrabold tracking-wide uppercase">
        {title}
      </h3>
      <div className={`${styles.noScrollbar} overflow-x-auto`}>
        <table className={`${styles.table} w-full text-[14px]`}>
          <thead>
            <tr>
              <th
                scope="col"
                className={`${styles.sticky} py-2 pr-2 pl-4 text-left`}
              >
                Team
              </th>
              {["GP", "W", "L", "OT", "PTS"].map((h) => (
                <th key={h} scope="col" className="px-2 py-2 text-right">
                  {h}
                </th>
              ))}
              {!compact &&
                ["P%", "GF", "GA", "DIFF", "L10", "STRK"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 text-right">
                    {h}
                  </th>
                ))}
              <th aria-hidden className="w-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const team = teamByAbbr(r.abbr);
              const featured = r.abbr === HOCKEY_SITE.featuredTeam;
              const cut = cutLine !== undefined && i === cutLine - 1;
              return (
                <tr
                  key={r.abbr}
                  className={featured ? styles.featuredRow : undefined}
                  style={
                    cut
                      ? { boxShadow: "inset 0 -2px 0 rgba(255,216,77,0.55)" }
                      : undefined
                  }
                >
                  <th
                    scope="row"
                    className={`${styles.sticky} border-t border-white/5 py-2 pr-2 pl-4 text-left font-semibold`}
                  >
                    <Link
                      href={
                        team
                          ? hockeyPath(`/teams/${teamSlug(team)}`)
                          : hockeyPath("/teams")
                      }
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <span className="w-5 text-right text-[12px] text-white/40 tabular-nums">
                        {r[rank]}
                      </span>
                      <TeamMark abbr={r.abbr} size={24} />
                      <span className="sm:hidden">{r.abbr}</span>
                      <span className="hidden sm:inline">
                        {r.place} {r.name}
                      </span>
                      {r.clinch && (
                        <span className="text-[11px] text-white/45">
                          {r.clinch}
                        </span>
                      )}
                    </Link>
                  </th>
                  {[r.gamesPlayed, r.wins, r.losses, r.otLosses].map((v, j) => (
                    <td
                      key={j}
                      className="border-t border-white/5 px-2 py-2 text-right text-white/75"
                    >
                      {v}
                    </td>
                  ))}
                  <td className="border-t border-white/5 px-2 py-2 text-right font-extrabold">
                    {r.points}
                  </td>
                  {!compact && (
                    <>
                      <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                        {pct(r.pointPct)}
                      </td>
                      <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                        {r.goalsFor}
                      </td>
                      <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                        {r.goalsAgainst}
                      </td>
                      <td
                        className={`border-t border-white/5 px-2 py-2 text-right ${r.goalDiff > 0 ? "text-emerald-300" : r.goalDiff < 0 ? "text-rose-300" : "text-white/75"}`}
                      >
                        {signed(r.goalDiff)}
                      </td>
                      <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                        {r.lastTen}
                      </td>
                      <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                        {r.streak}
                      </td>
                    </>
                  )}
                  <td aria-hidden className="border-t border-white/5" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** "League can't be reached" in the site's voice. Never a made-up table. */
export function LeagueDown({ what }: { what: string }) {
  return (
    <p
      role="status"
      className={`${styles.card} rounded-2xl px-4 py-5 text-[14.5px] text-white/70`}
    >
      The league&apos;s {what} can&apos;t be reached right now. Nothing is shown
      rather than something stale or made up — try again in a minute.
    </p>
  );
}
