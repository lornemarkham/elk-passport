import Link from "next/link";
import type { LeagueGame } from "@/domain/hockey/league";
import { hockeyPath } from "@/domain/hockey/site";
import { LocalTime } from "./LocalTime";
import styles from "./site.module.css";

function Status({ game }: { game: LeagueGame }) {
  if (game.state === "live")
    return (
      <span className="inline-flex items-center gap-1.5 text-[color:var(--live)]">
        <span className={styles.liveDot} aria-hidden />
        {game.period} {game.clock}
      </span>
    );
  if (game.state === "intermission")
    return <span className="text-[color:var(--live)]">{game.period} INT</span>;
  if (game.state === "final")
    return (
      <span>
        Final{game.ending && game.ending !== "REG" ? `/${game.ending}` : ""}
      </span>
    );
  if (game.state === "postponed") return <span>PPD</span>;
  return <LocalTime iso={game.startsAt} />;
}

/** The day's games in one line, like the bottom of a broadcast. */
export function ScoreTicker({
  games,
  date,
}: {
  games: readonly LeagueGame[];
  date?: string;
}) {
  if (games.length === 0) return null;
  return (
    <ul
      aria-label="Today's scores"
      className={`${styles.noScrollbar} -mx-4 flex snap-x gap-2 overflow-x-auto px-4`}
    >
      {games.map((g) => {
        const started = g.home.score !== undefined;
        const row = (abbr: string, score?: number, lost?: boolean) => (
          <span className="flex items-center justify-between gap-3">
            <span
              className={`${styles.display} text-[15px] ${lost ? "text-white/45" : ""}`}
            >
              {abbr}
            </span>
            {started && (
              <span
                className={`${styles.num} text-[16px] ${lost ? "text-white/45" : ""}`}
              >
                {score}
              </span>
            )}
          </span>
        );
        const final = g.state === "final";
        const awayLost = final && (g.away.score ?? 0) < (g.home.score ?? 0);
        const homeLost = final && (g.home.score ?? 0) < (g.away.score ?? 0);
        return (
          <li key={g.id} className="snap-start">
            <Link
              href={hockeyPath(
                `/games${date ? `?date=${date}` : ""}#game-${g.id}`,
              )}
              aria-label={`${g.away.name} ${g.away.score ?? ""} at ${g.home.name} ${g.home.score ?? ""}`}
              className={`${styles.card} flex w-[112px] flex-col gap-0.5 rounded-xl px-3 py-2 transition hover:border-white/25`}
            >
              {row(g.away.abbr, g.away.score, awayLost)}
              {row(g.home.abbr, g.home.score, homeLost)}
              <span className="mt-0.5 truncate text-[11px] font-semibold text-white/55">
                <Status game={g} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
