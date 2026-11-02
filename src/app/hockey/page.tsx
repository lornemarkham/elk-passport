import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/currentUser";
import { teamByAbbr } from "@/domain/hockey/fans";
import {
  groupStandings,
  pickHero,
  placeIn,
  plays,
  recordsOf,
  resultFor,
  splitSeason,
  stillOn,
  teamFullName,
  teamSlug,
} from "@/domain/hockey/league";
import { HOCKEY_SITE, hockeyPath, hockeyUrl } from "@/domain/hockey/site";
import { CreateNightLink } from "@/components/hockey/site/CreateNightLink";
import { FeaturedMatchup } from "@/components/hockey/site/FeaturedMatchup";
import { GameCard } from "@/components/hockey/site/GameCard";
import { LiveRefresh } from "@/components/hockey/site/LiveRefresh";
import { LocalTime } from "@/components/hockey/site/LocalTime";
import { ScoreTicker } from "@/components/hockey/site/ScoreTicker";
import { SiteShell } from "@/components/hockey/site/SiteShell";
import {
  LeagueDown,
  StandingsTable,
} from "@/components/hockey/site/StandingsTable";
import { TeamMark } from "@/components/hockey/site/TeamMark";
import styles from "@/components/hockey/site/site.module.css";
import { clubSeason, leaders, scoreboard, standings } from "./_server/league";
import { myNights } from "./_server/night";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Hockey Night — NHL scores, standings and teams. Watch it with your crew.",
  description:
    "Tonight's NHL scores, the schedule, standings and every team — then make a night of it: plan the game with friends, make picks, talk trash and play for the Cup. Free, by Go Have a Day.",
  alternates: { canonical: hockeyUrl() },
  openGraph: {
    title: "Hockey Night — NHL scores, standings and teams",
    description:
      "Tonight's games, the standings and every team. Then make a night of it with your crew.",
    url: hockeyUrl(),
    siteName: HOCKEY_SITE.name,
    type: "website",
  },
  robots: { index: true, follow: true },
};

const dayWords = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

const LEADER_TITLES: Record<string, string> = {
  points: "Points",
  goals: "Goals",
  assists: "Assists",
};

/**
 * **gohaveaday.com/hockey** — a hockey site with Hockey Night built in.
 * Public for everybody, signed in or not: the league tonight, the featured
 * matchup, the table, the leaders, and a way to make a night of any game.
 * A signed-in person's own nights are one tap away (`/hockey/my-nights`)
 * and their next one is named here; nothing about anybody else's is.
 */
export default async function HockeyHome() {
  const now = new Date();
  const featured = HOCKEY_SITE.featuredTeam;
  const [board, table, season, top, user] = await Promise.all([
    scoreboard(),
    standings(),
    clubSeason(featured),
    leaders(),
    currentUser().catch(() => null),
  ]);
  const today = board?.games ?? [];
  const nextBoard =
    board && !stillOn(today) && board.nextDate
      ? await scoreboard(board.nextDate)
      : null;
  const next = nextBoard?.games ?? [];
  const hero = pickHero(today, next, featured);
  const heroToday = hero ? today.includes(hero) : false;
  const team = teamByAbbr(featured)!;
  const heroLabel = !hero
    ? ""
    : plays(hero, featured)
      ? heroToday
        ? `${team.name} · today`
        : `${team.name} · next game`
      : hero.state === "live" || hero.state === "intermission"
        ? "Live now"
        : heroToday
          ? "Tonight's featured game"
          : "Next up";
  const records = recordsOf(table);
  const mine = user ? await myNights(user).catch(() => []) : [];
  const nextNight = mine.find((n) => !n.over);

  const { played, ahead, now: flamesLive } = splitSeason(season);
  const flamesRow = table?.rows.find((r) => r.abbr === featured);
  const flamesNext = flamesLive ?? ahead[0];
  const division = flamesRow
    ? groupStandings(table!.rows, "division").find(
        (d) => d.name === flamesRow.division,
      )
    : undefined;
  const live = today.some(
    (g) => g.state === "live" || g.state === "intermission",
  );

  return (
    <SiteShell>
      <LiveRefresh active={live} />
      <main className="mx-auto max-w-5xl px-4 pt-3">
        <ScoreTicker games={today} date={board?.date} />

        <h1 className="sr-only">
          Hockey Night — NHL scores, standings and teams
        </h1>

        {nextNight && (
          <Link
            href={`/hockey/${nextNight.id}`}
            className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <span className="min-w-0">
              <span className={styles.eyebrow}>Your next night</span>
              <span className="mt-0.5 block truncate text-[15px] font-semibold">
                {nextNight.home} vs {nextNight.opponent} ·{" "}
                <LocalTime iso={nextNight.startsAt} kind="dayTime" />
              </span>
            </span>
            <span aria-hidden className="text-white/60">
              →
            </span>
          </Link>
        )}

        <div className="mt-4">
          {hero ? (
            <FeaturedMatchup
              game={hero}
              label={heroLabel}
              records={records}
              now={now}
            />
          ) : board ? (
            <section
              className={`${styles.card} rounded-[28px] px-5 py-8 text-center`}
            >
              <p className={`${styles.display} text-[32px] leading-none`}>
                No games today
              </p>
              <CreateNightLink
                from="hero"
                className={`${styles.cta} mt-5 flex min-h-14 w-full items-center justify-center rounded-full text-[17px] uppercase`}
              >
                Create a Hockey Night
              </CreateNightLink>
            </section>
          ) : (
            <div className="flex flex-col gap-4">
              <LeagueDown what="scoreboard" />
              <CreateNightLink
                from="hero"
                className={`${styles.cta} flex min-h-14 w-full items-center justify-center rounded-full text-[17px] uppercase`}
              >
                Create a Hockey Night
              </CreateNightLink>
            </div>
          )}
        </div>

        {today.length > 0 && (
          <section aria-labelledby="today" className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={styles.eyebrow}>{dayWords(board!.date)}</p>
                <h2
                  id="today"
                  className={`${styles.display} mt-1 text-[30px] leading-none`}
                >
                  {stillOn(today) ? "Tonight" : "Final scores"}
                </h2>
              </div>
              <Link
                href={hockeyPath("/games")}
                className="text-[14px] font-semibold text-white/70 hover:text-white"
              >
                All scores →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {today.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  records={records}
                  from="home"
                  now={now}
                />
              ))}
            </div>
          </section>
        )}

        {nextBoard && next.length > 0 && (
          <section aria-labelledby="next" className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={styles.eyebrow}>{dayWords(nextBoard.date)}</p>
                <h2
                  id="next"
                  className={`${styles.display} mt-1 text-[30px] leading-none`}
                >
                  Next up
                </h2>
              </div>
              <Link
                href={hockeyPath(`/games?date=${nextBoard.date}`)}
                className="text-[14px] font-semibold text-white/70 hover:text-white"
              >
                Schedule →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {next.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  records={records}
                  from="home"
                  now={now}
                />
              ))}
            </div>
          </section>
        )}

        <section
          aria-labelledby="our-team"
          className="mt-12 overflow-hidden rounded-[28px] ring-1 ring-white/10"
          style={{
            background: `linear-gradient(135deg, ${team.colours.primary} 0%, color-mix(in srgb, ${team.colours.primary} 40%, #05080f) 60%, #05080f 100%)`,
          }}
        >
          <div className="px-5 pt-5 pb-6">
            <p className={styles.eyebrow}>Our team · an editor&apos;s pick</p>
            <div className="mt-3 flex items-center gap-4">
              <TeamMark abbr={featured} size={72} />
              <div className="min-w-0">
                <h2
                  id="our-team"
                  className={`${styles.display} text-[38px] leading-[0.9]`}
                >
                  {teamFullName(team)}
                </h2>
                {flamesRow && (
                  <p className="mt-1.5 text-[14px] text-white/80">
                    {records[featured]} · {flamesRow.points} pts ·{" "}
                    {placeIn(flamesRow)}
                  </p>
                )}
              </div>
            </div>
            {played.length > 0 && (
              <ol aria-label="Last five results" className="mt-5 flex gap-1.5">
                {played
                  .slice(0, 5)
                  .reverse()
                  .map((g) => {
                    const r = resultFor(g, featured);
                    const us = g.home.abbr === featured ? g.home : g.away;
                    const them = g.home.abbr === featured ? g.away : g.home;
                    return (
                      <li
                        key={g.id}
                        title={`${r} ${us.score}–${them.score} ${g.home.abbr === featured ? "vs" : "at"} ${them.abbr}`}
                        className={`flex min-w-0 flex-1 flex-col items-center rounded-xl py-2 text-[12px] ${r === "W" ? "bg-white/90 text-[#05080f]" : "bg-black/30 text-white/80"}`}
                      >
                        <span className="font-black">{r}</span>
                        <span className="tabular-nums">
                          {us.score}–{them.score}
                        </span>
                        <span className="opacity-60">{them.abbr}</span>
                      </li>
                    );
                  })}
              </ol>
            )}
            {flamesNext && (
              <p className="mt-5 text-[15px] text-white/90">
                {flamesLive ? "On now: " : "Next: "}
                {flamesNext.home.abbr === featured ? "vs " : "at "}
                <strong>
                  {flamesNext.home.abbr === featured
                    ? `${flamesNext.away.place} ${flamesNext.away.name}`
                    : `${flamesNext.home.place} ${flamesNext.home.name}`}
                </strong>
                {" · "}
                <LocalTime iso={flamesNext.startsAt} kind="dayTime" />
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              {flamesNext && !flamesLive && (
                <CreateNightLink
                  from="spotlight"
                  gameId={flamesNext.id}
                  className={`${styles.cta} flex min-h-12 flex-1 items-center justify-center rounded-full text-[15px] uppercase`}
                >
                  Make a night of it
                </CreateNightLink>
              )}
              <Link
                href={hockeyPath(`/teams/${teamSlug(team)}`)}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/35 text-[15px] font-bold transition hover:bg-white/10"
              >
                {team.name} schedule & stats
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 grid gap-8 lg:grid-cols-[3fr_2fr]">
          <section aria-labelledby="standings">
            <div className="flex items-end justify-between gap-3">
              <h2
                id="standings"
                className={`${styles.display} text-[30px] leading-none`}
              >
                Standings
              </h2>
              <Link
                href={hockeyPath("/standings")}
                className="text-[14px] font-semibold text-white/70 hover:text-white"
              >
                Full table →
              </Link>
            </div>
            <div className="mt-4">
              {division ? (
                <StandingsTable
                  title={`${division.name} Division`}
                  rows={division.rows}
                  rank="divisionRank"
                  compact
                  cutLine={3}
                />
              ) : (
                <LeagueDown what="standings" />
              )}
            </div>
          </section>

          {Object.keys(top).length > 0 && (
            <section aria-labelledby="leaders">
              <h2
                id="leaders"
                className={`${styles.display} text-[30px] leading-none`}
              >
                League leaders
              </h2>
              <div className="mt-4 grid gap-3">
                {Object.keys(LEADER_TITLES)
                  .filter((c) => top[c]?.length)
                  .map((category) => [category, top[category]] as const)
                  .map(([category, list]) => (
                    <div
                      key={category}
                      className={`${styles.card} rounded-2xl px-4 py-3`}
                    >
                      <h3 className="text-[12px] font-extrabold tracking-[0.14em] text-white/55 uppercase">
                        {LEADER_TITLES[category]}
                      </h3>
                      <ol className="mt-2 flex flex-col gap-1.5">
                        {list.slice(0, 3).map((p, i) => (
                          <li
                            key={`${p.name}-${p.team}`}
                            className="flex items-center gap-2.5 text-[14.5px]"
                          >
                            <span className="w-4 text-[12px] text-white/40">
                              {i + 1}
                            </span>
                            <TeamMark abbr={p.team} size={22} />
                            <span className="min-w-0 flex-1 truncate">
                              {p.name}
                            </span>
                            <span className={`${styles.num} text-[18px]`}>
                              {p.value}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>

        <section
          aria-labelledby="what-is"
          className="mt-14 rounded-[28px] bg-white/[0.04] px-5 py-7 ring-1 ring-white/10"
        >
          <p className={styles.eyebrow}>Hockey Night</p>
          <h2
            id="what-is"
            className={`${styles.display} mt-2 text-[40px] leading-[0.9] text-balance`}
          >
            Hockey is better with your crew.
          </h2>
          <p className="mt-3 max-w-xl text-[15.5px] leading-snug text-white/75">
            Pick any game. Invite your people, one link each. Plan the night,
            declare who you bleed for, seal your picks, throw a bet, talk trash
            in the Chirp Room, and play for the Cup — then keep the photos and
            run it back.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              [
                "Before",
                "Vote on where to eat. Seal your picks — the score, first goal, who complains about the refs first. Throw a bet at somebody.",
              ],
              [
                "During",
                "Phones away. The intermissions are for one stupid thing. The host calls it from the league's own numbers.",
              ],
              [
                "After",
                "Awards. Receipts. The spectacularly wrong pick, framed. Photos. Then run it back — the Cup carries over.",
              ],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-2xl bg-white/[0.05] px-4 py-3.5 ring-1 ring-white/10"
              >
                <p className="text-[12px] font-bold tracking-[0.16em] text-[color:var(--gold)] uppercase">
                  {title}
                </p>
                <p className="mt-1 text-[14.5px] leading-snug text-white/85">
                  {body}
                </p>
              </div>
            ))}
          </div>
          <CreateNightLink
            from="home"
            className={`${styles.cta} mt-6 flex min-h-14 w-full items-center justify-center rounded-full text-[17px] uppercase sm:w-auto sm:px-10`}
          >
            Create a Hockey Night
          </CreateNightLink>
          <p className="mt-3 text-[13.5px] text-white/50">
            Free. Got an invitation link? Open it — it brings you straight to
            your night. Every night is private to the people invited to it.
          </p>
        </section>
      </main>
    </SiteShell>
  );
}
