"use client";

import { useEffect, useMemo, useState } from "react";
import { MODULE_IDS, type ModuleId } from "@/domain/hockey/modules";
import { NHL_TEAMS } from "@/domain/hockey/fans";
import type { ScheduledGame } from "@/domain/hockey/nhl";
import { teamColours } from "@/domain/hockey/teams";
import { ModuleToggles } from "./Modules";
import {
  OPPONENTS,
  toRequest,
  zoneOr,
  type GameChoice,
} from "@/domain/hockey/schedule";
import styles from "./hockey.module.css";

const field =
  "mt-1.5 block w-full min-w-0 rounded-full border border-white/20 bg-black/20 px-4 py-2.5 text-[15px] text-white focus:border-white/50 focus:outline-none [color-scheme:dark]";

/**
 * **Which game, and what should everyone call you.** That is the whole form.
 *
 * Not a create-an-event form. The night is already written — the questions,
 * the jokes, the toy box, the awards — so the host says only the things
 * Passport cannot know: which game, and their name. Everything else is the
 * same night it always is, which is the point of a tradition.
 *
 * Since 2026-11-01 the game is **picked from the league's own schedule**:
 * any of the next three weeks' games, any two teams, any arena — the night
 * then carries the league's id, so the live score is that game's and no
 * other. When the league can't be reached, or the game isn't listed, a
 * Canucks home game can still be set by hand, as before.
 *
 * `after` makes it the next night of a run ("Run it back"): same Cup, fresh
 * points, last time's receipts on the page.
 */
export function StartNight({
  suggestion,
  name,
  after,
  modules: initialModules = MODULE_IDS,
  cta,
}: {
  suggestion: GameChoice;
  name: string;
  after?: string;
  /** What starts ticked: everything, or — running it back — last time's. */
  modules?: readonly ModuleId[];
  cta: string;
}) {
  const [games, setGames] = useState<ScheduledGame[] | null>(null);
  const [leagueDown, setLeagueDown] = useState(false);
  const [team, setTeam] = useState<string>("");
  const [gameId, setGameId] = useState<number | null>(null);
  const [byHand, setByHand] = useState(false);
  const [opponent, setOpponent] = useState(suggestion.opponent);
  const [date, setDate] = useState(suggestion.date);
  const [time, setTime] = useState(suggestion.time);
  // Asked here for the same reason the join page asks: the host's name is on
  // the roster, on the leaderboard and in "Will ___ buy a $19 arena beer?",
  // and an email address in that blank is not a joke anybody laughs at.
  const [hostName, setHostName] = useState(name);
  const [cup, setCup] = useState("");
  const [modules, setModules] = useState<ModuleId[]>([...initialModules]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    fetch("/hockey/api/games", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { available?: boolean; games?: ScheduledGame[] } | null) => {
        if (gone) return;
        if (!body?.available || !Array.isArray(body.games)) {
          setLeagueDown(true);
          setGames([]);
          setByHand(true);
          return;
        }
        setGames(body.games);
        if (body.games.length === 0) setByHand(true);
      })
      .catch(() => {
        if (gone) return;
        setLeagueDown(true);
        setGames([]);
        setByHand(true);
      });
    return () => {
      gone = true;
    };
  }, []);

  const shown = useMemo(() => {
    const all = games ?? [];
    const mine = team
      ? all.filter((g) => g.home.abbr === team || g.away.abbr === team)
      : all;
    return mine.slice(0, team ? 40 : 60);
  }, [games, team]);

  const chosen = shown.find((g) => g.id === gameId) ?? null;

  async function start() {
    setError(null);
    let game: { nhlGameId: number } | { opponent: string; startsAt: string };
    if (!byHand) {
      if (!gameId) {
        setError("Pick a game first.");
        return;
      }
      game = { nhlGameId: gameId };
    } else {
      // Converted here, by the same time-zone database that will display it.
      const request = toRequest({ opponent, date, time });
      if (!request) {
        setError("That isn't a date and time.");
        return;
      }
      game = request;
    }
    setStarting(true);
    const res = await fetch("/hockey/api/occasions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: hostName.trim() || undefined,
        game,
        after,
        modules,
        ...(cup.trim() && !after ? { cup: cup.trim() } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Couldn't start it.");
      setStarting(false);
      return;
    }
    window.location.href = `/hockey/${body.id}`;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      {!byHand && (
        // min-w-0: a fieldset's minimum width is its content's, so without
        // this a long option widens the whole page on a phone.
        <fieldset className="min-w-0">
          <legend className="text-[13px] text-white/55">
            Which game
            {games === null && (
              <span className="ml-2 text-white/35">asking the league…</span>
            )}
          </legend>
          {games && games.length > 0 && (
            <>
              <label className="mt-1.5 block text-[13px] text-white/55">
                <span className="sr-only">Team</span>
                <select
                  value={team}
                  onChange={(e) => {
                    setTeam(e.target.value);
                    setGameId(null);
                  }}
                  aria-label="Team"
                  className={field}
                >
                  <option value="">Any team · the next three weeks</option>
                  {NHL_TEAMS.map((t) => (
                    <option key={t.abbr} value={t.abbr}>
                      {t.city} {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <ul
                aria-label="Upcoming games"
                className={`${styles.noScrollbar} mt-2 flex max-h-[19rem] flex-col gap-1.5 overflow-y-auto pr-0.5`}
              >
                {shown.length === 0 && (
                  <li className="rounded-2xl bg-white/[0.05] px-4 py-3 text-[14px] text-white/60">
                    Nothing for them in the next three weeks.
                  </li>
                )}
                {shown.map((g) => (
                  // min-w-0: a flex item will not shrink below its content
                  // otherwise, and a long arena name then widens the page.
                  <li key={g.id} className="min-w-0">
                    <GameOption
                      game={g}
                      chosen={gameId === g.id}
                      onChoose={() => setGameId(g.id)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={() => setByHand(true)}
            className="mt-2 min-h-10 text-[13px] text-white/55 underline underline-offset-2"
          >
            Not listed? Set a Canucks home game by hand
          </button>
        </fieldset>
      )}

      {byHand && (
        <fieldset className="min-w-0">
          <legend className="text-[13px] text-white/55">
            {leagueDown
              ? "The league's schedule isn't answering, so: "
              : "By hand: "}
            a Canucks home game
          </legend>
          <label className="mt-1.5 block text-[13px] text-white/55">
            Canucks vs
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              list="hockey-opponents"
              maxLength={30}
              placeholder="Who are they playing?"
              aria-label="Opponent"
              className={field}
            />
            <datalist id="hockey-opponents">
              {OPPONENTS.map((o) => (
                <option key={o.name} value={o.name} />
              ))}
            </datalist>
          </label>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-2">
            <label className="block text-[13px] text-white/55">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Game date"
                className={field}
              />
            </label>
            <label className="block text-[13px] text-white/55">
              Puck drop
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Puck drop time"
                className={field}
              />
            </label>
          </div>
          <p className="mt-1.5 text-[12px] text-white/35">
            Rogers Arena, Vancouver time. Passport only knows how far things are
            from this one arena.
          </p>
          {games && games.length > 0 && (
            <button
              type="button"
              onClick={() => setByHand(false)}
              className="mt-2 min-h-10 text-[13px] text-white/55 underline underline-offset-2"
            >
              Back to the league&apos;s schedule
            </button>
          )}
        </fieldset>
      )}

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-[13px] text-white/55">
          What&apos;s in it — the chat and the Cup always are
        </legend>
        <ModuleToggles on={modules} onChange={setModules} />
      </fieldset>
      <label className="mt-4 block text-[13px] text-white/55">
        What should everyone call you?
        <input
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          maxLength={40}
          aria-label="Your name"
          className={field}
        />
      </label>
      {!after && (
        <label className="mt-3 block text-[13px] text-white/55">
          What&apos;s your trophy called? (optional)
          <input
            value={cup}
            onChange={(e) => setCup(e.target.value)}
            maxLength={40}
            placeholder="The Office Cup"
            aria-label="Trophy name"
            className={field}
          />
        </label>
      )}
      <button
        type="submit"
        disabled={starting || (!byHand && !chosen)}
        className="mt-4 w-full rounded-full bg-white py-3 text-[15px] font-semibold text-black disabled:opacity-50"
      >
        {starting ? "Starting…" : cta}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-[#ffb4b4]">
          {error}
        </p>
      )}
    </form>
  );
}

/** "Wild at Canucks · Sun, Nov 8 · 7:00 p.m. · Rogers Arena", in the arena's own time. */
function GameOption({
  game,
  chosen,
  onChoose,
}: {
  game: ScheduledGame;
  chosen: boolean;
  onChoose: () => void;
}) {
  const home = teamColours(game.home.name);
  const away = teamColours(game.away.name);
  const at = new Date(game.startsAt);
  const zone = zoneOr(game.timeZone);
  const day = at.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: zone,
  });
  const clock = at.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
    timeZoneName: "short",
  });
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onChoose}
      className={`flex min-h-14 w-full max-w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${
        chosen
          ? "bg-white text-[#0b1220] ring-2 ring-[#ffd84d]"
          : "bg-white/[0.06] text-white ring-1 ring-white/12 hover:bg-white/[0.1]"
      }`}
    >
      <span className="flex shrink-0 items-center gap-1">
        <Code abbr={away.abbr} primary={away.primary} ink={away.ink} />
        <span
          className={`text-[11px] ${chosen ? "text-[#0b1220]/60" : "text-white/50"}`}
        >
          at
        </span>
        <Code abbr={home.abbr} primary={home.primary} ink={home.ink} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {game.away.name} at {game.home.name}
        </span>
        <span
          className={`block truncate text-[12.5px] ${chosen ? "text-[#0b1220]/65" : "text-white/55"}`}
        >
          {day} · {clock} · {game.venue || `${game.home.place}`}
        </span>
      </span>
    </button>
  );
}

function Code({
  abbr,
  primary,
  ink,
}: {
  abbr: string;
  primary: string;
  ink: string;
}) {
  return (
    <span
      className={`${styles.display} rounded-md px-1.5 py-0.5 text-[13px] leading-none`}
      style={{ background: primary, color: ink }}
    >
      {abbr}
    </span>
  );
}
