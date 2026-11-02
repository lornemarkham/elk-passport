import Link from "next/link";
import { teamByAbbr } from "@/domain/hockey/fans";
import {
  nightable,
  teamSlug,
  type LeagueGame,
  type LeagueSide,
} from "@/domain/hockey/league";
import { hockeyPath } from "@/domain/hockey/site";
import { CreateNightLink } from "./CreateNightLink";
import { LocalTime } from "./LocalTime";
import { TeamMark } from "./TeamMark";
import styles from "./site.module.css";

export type Records = Readonly<Record<string, string>>;

/** What the scoreboard says about where a game is. */
export function GameStatus({
  game,
  withDay = false,
}: {
  game: LeagueGame;
  withDay?: boolean;
}) {
  if (game.state === "live" || game.state === "intermission")
    return (
      <span className="inline-flex items-center gap-2 font-extrabold text-[color:var(--live)]">
        <span className={styles.liveDot} aria-hidden />
        {game.state === "intermission"
          ? `${game.period ?? ""} intermission`
          : `Live · ${game.period ?? ""}${game.clock ? ` ${game.clock}` : ""}`}
      </span>
    );
  if (game.state === "final")
    return (
      <span className="font-extrabold text-white/80">
        Final{game.ending && game.ending !== "REG" ? `/${game.ending}` : ""}
        {withDay && (
          <>
            {" · "}
            <LocalTime iso={game.startsAt} kind="day" />
          </>
        )}
      </span>
    );
  if (game.state === "postponed")
    return <span className="font-extrabold text-amber-300">Postponed</span>;
  return (
    <span className="font-bold text-white/85">
      <LocalTime iso={game.startsAt} kind={withDay ? "dayTime" : "time"} />
    </span>
  );
}

function TeamLine({
  side,
  other,
  game,
  record,
}: {
  side: LeagueSide;
  other: LeagueSide;
  game: LeagueGame;
  record?: string;
}) {
  const team = teamByAbbr(side.abbr);
  const started = side.score !== undefined;
  const lost =
    game.state === "final" &&
    side.score !== undefined &&
    other.score !== undefined &&
    side.score < other.score;
  const name = (
    <span className="min-w-0">
      <span
        className={`block truncate text-[16px] leading-tight font-bold ${lost ? "text-white/55" : "text-white"}`}
      >
        {side.name}
      </span>
      <span className="block truncate text-[12px] text-white/45">
        {side.place}
        {record ? ` · ${record}` : ""}
      </span>
    </span>
  );
  return (
    <div className="flex items-center gap-3">
      <TeamMark abbr={side.abbr} size={34} />
      {team ? (
        <Link
          href={hockeyPath(`/teams/${teamSlug(team)}`)}
          className="min-w-0 flex-1 hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="min-w-0 flex-1">{name}</span>
      )}
      {started && (
        <span
          className={`${styles.num} text-[28px] leading-none ${lost ? "text-white/45" : "text-white"}`}
        >
          {side.score}
        </span>
      )}
    </div>
  );
}

/**
 * One game on a scoreboard: who, where it stands, and — while it hasn't
 * started — the way to make a night of it. Away team on top, the way every
 * scoreboard in North America reads.
 */
export function GameCard({
  game,
  records = {},
  from,
  now,
  withDay = false,
  cta = true,
  className = "",
}: {
  game: LeagueGame;
  records?: Records;
  /** Which page the card is on, for the create-click event. */
  from: string;
  now: Date;
  withDay?: boolean;
  /** False where the page puts its own, bigger "make a night of it" beside the card. */
  cta?: boolean;
  className?: string;
}) {
  const canNight = cta && nightable(game, now);
  const shots =
    game.state !== "scheduled" &&
    game.away.sog !== undefined &&
    game.home.sog !== undefined
      ? `Shots ${game.away.sog}–${game.home.sog}`
      : null;
  return (
    <article
      aria-label={`${game.away.name} at ${game.home.name}`}
      className={`${styles.card} flex flex-col gap-2.5 rounded-2xl p-3.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 text-[12.5px]">
        <GameStatus game={game} withDay={withDay} />
        <span className="truncate text-white/40">
          {shots ?? game.broadcasts.slice(0, 2).join(" · ")}
        </span>
      </div>
      <TeamLine
        side={game.away}
        other={game.home}
        game={game}
        record={records[game.away.abbr]}
      />
      <TeamLine
        side={game.home}
        other={game.away}
        game={game}
        record={records[game.home.abbr]}
      />
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="min-w-0 truncate text-[12px] text-white/40">
          {game.venue}
        </span>
        {canNight && (
          <CreateNightLink
            from={from}
            gameId={game.id}
            className="shrink-0 rounded-full border border-[color:var(--gold)]/60 px-3 py-1.5 text-[12.5px] font-bold text-[color:var(--gold)] transition hover:bg-[color:var(--gold)] hover:text-[#0b1220]"
          >
            Make a night of it
          </CreateNightLink>
        )}
      </div>
    </article>
  );
}
