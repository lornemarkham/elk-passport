import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { teamByAbbr } from "@/domain/hockey/fans";
import {
  groupStandings,
  nightable,
  placeIn,
  recordOf,
  recordsOf,
  resultFor,
  splitSeason,
  teamBySlug,
  teamFullName,
  teamSlug,
  type LeagueGame,
} from "@/domain/hockey/league";
import { HOCKEY_SITE, hockeyPath, hockeyUrl } from "@/domain/hockey/site";
import { CreateNightLink } from "@/components/hockey/site/CreateNightLink";
import { GameCard } from "@/components/hockey/site/GameCard";
import { LiveRefresh } from "@/components/hockey/site/LiveRefresh";
import { LocalTime } from "@/components/hockey/site/LocalTime";
import { SiteShell } from "@/components/hockey/site/SiteShell";
import {
  LeagueDown,
  StandingsTable,
} from "@/components/hockey/site/StandingsTable";
import { TeamMark } from "@/components/hockey/site/TeamMark";
import styles from "@/components/hockey/site/site.module.css";
import { clubSeason, clubStats, standings } from "../../_server/league";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const team = teamBySlug(slug);
  if (!team) return { title: "Team not found — Hockey Night" };
  const full = teamFullName(team);
  const row = (await standings())?.rows.find((r) => r.abbr === team.abbr);
  const standing = row
    ? ` ${recordOf(row)}, ${row.points} points, ${placeIn(row)}.`
    : "";
  return {
    title: `${full} schedule, scores, standings & stats — Hockey Night`,
    description: `${full}:${standing} Next games, recent results, player statistics and the ${row?.division ?? "division"} standings, from the NHL's own data. Make a night of the next ${team.name} game with your crew.`,
    alternates: { canonical: hockeyUrl(`/teams/${slug}`) },
    openGraph: {
      title: `${full} — Hockey Night`,
      description: `Schedule, scores, standings and stats for the ${full}.`,
      url: hockeyUrl(`/teams/${slug}`),
      siteName: HOCKEY_SITE.name,
      type: "website",
    },
  };
}

const opponentOf = (g: LeagueGame, abbr: string) =>
  g.home.abbr === abbr ? g.away : g.home;

/** schema.org for the team and its next games; facts only, as the league gives them. */
function structuredData(
  abbr: string,
  slug: string,
  ahead: readonly LeagueGame[],
) {
  const team = teamByAbbr(abbr)!;
  const sportsTeam = (a: string) => {
    const t = teamByAbbr(a);
    return {
      "@type": "SportsTeam",
      name: t ? teamFullName(t) : a,
      sport: "Ice hockey",
    };
  };
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: teamFullName(team),
    alternateName: abbr,
    sport: "Ice hockey",
    url: hockeyUrl(`/teams/${slug}`),
    memberOf: {
      "@type": "SportsOrganization",
      name: "National Hockey League",
    },
    event: ahead.slice(0, 5).map((g) => ({
      "@type": "SportsEvent",
      name: `${g.away.place} ${g.away.name} at ${g.home.place} ${g.home.name}`,
      startDate: g.startsAt,
      eventStatus:
        g.state === "postponed"
          ? "https://schema.org/EventPostponed"
          : "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: g.venue || "TBA" },
      homeTeam: sportsTeam(g.home.abbr),
      awayTeam: sportsTeam(g.away.abbr),
      sport: "Ice hockey",
    })),
  };
}

/** `/hockey/teams/[slug]`: one club — where it stands, what's next, what happened, who's scoring. */
export default async function TeamPage({ params }: Props) {
  const { slug } = await params;
  const team = teamBySlug(slug);
  if (!team) notFound();
  if (teamSlug(team) !== slug) notFound();
  const now = new Date();
  const [season, table, stats] = await Promise.all([
    clubSeason(team.abbr),
    standings(),
    clubStats(team.abbr),
  ]);
  const { played, ahead, now: onNow } = splitSeason(season);
  const row = table?.rows.find((r) => r.abbr === team.abbr);
  const division = row
    ? groupStandings(table!.rows, "division").find(
        (d) => d.name === row.division,
      )
    : undefined;
  const records = recordsOf(table);
  const next = ahead[0];
  const featured = team.abbr === HOCKEY_SITE.featuredTeam;
  const json = JSON.stringify(structuredData(team.abbr, slug, ahead)).replace(
    /</g,
    "\\u003c",
  );

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        // Facts from the league, escaped: no `<` can close the script.
        dangerouslySetInnerHTML={{ __html: json }}
      />
      <LiveRefresh active={Boolean(onNow)} />
      <main className="mx-auto max-w-5xl px-4 pt-4">
        <section
          aria-labelledby="team"
          className="overflow-hidden rounded-[28px] px-5 pt-6 pb-6 ring-1 ring-white/10"
          style={{
            background: `linear-gradient(135deg, ${team.colours.primary} 0%, color-mix(in srgb, ${team.colours.primary} 45%, #05080f) 55%, color-mix(in srgb, ${team.colours.secondary} 30%, #05080f) 100%)`,
          }}
        >
          {featured && (
            <p className={styles.eyebrow}>Our team · an editor&apos;s pick</p>
          )}
          <div className="mt-2 flex items-center gap-4">
            <TeamMark abbr={team.abbr} size={88} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-white/75">
                {team.city}
              </p>
              <h1
                id="team"
                className={`${styles.display} text-[46px] leading-[0.88] sm:text-[60px]`}
              >
                {team.name}
              </h1>
            </div>
          </div>
          {row ? (
            <dl className="mt-6 grid grid-cols-4 gap-2 text-center">
              {[
                ["Record", recordOf(row)],
                ["Points", String(row.points)],
                ["Last 10", row.lastTen],
                ["Streak", row.streak || "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-black/30 px-1 py-2.5">
                  <dt className="text-[10.5px] font-bold tracking-[0.12em] text-white/60 uppercase">
                    {k}
                  </dt>
                  <dd
                    className={`${styles.num} mt-0.5 text-[20px] leading-none`}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {row && (
            <p className="mt-3 text-[13.5px] text-white/75">
              {placeIn(row)} · {row.conference} Conference
            </p>
          )}
        </section>

        {onNow && (
          <section aria-label="On now" className="mt-6">
            <GameCard game={onNow} records={records} from="team" now={now} />
          </section>
        )}

        {next && (
          <section aria-labelledby="next" className="mt-8">
            <h2
              id="next"
              className={`${styles.display} text-[28px] leading-none`}
            >
              Next game
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr] sm:items-stretch">
              <GameCard
                game={next}
                records={records}
                from="team"
                now={now}
                withDay
                cta={false}
              />
              {nightable(next, now) && (
                <div
                  className={`${styles.card} flex flex-col justify-center rounded-2xl p-4`}
                >
                  <p className="text-[15.5px] leading-snug text-white/85">
                    {next.away.name} at {next.home.name}? Get your people
                    together: picks, trash talk, the Cup.
                  </p>
                  <CreateNightLink
                    from="team"
                    gameId={next.id}
                    className={`${styles.cta} mt-3 flex min-h-12 items-center justify-center rounded-full text-[15px] uppercase`}
                  >
                    Make a night of it
                  </CreateNightLink>
                </div>
              )}
            </div>
          </section>
        )}

        {season.length === 0 && (
          <div className="mt-8">
            <LeagueDown what="schedule" />
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {ahead.length > 1 && (
            <section aria-labelledby="schedule">
              <h2
                id="schedule"
                className={`${styles.display} text-[28px] leading-none`}
              >
                Coming up
              </h2>
              <ul
                className={`${styles.card} mt-3 divide-y divide-white/5 rounded-2xl`}
              >
                {ahead.slice(1, 9).map((g) => {
                  const them = opponentOf(g, team.abbr);
                  return (
                    <li
                      key={g.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span className="w-6 text-[12px] font-bold text-white/50">
                        {g.home.abbr === team.abbr ? "vs" : "at"}
                      </span>
                      <TeamMark abbr={them.abbr} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold">
                          {them.place} {them.name}
                        </span>
                        <span className="block text-[12px] text-white/50">
                          <LocalTime iso={g.startsAt} kind="dayTime" />
                        </span>
                      </span>
                      {nightable(g, now) && (
                        <CreateNightLink
                          from="team"
                          gameId={g.id}
                          className="shrink-0 text-[12.5px] font-bold text-[color:var(--gold)] hover:underline"
                        >
                          Make a night
                        </CreateNightLink>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {played.length > 0 && (
            <section aria-labelledby="results">
              <h2
                id="results"
                className={`${styles.display} text-[28px] leading-none`}
              >
                Results
              </h2>
              <ul
                className={`${styles.card} mt-3 divide-y divide-white/5 rounded-2xl`}
              >
                {played.slice(0, 8).map((g) => {
                  const them = opponentOf(g, team.abbr);
                  const us = g.home.abbr === team.abbr ? g.home : g.away;
                  const r = resultFor(g, team.abbr);
                  return (
                    <li
                      key={g.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span
                        className={`grid h-7 w-9 place-items-center rounded-lg text-[12px] font-black ${r === "W" ? "bg-white text-[#05080f]" : "bg-white/10 text-white/75"}`}
                      >
                        {r}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold">
                          {g.home.abbr === team.abbr ? "vs" : "at"} {them.place}{" "}
                          {them.name}
                        </span>
                        <span className="block text-[12px] text-white/50">
                          <LocalTime iso={g.startsAt} kind="day" />
                          {g.ending && g.ending !== "REG"
                            ? ` · ${g.ending}`
                            : ""}
                        </span>
                      </span>
                      <span
                        className={`${styles.num} text-[20px] tabular-nums`}
                      >
                        {us.score}–{them.score}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {(stats.skaters.length > 0 || stats.goalies.length > 0) && (
          <section aria-labelledby="stats" className="mt-10">
            <h2
              id="stats"
              className={`${styles.display} text-[28px] leading-none`}
            >
              Player stats
            </h2>
            <p className="mt-1 text-[12.5px] text-white/45">
              This regular season, as the league records it.
            </p>
            <div className="mt-3 grid gap-5 lg:grid-cols-[3fr_2fr]">
              {stats.skaters.length > 0 && (
                <div className={`${styles.card} overflow-x-auto rounded-2xl`}>
                  <table className={`${styles.table} w-full text-[14px]`}>
                    <caption className="px-4 pt-3 pb-1 text-left text-[13px] font-extrabold tracking-wide uppercase">
                      Skaters
                    </caption>
                    <thead>
                      <tr>
                        {["Player", "Pos", "GP", "G", "A", "P", "+/−"].map(
                          (h, i) => (
                            <th
                              key={h}
                              scope="col"
                              className={`py-2 ${i === 0 ? `${styles.sticky} pl-4 text-left` : "px-2 text-right"}`}
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.skaters.slice(0, 12).map((p) => (
                        <tr key={p.name}>
                          <th
                            scope="row"
                            className={`${styles.sticky} border-t border-white/5 py-2 pr-2 pl-4 text-left font-semibold`}
                          >
                            {p.name}
                          </th>
                          {[p.position, p.gamesPlayed, p.goals, p.assists].map(
                            (v, i) => (
                              <td
                                key={i}
                                className="border-t border-white/5 px-2 py-2 text-right text-white/75"
                              >
                                {v}
                              </td>
                            ),
                          )}
                          <td className="border-t border-white/5 px-2 py-2 text-right font-extrabold">
                            {p.points}
                          </td>
                          <td className="border-t border-white/5 px-2 py-2 pr-4 text-right text-white/75">
                            {p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {stats.goalies.length > 0 && (
                <div className={`${styles.card} overflow-x-auto rounded-2xl`}>
                  <table className={`${styles.table} w-full text-[14px]`}>
                    <caption className="px-4 pt-3 pb-1 text-left text-[13px] font-extrabold tracking-wide uppercase">
                      Goalies
                    </caption>
                    <thead>
                      <tr>
                        {["Goalie", "GP", "W–L–OT", "GAA", "SV%"].map(
                          (h, i) => (
                            <th
                              key={h}
                              scope="col"
                              className={`py-2 ${i === 0 ? `${styles.sticky} pl-4 text-left` : "px-2 text-right"}`}
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.goalies.map((g) => (
                        <tr key={g.name}>
                          <th
                            scope="row"
                            className={`${styles.sticky} border-t border-white/5 py-2 pr-2 pl-4 text-left font-semibold`}
                          >
                            {g.name}
                          </th>
                          <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                            {g.gamesPlayed}
                          </td>
                          <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                            {g.wins}–{g.losses}–{g.otLosses}
                          </td>
                          <td className="border-t border-white/5 px-2 py-2 text-right text-white/75">
                            {g.gaa.toFixed(2)}
                          </td>
                          <td className="border-t border-white/5 px-2 py-2 pr-4 text-right text-white/75">
                            {g.savePct.toFixed(3).replace(/^0/, "")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {division && (
          <section aria-labelledby="division" className="mt-10">
            <h2
              id="division"
              className={`${styles.display} text-[28px] leading-none`}
            >
              {division.name} Division
            </h2>
            <div className="mt-3">
              <StandingsTable
                title="Standings"
                rows={division.rows}
                rank="divisionRank"
                cutLine={3}
              />
            </div>
          </section>
        )}

        <p className="mt-8">
          <Link
            href={hockeyPath("/teams")}
            className="text-[14px] font-semibold text-white/70 hover:text-white"
          >
            ← All 32 teams
          </Link>
        </p>
      </main>
    </SiteShell>
  );
}
