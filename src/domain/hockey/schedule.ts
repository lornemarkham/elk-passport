import { SYCLE_HOCKEY_NIGHT, type NightDetails } from "./night";
import type { ScheduledGame } from "./nhl";

/**
 * **Which game.** The one thing a host has to say to start a night.
 *
 * M216 wrote one night into code — Sunday 25 October, Canucks vs Wild — and
 * every "Start it" made that night again. The schema never cared: an occasion
 * has its own `starts_at` and its own `details`. So a second night is not a
 * new table or a new template. It is the same night with a different
 * opponent and a different puck drop, which is exactly how the lab described
 * a next edition ("the same definition with a later anchor").
 *
 * Set by hand, a night is a Canucks home game: "What's near the arena?"
 * measures from the venue's coordinates, and Passport knows exactly one
 * arena's. Picked from the league's schedule (`chooseScheduledGame`, since
 * 2026-11-01), a night can be any game in any arena; it simply measures
 * nothing from a building nobody has measured.
 */

export const ZONE = "America/Vancouver";

/** The other 31. Emoji are decoration, not fact; 🏒 when nobody chose one. */
export const OPPONENTS: readonly { name: string; emoji: string }[] = [
  { name: "Avalanche", emoji: "🏔️" },
  { name: "Blackhawks", emoji: "🪶" },
  { name: "Blue Jackets", emoji: "💣" },
  { name: "Blues", emoji: "🎵" },
  { name: "Bruins", emoji: "🐻" },
  { name: "Canadiens", emoji: "🔴" },
  { name: "Capitals", emoji: "🏛️" },
  { name: "Devils", emoji: "😈" },
  { name: "Ducks", emoji: "🦆" },
  { name: "Flames", emoji: "🔥" },
  { name: "Flyers", emoji: "🟠" },
  { name: "Golden Knights", emoji: "⚔️" },
  { name: "Hurricanes", emoji: "🌀" },
  { name: "Islanders", emoji: "🏝️" },
  { name: "Jets", emoji: "✈️" },
  { name: "Kings", emoji: "👑" },
  { name: "Kraken", emoji: "🦑" },
  { name: "Lightning", emoji: "⚡" },
  { name: "Mammoth", emoji: "🦣" },
  { name: "Maple Leafs", emoji: "🍁" },
  { name: "Oilers", emoji: "🛢️" },
  { name: "Panthers", emoji: "🐆" },
  { name: "Penguins", emoji: "🐧" },
  { name: "Predators", emoji: "🐯" },
  { name: "Rangers", emoji: "🗽" },
  { name: "Red Wings", emoji: "🪽" },
  { name: "Sabres", emoji: "🗡️" },
  { name: "Senators", emoji: "🎖️" },
  { name: "Sharks", emoji: "🦈" },
  { name: "Stars", emoji: "⭐" },
  { name: "Wild", emoji: "🌲" },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes east of UTC that a zone keeps at this instant (Vancouver: −420 or −480). */
function offsetAt(instant: Date, timeZone: string = ZONE): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * A wall-clock time at the arena → the instant. `("2026-10-25", "19:00")` is
 * `2026-10-26T02:00:00.000Z`: PDT until 1 November, PST after.
 */
export function vancouverInstant(date: string, time: string): Date | null {
  if (!DATE.test(date) || !TIME.test(time)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const check = new Date(naive);
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  // Twice, so an evening either side of a clock change lands correctly.
  let instant = naive - offsetAt(new Date(naive)) * 60_000;
  instant = naive - offsetAt(new Date(instant)) * 60_000;
  return new Date(instant);
}

/** The instant → what the arena's clock says: `{ date, time }`. */
export function vancouverWallClock(iso: string): {
  date: string;
  time: string;
} {
  return wallClock(iso, ZONE);
}

/** The instant → what a clock in `timeZone` says: `{ date, time }`. */
export function wallClock(
  iso: string,
  timeZone: string,
): { date: string; time: string } {
  const at = new Date(iso);
  const local = new Date(
    at.getTime() + offsetAt(at, zoneOr(timeZone)) * 60_000,
  );
  return {
    date: local.toISOString().slice(0, 10),
    time: local.toISOString().slice(11, 16),
  };
}

/** A zone Intl knows, else the arena Passport knows. */
export function zoneOr(timeZone: string | undefined): string {
  if (!timeZone) return ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return ZONE;
  }
}

/** What the start form holds: the arena's wall clock, as a host types it. */
export interface GameChoice {
  readonly opponent: string;
  readonly date: string;
  readonly time: string;
}

/**
 * What crosses the wire: the instant, already converted **in the host's
 * browser**. Not on the server, on purpose. Time-zone databases disagree
 * about British Columbia from November 2026 — this machine's Node and OS
 * (tzdata 2026c) keep UTC−7 all year, the Chromium it tests with still
 * switches to PST — and a server that converts "7pm" with one database for
 * a page that displays it with another tells the host their game is at 6.
 * Converting where it will be read keeps the host's 7pm their 7pm.
 */
export interface GameRequest {
  readonly opponent: string;
  readonly startsAt: string;
}

export function toRequest(choice: GameChoice): GameRequest | null {
  const at = vancouverInstant(choice.date, choice.time);
  return at ? { opponent: choice.opponent, startsAt: at.toISOString() } : null;
}

/** How far ahead a night can be started. A season, roughly, and then some. */
const HORIZON_DAYS = 400;

/**
 * Is this a game a night can be built around? The answer is the details the
 * night stores, or what is wrong in words a host can fix.
 */
export function chooseGame(
  choice: GameRequest,
  now: Date,
):
  | { ok: true; startsAt: string; details: NightDetails }
  | { ok: false; problem: string } {
  const opponent = choice.opponent.trim().replace(/\s+/g, " ");
  if (!opponent || opponent.length > 30)
    return { ok: false, problem: "Who are the Canucks playing?" };
  if (/^canucks$/i.test(opponent))
    return { ok: false, problem: "The Canucks can't play themselves." };
  const at = new Date(choice.startsAt);
  if (Number.isNaN(at.getTime()))
    return { ok: false, problem: "That isn't a date and time." };
  if (at.getTime() <= now.getTime())
    return { ok: false, problem: "That game has already started." };
  if (at.getTime() > now.getTime() + HORIZON_DAYS * 86_400_000)
    return { ok: false, problem: "That's further out than any schedule." };

  const known = OPPONENTS.find(
    (o) => o.name.toLowerCase() === opponent.toLowerCase(),
  );
  return {
    ok: true,
    startsAt: at.toISOString(),
    details: {
      ...SYCLE_HOCKEY_NIGHT.details,
      opponent: known?.name ?? opponent,
      opponentEmoji: known?.emoji ?? "🏒",
    },
  };
}

/**
 * A night built on one of the league's games: both sides by name, the arena
 * and its zone from the league, the game's own id so the live score is that
 * game's and no other. Coordinates only where Passport has measured the
 * arena (`night.ts venuePoint`): nothing is ever measured from the wrong
 * building. Regular season and playoffs only; the game must be ahead.
 */
export function chooseScheduledGame(
  game: ScheduledGame,
  now: Date,
):
  | { ok: true; startsAt: string; details: NightDetails }
  | { ok: false; problem: string } {
  const at = new Date(game.startsAt);
  if (Number.isNaN(at.getTime()))
    return { ok: false, problem: "That isn't a date and time." };
  if (at.getTime() <= now.getTime())
    return { ok: false, problem: "That game has already started." };
  if (at.getTime() > now.getTime() + HORIZON_DAYS * 86_400_000)
    return { ok: false, problem: "That's further out than any schedule." };
  if (game.gameType !== 2 && game.gameType !== 3)
    return { ok: false, problem: "Preseason doesn't count. Pick a real one." };
  if (!game.home.name || !game.away.name)
    return { ok: false, problem: "The league hasn't said who's playing." };
  const known = OPPONENTS.find((o) => o.name === game.away.name);
  const rogers =
    game.home.abbr === "VAN" || game.venue === SYCLE_HOCKEY_NIGHT.details.venue;
  return {
    ok: true,
    startsAt: at.toISOString(),
    details: {
      home: game.home.name,
      opponent: game.away.name,
      opponentEmoji: known?.emoji ?? "🏒",
      venue: game.venue || `${game.home.place} home arena`,
      city: game.home.place || SYCLE_HOCKEY_NIGHT.details.city,
      ...(rogers ? { venueAt: SYCLE_HOCKEY_NIGHT.details.venueAt } : {}),
      homeAbbr: game.home.abbr,
      awayAbbr: game.away.abbr,
      nhlGameId: game.id,
      timeZone: zoneOr(game.timeZone),
    },
  };
}

/**
 * What the start form offers before anybody touches it: the night M216 was
 * for while it is still ahead, otherwise a week from today at seven.
 */
export function suggestedGame(now: Date): GameChoice {
  const planned = new Date(SYCLE_HOCKEY_NIGHT.startsAt);
  if (planned.getTime() > now.getTime()) {
    return {
      opponent: SYCLE_HOCKEY_NIGHT.details.opponent,
      ...vancouverWallClock(SYCLE_HOCKEY_NIGHT.startsAt),
    };
  }
  const { date } = vancouverWallClock(
    new Date(now.getTime() + 7 * 86_400_000).toISOString(),
  );
  return { opponent: "", date, time: "19:00" };
}

/**
 * What "Run it back" offers: the lab's next edition — _"A fortnight later,
 * same people, nothing yet decided"_ — at the same time of day. Nobody knows
 * the opponent yet, so it does not pretend to.
 */
export function nextGameAfter(
  startsAt: string,
  now: Date = new Date(0),
): GameChoice {
  const { time } = vancouverWallClock(startsAt);
  // A fortnight on — or, when that has already gone by (the night is being
  // run back weeks later), a week from today, because a game that is over
  // cannot be started and the form should open on one that can.
  const fortnight = new Date(new Date(startsAt).getTime() + 14 * 86_400_000);
  const base =
    fortnight.getTime() > now.getTime()
      ? fortnight
      : new Date(now.getTime() + 7 * 86_400_000);
  const { date } = vancouverWallClock(base.toISOString());
  return { opponent: "", date, time };
}

/**
 * A night is behind you once the evening it describes is over. The final
 * horn is about 2¾ hours after puck drop, and nobody is still deciding where
 * to go at 3am — so six hours.
 */
export const OVER_AFTER_MS = 6 * 3600e3;

export function isOver(startsAt: string, now: Date): boolean {
  return now.getTime() > new Date(startsAt).getTime() + OVER_AFTER_MS;
}
