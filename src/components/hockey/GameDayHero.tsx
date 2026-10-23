"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, MapPin, UserPlus } from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import { relativeTime } from "@/experience-lab/core/phase";
import type { LiveExperience } from "@/experience-lab/core/engine";
import { ACTS, actOf, nextPhase } from "@/domain/hockey/acts";
import { countdown, gameWhen } from "@/domain/hockey/countdown";
import { answerText } from "@/domain/hockey/reveal";
import { matchupOf, teamColours } from "@/domain/hockey/teams";
import styles from "./hockey.module.css";

/**
 * **The matchup, the clock, and who's coming — before anything else.**
 *
 * The first screen used to be a poster with the night's name in a serif and
 * the game in small grey type under it. Now the game *is* the poster: both
 * sides in their colours, split down a rink's centre line, with puck drop
 * counting down underneath like the board over centre ice. During the game
 * the clock gives way to which period it is; after it, to the final — once
 * the host has called it, and not before, because Passport has no scores
 * feed and will not pretend to.
 *
 * Team colours and three-letter codes only (`domain/hockey/teams.ts`): no
 * logos, crests or photographs anybody would need a licence for.
 */
export function GameDayHero({
  live,
  role,
  myPicks,
  onInvite,
  onGoAgain,
}: {
  live: LiveExperience;
  role: "host" | "guest";
  /** How many of my sealed picks are in, out of how many. */
  myPicks?: { mine: number; total: number };
  onInvite?: () => void;
  onGoAgain?: () => void;
}) {
  const { definition } = live;
  const { home, away } = matchupOf(definition.subtitle);
  const homeKit = teamColours(home);
  const awayKit = teamColours(away);
  const anchor = new Date(definition.anchorAt);
  const act = actOf(live.phase.id);
  const now = useClock(anchor);

  const final = live.prompts.find((p) => p.prompt.id === "final-score");
  const finalScore =
    final?.prompt.resolution !== undefined && final.showResolution
      ? answerText(final.prompt, final.prompt.resolution)
      : null;

  const venue = definition.whereLine ?? definition.kicker;
  const matchup = useRef<HTMLDivElement>(null);
  const scrolledPast = useScrolledPast(matchup);
  const next = nextPhase(definition.phases, live.phase.id);
  const alone = live.participants.length === 1;

  return (
    <header className="text-white">
      {scrolledPast && (
        <Scoreboard
          home={homeKit}
          away={awayKit}
          status={
            act.id === "before"
              ? `Puck drop ${shortCountdown(now, anchor)}`
              : act.id === "during"
                ? live.phase.label
                : finalScore
                  ? `Final ${finalScore}`
                  : live.phase.label
          }
          live={act.id === "during"}
        />
      )}
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-1">
        <Link
          href="/hockey"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-[14px] text-white/75 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Your nights
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-white/65">
          <Lock className="h-3.5 w-3.5" />
          Invite only
        </span>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {/* The two sides: one short card, the game the poster. */}
        <div
          ref={matchup}
          className={`${styles.matchup} rounded-[22px] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]`}
          style={
            {
              "--home": homeKit.primary,
              "--away": awayKit.primary,
            } as React.CSSProperties
          }
        >
          <p className="flex items-center justify-center gap-1.5 truncate px-3 pt-2.5 text-[12px] font-semibold tracking-[0.14em] text-white/80 uppercase">
            <span aria-hidden>🏒</span>
            {definition.title}
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-3 pt-1 pb-2.5">
            <Side name={home} kit={homeKit} label="Home" />
            <div
              className={`${styles.puck} flex h-10 w-10 items-center justify-center rounded-full`}
              aria-hidden
            >
              <span className={`${styles.display} text-[16px] text-white/90`}>
                vs
              </span>
            </div>
            <Side name={away} kit={awayKit} label="Away" />
          </div>
          <p className="sr-only">{definition.subtitle}</p>
          <div
            className="flex items-center justify-center gap-1.5 border-t border-white/15 bg-black/30 px-4 py-1.5 text-[13.5px] font-medium text-white"
            title={venue}
          >
            <MapPin className="h-4 w-4 shrink-0 opacity-80" />
            <span className="truncate">
              {definition.kicker} · {gameWhen(anchor)}
            </span>
          </div>
        </div>

        {/* The board over centre ice, and who's coming, on one line before the game. */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {act.id === "before" ? (
            <>
              <Who live={live} myPicks={myPicks} />
              <PuckDrop anchor={anchor} now={now} />
            </>
          ) : (
            <div className="w-full">
              {act.id === "during" && <InGame live={live} anchor={anchor} />}
              {act.id === "after" && (
                <Final
                  score={finalScore}
                  home={homeKit.abbr}
                  away={awayKit.abbr}
                  phaseLabel={live.phase.label}
                  onGoAgain={
                    live.phase.id === "morning" || live.phase.id === "again"
                      ? onGoAgain
                      : undefined
                  }
                />
              )}
            </div>
          )}
        </div>
        {act.id !== "before" && (
          <div className="mt-2.5">
            <Who live={live} />
          </div>
        )}
        {alone && (
          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] px-4 py-2.5">
            <p className="text-[14px] leading-snug text-white/85">
              {role === "host"
                ? "Just you so far. A hockey night for one is a Tuesday."
                : "Just you so far."}
            </p>
            {role === "host" && onInvite && (
              <button
                type="button"
                onClick={onInvite}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-semibold text-[#0b1220]"
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </button>
            )}
          </div>
        )}

        {/* Passport's one line for right now: the hockey personality. */}
        <p
          className={`${styles.wide} mt-3 text-[18px] leading-[1.15] text-balance text-white`}
        >
          {live.phase.headline}
        </p>
        {live.commentary.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1" aria-label="Passport says">
            {live.commentary.slice(0, 2).map((line) => (
              <li
                key={line}
                className="flex gap-2 text-[14px] leading-snug text-white/80"
              >
                <span aria-hidden>📣</span>
                {line}
              </li>
            ))}
          </ul>
        )}

        <nav aria-label="The night" className="mt-3">
          <ol className="grid grid-cols-3 gap-1.5">
            {ACTS.map((a) => {
              const current = a.id === act.id;
              const done = ACTS.indexOf(a) < ACTS.indexOf(act);
              return (
                <li
                  key={a.id}
                  aria-current={current ? "step" : undefined}
                  className="flex flex-col gap-1"
                >
                  <span
                    className={`h-1.5 rounded-full ${
                      current
                        ? "bg-white"
                        : done
                          ? "bg-white/45"
                          : "bg-white/15"
                    }`}
                  />
                  <span
                    className={`text-[12px] font-semibold tracking-wide uppercase ${
                      current ? "text-white" : "text-white/55"
                    }`}
                  >
                    {a.label.split(" ")[0]}
                    <span className="sr-only">
                      {a.label.slice(a.label.split(" ")[0].length)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          {next && (
            <p className="mt-1.5 hidden text-[13px] text-white/60 sm:block">
              Now: {live.phase.label}. Next: {next.label}{" "}
              {relativeTime(nextAt(anchor, next.offsetMinutes), live.now)}.
            </p>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Who's coming: the faces and the count. */
function Who({
  live,
  myPicks,
}: {
  live: LiveExperience;
  myPicks?: { mine: number; total: number };
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex -space-x-1.5">
        {live.participants.slice(0, 5).map((p) => (
          <Avatar key={p.id} person={p} size={28} ring={p.id === live.me?.id} />
        ))}
      </span>
      <span className="text-[15px] font-semibold text-white">
        {live.participants.length} in
        {live.participants.length > 5 && ` · +${live.participants.length - 5}`}
        {myPicks && myPicks.total > 0 && (
          <span className="block text-[12.5px] font-medium text-white/70">
            Your picks: {myPicks.mine}/{myPicks.total} sealed
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * **The game, still there when you scroll.** A slim bar over the page once
 * the matchup has gone off the top — both codes in their colours and one
 * word of status — so a person three votes down still knows what this is.
 * Decorative for a screen reader: everything on it is in the hero.
 */
function Scoreboard({
  home,
  away,
  status,
  live,
}: {
  home: ReturnType<typeof teamColours>;
  away: ReturnType<typeof teamColours>;
  status: string;
  live: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`${styles.rise} fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#070b14]/92 pt-[env(safe-area-inset-top)] backdrop-blur-md`}
    >
      <div className="mx-auto flex h-12 max-w-2xl items-center justify-between gap-3 px-4">
        <span className="flex items-center gap-2">
          <Code kit={home} />
          <span className={`${styles.display} text-[13px] text-white/60`}>
            vs
          </span>
          <Code kit={away} />
        </span>
        <span className="flex items-center gap-2 truncate text-[13.5px] font-semibold text-white/90">
          {live && (
            <span
              className={`${styles.liveDot} h-2 w-2 rounded-full bg-[#ff4646]`}
            />
          )}
          {status}
        </span>
      </div>
    </div>
  );
}

function Code({ kit }: { kit: ReturnType<typeof teamColours> }) {
  return (
    <span
      className={`${styles.display} rounded-md px-1.5 py-0.5 text-[16px] leading-none`}
      style={{ background: kit.primary, color: kit.ink }}
    >
      {kit.abbr}
    </span>
  );
}

/** "in 3d 20h", "in 42 min", "now" — for the bar, where there is no room. */
function shortCountdown(now: Date, anchor: Date): string {
  const c = countdown(now, anchor);
  if (c.past) return "now";
  if (c.days > 0) return `in ${c.days}d ${c.hours}h`;
  if (c.hours > 0) return `in ${c.hours}h ${c.minutes}m`;
  return `in ${c.minutes} min`;
}

/** Whether the element has scrolled up and off the screen. */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}

const nextAt = (anchor: Date, offsetMinutes: number) =>
  new Date(anchor.getTime() + offsetMinutes * 60_000);

function Side({
  name,
  kit,
  label,
}: {
  name: string;
  kit: ReturnType<typeof teamColours>;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <span className="text-[12px] font-semibold tracking-[0.18em] text-white/75 uppercase">
        {label}
      </span>
      <span
        className={`${styles.display} text-[38px] leading-[0.9] drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]`}
        style={{ color: kit.ink === "#111111" ? "#111" : "#fff" }}
      >
        {kit.abbr}
      </span>
      <span
        className="mt-1 h-1 w-10 rounded-full"
        style={{ background: kit.secondary }}
        aria-hidden
      />
      <span className="mt-1 max-w-full truncate text-[14px] font-semibold text-white">
        {name}
      </span>
    </div>
  );
}

function PuckDrop({ anchor, now }: { anchor: Date; now: Date }) {
  const c = countdown(now, anchor);
  return (
    <div
      suppressHydrationWarning
      role="timer"
      aria-label={`Puck drop in ${c.units.map((u) => `${Number(u.value)} ${u.unit}`).join(" ")}`}
      className="flex items-center gap-2"
    >
      <span className="text-[12px] leading-tight font-semibold tracking-[0.12em] text-white/75 uppercase">
        Puck drop
        <br />
        in
      </span>
      <span className="flex gap-1" aria-hidden>
        {c.units.map((u) => (
          <span
            key={u.unit}
            className={`${styles.digit} flex min-w-[48px] flex-col items-center rounded-lg px-1.5 pt-1 pb-0.5`}
          >
            <span
              suppressHydrationWarning
              className={`${styles.display} text-[24px] leading-none text-[#ffd84d] tabular-nums`}
            >
              {u.value}
            </span>
            <span className="text-[12px] font-semibold tracking-wider text-white/60 uppercase">
              {u.unit}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

function InGame({ live, anchor }: { live: LiveExperience; anchor: Date }) {
  const next = nextPhase(live.definition.phases, live.phase.id);
  const nextAt = next
    ? new Date(anchor.getTime() + next.offsetMinutes * 60_000)
    : null;
  const minutes = nextAt
    ? Math.max(0, Math.round((nextAt.getTime() - live.now.getTime()) / 60_000))
    : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/35 px-4 py-3">
      <span className="flex items-center gap-2.5">
        <span
          className={`${styles.liveDot} h-2.5 w-2.5 rounded-full bg-[#ff4646]`}
          aria-hidden
        />
        <span className={`${styles.display} text-[22px] leading-none`}>
          {live.phase.label}
        </span>
      </span>
      {next && minutes !== null && (
        <span className="text-right text-[13px] leading-tight text-white/75">
          {next.label}
          <br />
          in about {minutes} min
        </span>
      )}
    </div>
  );
}

function Final({
  score,
  home,
  away,
  phaseLabel,
  onGoAgain,
}: {
  score: string | null;
  home: string;
  away: string;
  phaseLabel: string;
  onGoAgain?: () => void;
}) {
  const [h, a] = score ? score.split("–") : [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/35 px-4 py-3">
        <span className="text-[13px] font-semibold tracking-[0.14em] text-white/75 uppercase">
          {score ? "Final" : phaseLabel}
        </span>
        {score ? (
          <span
            className={`${styles.display} flex items-baseline gap-3 text-[34px] leading-none`}
            aria-label={`Final: ${home} ${h}, ${away} ${a}`}
          >
            <span className="text-[15px] text-white/70">{home}</span>
            <span className="text-[#ffd84d] tabular-nums">{h}</span>
            <span className="text-white/40">–</span>
            <span className="text-[#ffd84d] tabular-nums">{a}</span>
            <span className="text-[15px] text-white/70">{away}</span>
          </span>
        ) : (
          <span className="text-right text-[13px] text-white/70">
            Final score not called yet
          </span>
        )}
      </div>
      {onGoAgain && (
        <button
          type="button"
          onClick={onGoAgain}
          className={`${styles.wide} flex min-h-14 items-center justify-between rounded-2xl bg-[#ffd84d] px-5 text-[18px] text-[#0b1220] shadow-[0_10px_30px_-10px_rgba(255,216,77,0.6)]`}
        >
          Now go have another.
          <ArrowRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/**
 * A clock for the countdown: every second in the last hour, every fifteen
 * before that. The server's render and the first client render can differ by
 * a second, so the digits say so (`suppressHydrationWarning`) rather than
 * pretending to agree.
 */
function useClock(anchor: Date): Date {
  const [now, setNow] = useState(() => new Date());
  const at = anchor.getTime();
  useEffect(() => {
    let id = 0;
    const schedule = () => {
      const close = at - Date.now() < 3_600_000;
      id = window.setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        close ? 1000 : 15_000,
      );
    };
    schedule();
    return () => window.clearTimeout(id);
  }, [at]);
  return now;
}
