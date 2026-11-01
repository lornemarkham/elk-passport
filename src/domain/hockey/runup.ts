/**
 * **The run-up: a week of reasons to open the night, none of them daily.**
 *
 * The first real Hockey Night was started two days before the game, and the
 * pregame never had time to become anything. A night started a week or more
 * out has room for the thing the lab found actually works — *questions the
 * group answers about each other* — if the page says what the week is for
 * at each point of it. So the run-up has stages, by calendar days to puck
 * drop in the arena's own zone:
 *
 *   7+ days   invitations and teams     — get everyone in, make them declare
 *   4–5 days  rivalries and early picks — enemy territory, the first bets
 *   2–3 days  trivia, chirps, dares     — Chirp Bot's questions, challenges
 *   1 day     final planning and picks  — dinner settled, every pick sealed
 *   game day  the live night
 *   after     results and memories
 *
 * Nothing here nags. A stage is a headline and a short list of what is
 * still open, worked out from what the group has actually done; a thing
 * already done is shown done, not asked again. Chirp Bot gets one line per
 * stage at most (`chirp.ts runupPlan`), and only in a room where somebody
 * has said something.
 */

export type RunupStage =
  "invite" | "rivalry" | "chirp" | "final" | "gameday" | "after";

const DAY_MS = 86_400_000;

/** Calendar days from now to puck drop, in the arena's zone (0 = game day). */
export function daysOut(now: Date, startsAt: string, timeZone: string): number {
  const dayNumber = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Math.floor(
      Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS,
    );
  };
  return dayNumber(new Date(startsAt)) - dayNumber(now);
}

export function runupStage(
  now: Date,
  startsAt: string,
  timeZone: string,
): { readonly stage: RunupStage; readonly daysOut: number } {
  const days = daysOut(now, startsAt, timeZone);
  if (now.getTime() >= Date.parse(startsAt))
    return { stage: "after", daysOut: days };
  const stage: RunupStage =
    days >= 6
      ? "invite"
      : days >= 4
        ? "rivalry"
        : days >= 2
          ? "chirp"
          : days === 1
            ? "final"
            : "gameday";
  return { stage, daysOut: days };
}

export interface StageCopy {
  readonly title: string;
  /** What this stretch of the week is for, in one line. */
  readonly line: string;
}

export const STAGE_COPY: Readonly<Record<RunupStage, StageCopy>> = {
  invite: {
    title: "Get the crew in",
    line: "Send the links. Make everyone declare who they bleed for. The arguing can't start without them.",
  },
  rivalry: {
    title: "Pick your fights",
    line: "The room knows its allegiances now. Throw a bet, make a prophecy, seal an early pick.",
  },
  chirp: {
    title: "Talk trash",
    line: "Chirp Bot is asking questions. Dares are open. Nobody's said anything true in days.",
  },
  final: {
    title: "Lock it in",
    line: "Dinner decided, meeting point set, every pick sealed. Tomorrow nobody can save you.",
  },
  gameday: {
    title: "Game day",
    line: "Picks lock at puck drop. Phones away in the periods. Have the night.",
  },
  after: {
    title: "What actually happened",
    line: "Results, the Cup, the receipts, the photos. Then run it back.",
  },
};

export type Room = "plan" | "play" | "chat" | "group";

export interface RunupItem {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
  /** Where one tap takes you to do it. */
  readonly room: Room;
}

export interface RunupFacts {
  readonly members: number;
  readonly declared: number;
  readonly myTeam: boolean;
  /** The dinner vote: people who have voted, of those who said they're coming (or everyone). */
  readonly dinnerVotes: number;
  readonly dinnerOn: boolean;
  readonly myPicks: { readonly mine: number; readonly total: number };
  readonly picksOn: boolean;
  readonly challengesOpen: number;
  readonly myChallenges: number;
  readonly challengesOn: boolean;
  readonly said: number;
  readonly isHost: boolean;
}

/**
 * What is still open at this stage, as a short list with ticks. Four items
 * at most; done things sink to the bottom; the host is asked to invite,
 * nobody else is.
 */
export function runupItems(stage: RunupStage, f: RunupFacts): RunupItem[] {
  const items: RunupItem[] = [];
  const alone = f.members < 2;
  if (f.isHost && (stage === "invite" || alone))
    items.push({
      id: "invite",
      label: alone
        ? "Invite the crew — it's just you so far"
        : `${f.members} in · invite the rest`,
      done: !alone && stage !== "invite",
      room: "group",
    });
  items.push({
    id: "team",
    label: f.myTeam
      ? `Teams declared: ${f.declared} of ${f.members}`
      : "Declare who you bleed for",
    done: f.myTeam && f.declared === f.members,
    room: "play",
  });
  if (f.dinnerOn && stage !== "invite")
    items.push({
      id: "dinner",
      label:
        f.dinnerVotes === 0
          ? "Nobody's voted on where to eat"
          : `Where we eat: ${f.dinnerVotes} ${f.dinnerVotes === 1 ? "vote" : "votes"} in`,
      done: f.dinnerVotes >= Math.max(2, f.members),
      room: "plan",
    });
  if (f.picksOn && stage !== "invite")
    items.push({
      id: "picks",
      label:
        f.myPicks.mine >= f.myPicks.total && f.myPicks.total > 0
          ? "Your picks are sealed"
          : `Seal your picks: ${f.myPicks.mine} of ${f.myPicks.total}`,
      done: f.myPicks.total > 0 && f.myPicks.mine >= f.myPicks.total,
      room: "play",
    });
  if (
    f.challengesOn &&
    !alone &&
    (stage === "rivalry" || stage === "chirp" || stage === "final")
  )
    items.push({
      id: "challenge",
      label:
        f.myChallenges > 0
          ? `You're in ${f.myChallenges} ${f.myChallenges === 1 ? "challenge" : "challenges"}`
          : f.challengesOpen > 0
            ? `${f.challengesOpen} ${f.challengesOpen === 1 ? "challenge is" : "challenges are"} on · throw one`
            : "Throw a bet at somebody",
      done: f.myChallenges > 0,
      room: "play",
    });
  if (!alone && (stage === "chirp" || stage === "rivalry"))
    items.push({
      id: "chat",
      label:
        f.said === 0
          ? "Nobody's said anything yet"
          : `${f.said} ${f.said === 1 ? "thing" : "things"} said in the chat`,
      done: f.said >= 3,
      room: "chat",
    });
  // Open things first, done things after; at most four.
  return [
    ...items.filter((i) => !i.done),
    ...items.filter((i) => i.done),
  ].slice(0, 4);
}

/** "6 days to puck drop", "Tomorrow", "Tonight". */
export function daysLine(days: number): string {
  if (days <= 0) return "Tonight";
  if (days === 1) return "Tomorrow";
  return `${days} days to puck drop`;
}
