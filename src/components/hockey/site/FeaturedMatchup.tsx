import { teamByAbbr } from "@/domain/hockey/fans";
import { nightable, type LeagueGame } from "@/domain/hockey/league";
import { HOCKEY_SITE } from "@/domain/hockey/site";
import { CreateNightLink } from "./CreateNightLink";
import { GameStatus, type Records } from "./GameCard";
import { TeamMark } from "./TeamMark";
import styles from "./site.module.css";

function Side({
  abbr,
  name,
  place,
  score,
  record,
  align,
}: {
  abbr: string;
  name: string;
  place: string;
  score?: number;
  record?: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 ${align === "right" ? "items-end text-right" : "items-start"}`}
    >
      <TeamMark abbr={abbr} size={64} />
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-white/70">
          {place}
        </p>
        <p
          className={`${styles.display} truncate text-[30px] leading-[0.9] sm:text-[40px]`}
        >
          {name}
        </p>
        {record && <p className="mt-1 text-[12px] text-white/60">{record}</p>}
      </div>
      {score !== undefined && (
        <p className={`${styles.num} text-[64px] leading-[0.85]`}>{score}</p>
      )}
    </div>
  );
}

/**
 * The big card. Says honestly why it's the big one (`label`), shows the
 * score or the puck drop, and — before the game — the night it could be.
 */
export function FeaturedMatchup({
  game,
  label,
  records = {},
  now,
}: {
  game: LeagueGame;
  label: string;
  records?: Records;
  now: Date;
}) {
  const home = teamByAbbr(game.home.abbr);
  const away = teamByAbbr(game.away.abbr);
  const canNight = nightable(game, now);
  const featured = [game.home.abbr, game.away.abbr].includes(
    HOCKEY_SITE.featuredTeam,
  );
  return (
    <section
      aria-label="Featured matchup"
      className={`${styles.hero} rounded-[28px] px-5 pt-5 pb-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10`}
      style={
        {
          "--home": home?.colours.primary ?? "#2a3342",
          "--away": away?.colours.primary ?? "#2a3342",
        } as React.CSSProperties
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`${styles.eyebrow} whitespace-nowrap`}>{label}</p>
        <p className="rounded-full bg-black/35 px-2.5 py-1 text-[12px] backdrop-blur">
          <GameStatus game={game} withDay />
        </p>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <Side
          align="left"
          abbr={game.away.abbr}
          name={game.away.name}
          place={game.away.place}
          score={game.away.score}
          record={records[game.away.abbr]}
        />
        <p
          className={`${styles.display} self-center pt-4 text-[18px] text-white/60`}
        >
          {game.state === "scheduled" ? "at" : "–"}
        </p>
        <Side
          align="right"
          abbr={game.home.abbr}
          name={game.home.name}
          place={game.home.place}
          score={game.home.score}
          record={records[game.home.abbr]}
        />
      </div>
      <p className="mt-4 text-[12.5px] text-white/60">
        {game.venue}
        {game.broadcasts.length
          ? ` · ${game.broadcasts.slice(0, 3).join(" · ")}`
          : ""}
      </p>
      {canNight ? (
        <div className="mt-5">
          <p className="text-[15px] font-semibold text-white/90">
            {game.away.name} at {game.home.name}
            {featured ? "? We'll be watching." : "?"} Make a night of it.
          </p>
          <CreateNightLink
            from="hero"
            gameId={game.id}
            className={`${styles.cta} mt-3 flex min-h-14 w-full items-center justify-center rounded-full text-[17px] uppercase`}
          >
            Create a Hockey Night
          </CreateNightLink>
        </div>
      ) : (
        <CreateNightLink
          from="hero"
          className={`${styles.cta} mt-5 flex min-h-14 w-full items-center justify-center rounded-full text-[17px] uppercase`}
        >
          Create a Hockey Night
        </CreateNightLink>
      )}
    </section>
  );
}
