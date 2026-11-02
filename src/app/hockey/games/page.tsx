import type { Metadata } from "next";
import { recordsOf, scoreboardOrder } from "@/domain/hockey/league";
import { hockeyPath, hockeyUrl } from "@/domain/hockey/site";
import { GameCard } from "@/components/hockey/site/GameCard";
import { LiveRefresh } from "@/components/hockey/site/LiveRefresh";
import { SiteShell } from "@/components/hockey/site/SiteShell";
import { LeagueDown } from "@/components/hockey/site/StandingsTable";
import { TrackedLink } from "@/components/hockey/site/TrackedLink";
import styles from "@/components/hockey/site/site.module.css";
import { scoreboard, standings } from "../_server/league";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const words = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}): Promise<Metadata> {
  const { date } = await searchParams;
  const day =
    date && DATE.test(date)
      ? ` for ${words(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`
      : "";
  return {
    title: `NHL scores & schedule${day} — Hockey Night`,
    description: `Every NHL game${day || " today"}: live scores, finals and puck-drop times, from the league's own data. Make a night of any game with your crew.`,
    alternates: { canonical: hockeyUrl("/games") },
  };
}

/** `/hockey/games`: one day's games, live first; a week strip and the days either side. */
export default async function Games({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const now = new Date();
  const [board, table] = await Promise.all([
    scoreboard(date && DATE.test(date) ? date : undefined),
    standings(),
  ]);
  const records = recordsOf(table);
  const games = board ? scoreboardOrder(board.games) : [];
  const live = games.some(
    (g) => g.state === "live" || g.state === "intermission",
  );
  const day = (d: string) => hockeyPath(`/games?date=${d}`);

  return (
    <SiteShell>
      <LiveRefresh active={live} />
      <main className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className={`${styles.display} text-[40px] leading-none`}>
          Scores & schedule
        </h1>
        {!board ? (
          <div className="mt-6">
            <LeagueDown what="scoreboard" />
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between gap-2">
              {board.prevDate ? (
                <TrackedLink
                  href={day(board.prevDate)}
                  event="Hockey: scores browsed"
                  props={{ to: "previous" }}
                  className="flex min-h-11 items-center rounded-full px-3 text-[14px] font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Previous day"
                >
                  ← {words(board.prevDate, { weekday: "short" })}
                </TrackedLink>
              ) : (
                <span />
              )}
              <p className="text-center">
                <span
                  className={`${styles.display} block text-[24px] leading-none`}
                >
                  {words(board.date, { weekday: "long" })}
                </span>
                <span className="text-[13px] text-white/55">
                  {words(board.date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </p>
              {board.nextDate ? (
                <TrackedLink
                  href={day(board.nextDate)}
                  event="Hockey: scores browsed"
                  props={{ to: "next" }}
                  className="flex min-h-11 items-center rounded-full px-3 text-[14px] font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Next day"
                >
                  {words(board.nextDate, { weekday: "short" })} →
                </TrackedLink>
              ) : (
                <span />
              )}
            </div>

            {board.week.length > 0 && (
              <nav
                aria-label="This week"
                className={`${styles.noScrollbar} -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4`}
              >
                {board.week.map((d) => {
                  const on = d.date === board.date;
                  return (
                    <TrackedLink
                      key={d.date}
                      href={day(d.date)}
                      event="Hockey: scores browsed"
                      props={{ to: "week" }}
                      aria-current={on ? "date" : undefined}
                      className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-2xl px-3 py-2 transition ${on ? "bg-white text-[#05080f]" : "bg-white/[0.05] text-white/80 hover:bg-white/10"}`}
                    >
                      <span className="text-[11px] font-bold uppercase">
                        {words(d.date, { weekday: "short" })}
                      </span>
                      <span
                        className={`${styles.num} text-[22px] leading-none`}
                      >
                        {words(d.date, { day: "numeric" })}
                      </span>
                      <span className="text-[10.5px] opacity-60">
                        {d.games} {d.games === 1 ? "game" : "games"}
                      </span>
                    </TrackedLink>
                  );
                })}
              </nav>
            )}

            {games.length === 0 ? (
              <p
                className={`${styles.card} mt-6 rounded-2xl px-4 py-6 text-[15px] text-white/70`}
              >
                No NHL games on this day.
              </p>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((g) => (
                  <div key={g.id} id={`game-${g.id}`} className="scroll-mt-32">
                    <GameCard
                      game={g}
                      records={records}
                      from="games"
                      now={now}
                      className="h-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </SiteShell>
  );
}
