import type { NhlGame } from "@/domain/hockey/nhl";
import styles from "./hockey.module.css";

/**
 * **The league's scoreboard, small.** Shown only once a game is on or over,
 * and only when the league's record matched this night's game. It says whose
 * word it is, because the group's own picks are the game and this is a fact
 * beside them.
 */
export function NhlBoard({
  game,
  home,
  away,
}: {
  game: NhlGame;
  home: string;
  away: string;
}) {
  if (game.state === "scheduled") return null;
  const status =
    game.state === "final"
      ? game.ending === "SO"
        ? "Final · shootout"
        : game.ending === "OT"
          ? "Final · overtime"
          : "Final"
      : game.state === "intermission"
        ? `After the ${game.period ?? "period"}`
        : `${game.period ?? ""}${game.clock ? ` · ${game.clock}` : ""}`.trim();
  const last = game.goals[game.goals.length - 1];
  return (
    <section
      aria-label="The NHL scoreboard"
      className="mt-2.5 rounded-2xl bg-black/35 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.12em] text-white/75 uppercase">
          {game.state !== "final" && (
            <span
              className={`${styles.liveDot} h-2.5 w-2.5 rounded-full bg-[#ff4646]`}
              aria-hidden
            />
          )}
          {status}
        </span>
        <span
          className={`${styles.display} flex items-baseline gap-2.5 text-[30px] leading-none`}
          aria-label={`${home} ${game.home.score}, ${away} ${game.away.score}`}
        >
          <span className="text-[14px] text-white/70">{home}</span>
          <span className="text-[#ffd84d] tabular-nums">{game.home.score}</span>
          <span className="text-white/40">–</span>
          <span className="text-[#ffd84d] tabular-nums">{game.away.score}</span>
          <span className="text-[14px] text-white/70">{away}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] text-white/60">
        {last
          ? `Last goal: ${last.scorer}, ${last.period} ${last.time}. `
          : "No goals yet. "}
        From the NHL.
      </p>
    </section>
  );
}
