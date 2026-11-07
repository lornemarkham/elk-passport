"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chosenFor, leading, proposalsFor } from "@/domain/snow/day";
import {
  LEAVE_IN_MINUTES,
  LUNCH_TIMES,
  channelFor,
  elapsed,
  leaveLine,
  lunchLine,
  parseStarted,
  startedKey,
  type Started,
} from "@/domain/snow/companion";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { ConditionsCard } from "./ConditionsCard";
import { TopicCard } from "./PlanTab";
import { Card, styles } from "./kit";

/** Big, glove-sized: 64 px tall, 18 px type, nothing small to hit. */
const big = `${styles.btn} min-h-16 px-4 text-lg font-bold`;

type Panel = "where" | "lunch" | "leave" | null;

function useStarted(dayId: string) {
  const [started, setStarted] = useState<Started | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reads this phone's own note of when the day began */
      setStarted(parseStarted(localStorage.getItem(startedKey(dayId))));
    } catch {
      /* private mode: the day still works, it just won't remember */
    }
    setReady(true);
  }, [dayId]);
  const write = (s: Started | null) => {
    setStarted(s);
    try {
      if (s) localStorage.setItem(startedKey(dayId), JSON.stringify(s));
      else localStorage.removeItem(startedKey(dayId));
    } catch {
      /* see above */
    }
  };
  return { started, ready, write };
}

/**
 * **START YOUR SNOW DAY — the mode change (doctrine §2.7).**
 *
 * Pressing it does not end Passport; it narrows it. The planning tabs stay
 * where they were, and this phone shows a short list of big things to do on
 * a mountain with cold hands: where am I, lunch, photo, challenge, last run,
 * heading out. The start is a note on this phone, not a fact about the crew,
 * so one person starting never starts anyone else's day.
 */
export function Companion(p: TabProps) {
  const { day, me, now } = p;
  const { started, ready, write } = useStarted(day.id);
  const [panel, setPanel] = useState<Panel>(null);
  const [sent, setSent] = useState<string | null>(null);

  const shared = !!p.shared;
  const tell = (text: string) => {
    const ok =
      channelFor(shared) === "chat"
        ? p.act({ type: "say", id: newId(), by: me.id, text })
        : p.act({ type: "announce", id: newId(), by: me.id, text });
    if (ok) setSent(text);
    return ok;
  };

  if (!ready) return null;

  if (!started)
    return (
      <div className="space-y-4">
        <Card className="space-y-4 border-[var(--sn-glow)]" data-testid="start">
          <h2 className="text-2xl font-black">Ready to ride?</h2>
          <p className="text-sm text-[var(--sn-frost)]">
            Starting puts the mountain first on this phone: the sky, where
            everyone is, lunch, a photo, then home. Everything you planned stays
            in the other tabs.
            {p.today !== day.date && day.date
              ? " (This day is set for another date. You can still start it.)"
              : ""}
          </p>
          <button
            className={`${styles.go} min-h-16 w-full rounded-full text-xl uppercase`}
            onClick={() => write({ startedAt: now.toISOString() })}
            data-testid="start-day"
          >
            Start your snow day
          </button>
        </Card>
        <ConditionsCard
          mountainName={chosenFor(day, "mountain")?.label}
          date={day.date}
          today={p.today}
          now={now}
          compact
        />
      </div>
    );

  const meal = chosenFor(day, "meals") ?? leading(day, "meals");
  const meetSpots = proposalsFor(day, "meeting");
  const ended = !!started.endedAt;

  return (
    <div className="space-y-4" data-testid="companion">
      <Card className="space-y-3 border-[var(--sn-aurora)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-black">
            {ended ? "Day's done." : "Your snow day is on"}
          </h2>
          {!ended && (
            <span
              className="text-lg font-bold tabular-nums"
              data-testid="elapsed"
            >
              {elapsed(started.startedAt, now)}
            </span>
          )}
        </div>
        {ended ? (
          <>
            <p className="text-sm">
              Your recap is waiting: photos, challenges, awards.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button className={big} onClick={() => p.go("memories")}>
                Open the recap
              </button>
              <Link
                className={`${big} inline-flex items-center justify-center`}
                href={`/snow/new?again=${day.id}`}
              >
                Plan another snow day
              </Link>
            </div>
            <button
              className="text-sm underline"
              onClick={() => write({ startedAt: started.startedAt })}
            >
              Back on the hill
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              className={big}
              onClick={() => setPanel(panel === "where" ? null : "where")}
              aria-pressed={panel === "where"}
              data-testid="big-where"
            >
              📍 I&apos;m here
            </button>
            <button
              className={big}
              onClick={() => setPanel(panel === "lunch" ? null : "lunch")}
              aria-pressed={panel === "lunch"}
              data-testid="big-lunch"
            >
              🍽️ Lunch
            </button>
            <button className={big} onClick={() => p.go("memories")}>
              📸 Photo
            </button>
            <button className={big} onClick={() => p.go("play")}>
              🏆 Challenges
            </button>
            <button
              className={big}
              onClick={() => tell("Last run! Everyone down together")}
              data-testid="big-last-run"
            >
              🏁 Last run
            </button>
            <button
              className={big}
              onClick={() => setPanel(panel === "leave" ? null : "leave")}
              aria-pressed={panel === "leave"}
              data-testid="big-leave"
            >
              🚗 Heading out
            </button>
            {shared && (
              <button
                className={`${big} col-span-2`}
                onClick={() => p.go("crew")}
              >
                💬 Crew chat
              </button>
            )}
          </div>
        )}
        {sent && !ended && (
          <p role="status" className="text-sm font-semibold" data-testid="sent">
            Sent to the crew: &ldquo;{sent}&rdquo;
          </p>
        )}
      </Card>

      {!ended && panel === "where" && (
        <Card className="space-y-3" data-testid="panel-where">
          <h3 className="text-lg font-extrabold">Where are you?</h3>
          <p className="text-sm text-[var(--sn-frost)]">
            One tap tells the crew in words. Passport doesn&apos;t read your
            position.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[...meetSpots.map((s) => s.label), "Lift base", "Lodge", "Car"]
              .filter((v, i, a) => a.indexOf(v) === i)
              .slice(0, 6)
              .map((label) => (
                <button
                  key={label}
                  className={big}
                  onClick={() => {
                    p.act({ type: "checkIn", personId: me.id, spot: label });
                    setPanel(null);
                  }}
                >
                  {label}
                </button>
              ))}
          </div>
        </Card>
      )}

      {!ended && panel === "lunch" && (
        <div className="space-y-3" data-testid="panel-lunch">
          <Card className="space-y-3">
            <h3 className="text-lg font-extrabold">
              Lunch{meal ? `: ${meal.label}` : ""}
            </h3>
            <p className="text-sm text-[var(--sn-frost)]">
              Pick a time and tell everyone in one tap.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {LUNCH_TIMES.map((t) => (
                <button
                  key={t}
                  className={big}
                  onClick={() => tell(lunchLine(t, meal?.label))}
                >
                  {t}
                </button>
              ))}
            </div>
          </Card>
          <TopicCard topic="meals" {...p} />
        </div>
      )}

      {!ended && panel === "leave" && (
        <div className="space-y-3" data-testid="panel-leave">
          <Card className="space-y-3">
            <h3 className="text-lg font-extrabold">Heading out</h3>
            <p className="text-sm text-[var(--sn-frost)]">
              Tell the crew when you&apos;re coming down, then settle tonight
              below. Whoever&apos;s driving stays alcohol-free.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {LEAVE_IN_MINUTES.map((m) => (
                <button
                  key={m}
                  className={big}
                  onClick={() => tell(leaveLine(now, m))}
                >
                  {m < 60 ? `${m} min` : "1 hour"}
                </button>
              ))}
            </div>
          </Card>
          <TopicCard topic="apres" {...p} />
          <Card className="space-y-3">
            <button
              className={`${styles.go} min-h-16 w-full rounded-full text-lg uppercase`}
              onClick={() => {
                write({ ...started, endedAt: now.toISOString() });
                setPanel(null);
              }}
              data-testid="end-day"
            >
              We&apos;re done for the day
            </button>
            <p className="text-xs text-[var(--sn-frost)]">
              Turns this into your recap. You can come back to the hill.
            </p>
          </Card>
        </div>
      )}

      {!ended && (
        <ConditionsCard
          mountainName={chosenFor(day, "mountain")?.label}
          date={day.date}
          today={p.today}
          now={now}
          compact
        />
      )}
    </div>
  );
}
