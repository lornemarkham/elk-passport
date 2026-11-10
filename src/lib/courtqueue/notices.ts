import { weekdayLabel } from "./clock";
import { mentions, type ChatMessage } from "./chat";
import { MINUTE, filled, type Club, type Session } from "./model";
import { hoursLabel, registrationOpensAt, registrationState } from "./schedule";

/**
 * **What a phone is told, and when.** Pure: given the night before and after
 * a change (or the night and the time), the messages to send and to whom.
 * `push.ts` delivers them. The app never depends on them — every phone also
 * polls and shows the same thing on screen — so a missed push costs a few
 * seconds, never a turn.
 */

export interface Notice {
  readonly to: readonly string[];
  readonly title: string;
  readonly body: string;
  /** Same tag replaces an earlier notification instead of stacking. */
  readonly tag: string;
  /**
   * "court" (the default) is the game night itself; "chat" is the Clubhouse.
   * A player allows each on its own (`NotifyPrefs`), so a muted Clubhouse
   * never costs anyone a court call.
   */
  readonly kind?: "court" | "chat";
  /** Chat only: also everyone who asked for every message, bar these. */
  readonly everyone?: { readonly except: readonly string[] };
}

const first = (club: Club, id: string | null) =>
  (id && club.players[id]?.name.split(" ")[0]) || "someone";

/** Messages caused by one change to a night. */
export function changeNotices(
  club: Club,
  before: Session,
  after: Session,
): Notice[] {
  const out: Notice[] = [];
  // Called to a court — including a filled-in fourth.
  for (const g of after.games) {
    if (g.status !== "called") continue;
    const was = before.games.find((x) => x.id === g.id);
    const fresh = filled(g.slots).filter(
      (id) => !was || was.status !== "called" || !was.slots.includes(id),
    );
    if (!fresh.length) continue;
    for (const id of fresh) {
      const others = filled(g.slots)
        .filter((x) => x !== id)
        .map((x) => first(club, x));
      out.push({
        to: [id],
        title: `COURT ${g.court} — YOU'RE UP!`,
        body: `With ${others.join(", ")}. Head to court ${g.court} and tap START GAME.`,
        tag: `up-${after.id}`,
      });
    }
  }
  // Off the waitlist.
  const promoted = after.roster
    .filter(
      (r) =>
        r.status === "confirmed" &&
        before.roster.find((b) => b.playerId === r.playerId)?.status ===
          "waitlist",
    )
    .map((r) => r.playerId);
  if (promoted.length)
    out.push({
      to: promoted,
      title: "You're in tonight! 🏸",
      body: `A spot opened up for ${weekdayLabel(after.date)}, ${hoursLabel(after.date)}. See you there.`,
      tag: `in-${after.id}`,
    });
  // Invited to a game with friends.
  for (const c of after.challenges) {
    if (before.challenges.some((x) => x.id === c.id)) continue;
    const to = c.slots.filter((id) => id !== c.by);
    out.push({
      to,
      title: "A game invite 🏸",
      body: `${first(club, c.by)} would love a game with you. Open CourtQueue to say yes — or not tonight, no problem.`,
      tag: `challenge-${c.id}`,
    });
  }
  return out;
}

export const SLOW_START_MS = 5 * MINUTE;

/**
 * Reminders that time alone makes due: a called court nobody has started, a
 * game running long. Each has a key, recorded in `notified` when sent, so it
 * goes once.
 */
export function dueReminders(
  club: Club,
  s: Session,
  now: number,
): { key: string; notice: Notice }[] {
  if (s.status !== "live") return [];
  const sent = s.notified ?? {};
  const out: { key: string; notice: Notice }[] = [];
  for (const g of s.games) {
    const four = filled(g.slots);
    if (
      g.status === "called" &&
      four.length === 4 &&
      now - g.calledAt >= SLOW_START_MS &&
      !sent[`slow:${g.id}`]
    )
      out.push({
        key: `slow:${g.id}`,
        notice: {
          to: four.filter((id) => !g.accepted[id]),
          title: `Court ${g.court} is waiting for you`,
          body: "Your game was called. Head over and tap START GAME — or Not this one.",
          tag: `up-${s.id}`,
        },
      });
    if (
      g.status === "playing" &&
      g.startedAt &&
      now - g.startedAt >= club.rules.longGameMinutes * MINUTE &&
      !sent[`long:${g.id}`]
    )
      out.push({
        key: `long:${g.id}`,
        notice: {
          to: four,
          title: `Still playing on court ${g.court}?`,
          body: "If you've finished, tap FINISH GAME so the next four can play.",
          tag: `long-${g.id}`,
        },
      });
  }
  return out.filter((r) => r.notice.to.length > 0);
}

/**
 * "Sign-up is open" — once, on the day, to everyone who allowed
 * notifications and isn't signed up yet. Only before the night starts:
 * a late reminder would be noise.
 */
export function openingNotice(
  club: Club,
  s: Session,
  subscribers: readonly string[],
  now: number,
): Notice | null {
  if (s.notified?.open) return null;
  if (registrationState(s.date, now, club.cancelled) !== "open") return null;
  if (now - registrationOpensAt(s.date) > 10 * 60 * MINUTE) return null;
  const signed = new Set(
    s.roster
      .filter((r) => r.status === "confirmed" || r.status === "waitlist")
      .map((r) => r.playerId),
  );
  const to = subscribers.filter(
    (id) => Object.hasOwn(club.players, id) && !signed.has(id),
  );
  const left = club.rules.capacity - signed.size;
  return {
    to,
    title: "Badminton tonight — sign-up is open",
    body: `${weekdayLabel(s.date)}, ${hoursLabel(s.date)}. ${left > 0 ? `${left} spots` : "Waitlist only"} — first come, first served.`,
    tag: `open-${s.id}`,
  };
}

/**
 * A Clubhouse message, as a notification: to whoever is `@mentioned`, and to
 * everyone who chose "every message". Challenge announcements add nobody
 * directly — the players challenged already get "A game invite".
 */
export function chatNotice(
  club: Club,
  m: ChatMessage,
  headline?: string,
  invited: readonly string[] = [],
): Notice {
  const who = first(club, m.by);
  const body = (headline ?? m.text).slice(0, 110);
  return {
    kind: "chat",
    to:
      m.kind === "text"
        ? mentions(club, m.text).filter((id) => id !== m.by)
        : [],
    everyone: { except: [m.by, ...invited] },
    title:
      m.kind === "text"
        ? `${who} in the Clubhouse`
        : `${who} sent a game invite 🏸`,
    body,
    tag: "clubhouse",
  };
}
