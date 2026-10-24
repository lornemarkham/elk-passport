"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Sofa, Ticket, X } from "lucide-react";
import type { Participant } from "@/experience-lab/core/types";
import { teamByAbbr, type NhlTeam } from "@/domain/hockey/fans";
import {
  WATCHING_EMOJI,
  WATCHING_LABEL,
  type Watching,
} from "@/domain/hockey/crowd";
import { FanAvatar, TeamChip } from "./FanTag";
import styles from "./hockey.module.css";

/**
 * **Declaring a team is a moment, not a setting.**
 *
 * The page fills with the team's colours, the crest lands, the colours burst
 * — and the person's own face, in their team's ring, says who they are now.
 * About two seconds, or one tap. No confetti and no motion for anyone who has
 * asked their phone for less motion: the card simply appears, and stays until
 * tapped.
 */
export function TeamMoment({
  team,
  person,
  onDone,
}: {
  team: NhlTeam;
  person: Participant;
  onDone: () => void;
}) {
  const done = useRef(onDone);
  // The page re-renders on every poll; the timer must not restart with it.
  useEffect(() => {
    done.current = onDone;
  });
  const button = useRef<HTMLButtonElement>(null);
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const angle = (i / 26) * Math.PI * 2;
        const reach = 120 + ((i * 37) % 90);
        return {
          dx: `${Math.round(Math.cos(angle) * reach)}px`,
          dy: `${Math.round(Math.sin(angle) * reach - 40)}px`,
          spin: `${(i % 2 ? 1 : -1) * (180 + ((i * 53) % 360))}deg`,
          colour:
            i % 3 === 0
              ? "#ffffff"
              : i % 2
                ? team.colours.primary
                : team.colours.secondary,
          delay: `${(i % 5) * 40}ms`,
        };
      }),
    [team],
  );

  useEffect(() => {
    button.current?.focus();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = reduced ? undefined : setTimeout(() => done.current(), 2600);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && done.current();
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${person.name} bleeds for the ${team.city} ${team.name}`}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden px-6"
      style={{
        background: `radial-gradient(120% 80% at 50% 35%, ${team.colours.primary} 0%, ${team.colours.secondary} 55%, #05080f 100%)`,
      }}
      onClick={() => done.current()}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className={styles.confetti}
          style={
            {
              background: p.colour,
              animationDelay: p.delay,
              "--dx": p.dx,
              "--dy": p.dy,
              "--spin": p.spin,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="relative flex flex-col items-center text-center">
        <span
          aria-hidden
          className={`${styles.crest} flex h-36 w-36 items-center justify-center rounded-full text-[72px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]`}
          style={{
            background: team.colours.primary,
            boxShadow: `0 0 0 6px ${team.colours.secondary}, 0 0 0 10px rgba(255,255,255,0.85), 0 24px 60px -12px rgba(0,0,0,0.7)`,
          }}
        >
          {team.emoji}
        </span>
        <p
          className={`${styles.wide} ${styles.rise} mt-8 text-[15px] tracking-[0.2em] uppercase`}
          style={{ color: team.colours.ink, animationDelay: "180ms" }}
        >
          It&apos;s official
        </p>
        <p
          className={`${styles.display} ${styles.rise} mt-2 text-[44px] leading-[0.95] text-white [text-shadow:0_3px_20px_rgba(0,0,0,0.45)]`}
          style={{ animationDelay: "260ms" }}
        >
          {team.city}
          <br />
          {team.name}
        </p>
        <span
          className={`${styles.rise} mt-6 flex items-center gap-3 rounded-full bg-black/35 py-2 pr-5 pl-2 text-white backdrop-blur`}
          style={{ animationDelay: "380ms" }}
        >
          <FanAvatar person={person} size={40} />
          <span className="text-left">
            <span className="block text-[17px] font-extrabold">
              {person.name}
            </span>
            <span className="block text-[13px] text-white/80">
              Chirp Bot has been notified.
            </span>
          </span>
        </span>
        <button
          ref={button}
          type="button"
          onClick={() => done.current()}
          className="mt-8 min-h-11 rounded-full bg-white px-6 text-[15px] font-bold text-[#0b1220]"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ welcome

const EVENT = "hockey:welcome-later";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Whether this device has put the welcome away for this night. */
export function useWelcomeDismissed(slug: string): [boolean, () => void] {
  const key = `hockey:${slug}:welcomed`;
  const dismissed = useSyncExternalStore(
    subscribe,
    // The old "Who do you bleed for?" bar's "Not now" counts too.
    () =>
      window.localStorage.getItem(key) === "1" ||
      window.localStorage.getItem(`hockey:${slug}:bleed-later`) === "1",
    () => true,
  );
  const dismiss = () => {
    window.localStorage.setItem(key, "1");
    window.dispatchEvent(new Event(EVENT));
  };
  return [dismissed, dismiss];
}

/**
 * **You're in.** The first thing a person sees on a night they haven't
 * settled into: who's going, the game, when and where — and the two things
 * that make the night theirs, each one tap: who they bleed for, and whether
 * they'll be at the arena or on the couch. Part of the page, never in front
 * of it; answering both, or ✕, puts it away.
 */
export function WelcomeCard({
  me,
  people,
  matchup,
  when,
  venue,
  team,
  watching,
  teamsOn,
  couchOn,
  onPickTeam,
  onWatching,
  onDismiss,
}: {
  me: Participant;
  people: readonly Participant[];
  matchup: string;
  when: string;
  venue: string;
  team: string | null;
  watching: Watching | null;
  teamsOn: boolean;
  couchOn: boolean;
  onPickTeam: () => void;
  onWatching: (where: Watching) => void;
  onDismiss: () => void;
}) {
  const declared = teamByAbbr(team);
  const others = people.filter((p) => p.id !== me.id);
  return (
    <section
      aria-labelledby="welcome-title"
      className={`${styles.rise} relative overflow-hidden rounded-[26px] bg-[linear-gradient(160deg,#16233a,#0b1220_70%)] p-5 ring-1 ring-[#ffd84d]/40`}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Put this away"
        className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
      <p className="text-[12px] font-bold tracking-[0.16em] text-[#ffd84d] uppercase">
        You&apos;re in
      </p>
      <h2
        id="welcome-title"
        className={`${styles.wide} mt-1 pr-10 text-[26px] leading-[1.02] text-white`}
      >
        {me.name}, it&apos;s game night.
      </h2>
      <p className="mt-2 text-[15px] leading-snug text-white/75">
        {matchup} · {when} · {venue}.{" "}
        {others.length > 0
          ? `${others.map((p) => p.name).join(", ")} ${others.length === 1 ? "is" : "are"} in.`
          : "You're first."}{" "}
        Vote on pregame, make your picks, chirp each other — the Cup goes to
        whoever&apos;s right.
      </p>
      {people.length > 1 && (
        <div className="mt-3 flex -space-x-2">
          {people.slice(0, 8).map((p) => (
            <FanAvatar key={p.id} person={p} size={34} />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {teamsOn && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-white/[0.06] px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-white">
                Who do you bleed for?
              </span>
              <span className="block text-[13px] text-white/60">
                Your team, not tonight&apos;s. Chirp Bot will have opinions.
              </span>
            </span>
            {declared ? (
              <button
                type="button"
                onClick={onPickTeam}
                aria-label={`Your team: ${declared.city} ${declared.name}. Change`}
                className="min-h-11"
              >
                <TeamChip team={declared} full />
              </button>
            ) : (
              <button
                type="button"
                onClick={onPickTeam}
                className="min-h-11 rounded-full bg-[#ffd84d] px-5 text-[15px] font-bold text-[#0b1220] transition active:scale-95"
              >
                Pick my team
              </button>
            )}
          </div>
        )}
        {couchOn && (
          <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
            <span className="block text-[15px] font-extrabold text-white">
              Where are you watching?
            </span>
            <WatchingToggle
              value={watching}
              onChange={onWatching}
              className="mt-2.5"
            />
          </div>
        )}
      </div>
    </section>
  );
}

/** At the arena or from the couch: two big buttons, one pressed. */
export function WatchingToggle({
  value,
  onChange,
  className = "",
}: {
  value: Watching | null;
  onChange: (where: Watching) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Where are you watching?"
      className={`grid grid-cols-2 gap-2 ${className}`}
    >
      {(["arena", "couch"] as const).map((where) => {
        const Icon = where === "arena" ? Ticket : Sofa;
        const on = value === where;
        return (
          <button
            key={where}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(where)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-[15px] font-bold transition active:scale-[0.97] ${
              on
                ? "bg-[#ffd84d] text-[#0b1220]"
                : "bg-white/[0.08] text-white ring-1 ring-white/15 hover:bg-white/[0.14]"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {WATCHING_LABEL[where]}
          </button>
        );
      })}
    </div>
  );
}

/** "🛋️ From the couch" as a quiet pill beside a name. */
export function WatchingPill({ where }: { where: Watching }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[12px] font-semibold text-white/75">
      <span aria-hidden>{WATCHING_EMOJI[where]}</span>
      {WATCHING_LABEL[where]}
    </span>
  );
}
