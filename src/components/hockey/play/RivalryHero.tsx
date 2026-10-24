"use client";

import type { Participant } from "@/experience-lab/core/types";
import type { Rivalry } from "@/domain/hockey/challenges";
import { FanAvatar, TeamChip } from "../FanTag";
import styles from "../hockey.module.css";

/**
 * **The first thing PLAY says: what tonight's allegiances add up to.**
 * A fan of a team that isn't playing turns the page into enemy territory
 * in their team's colours; a split room is a house divided; nobody declared
 * is a question. Every word comes from `rivalryFor`, built from what people
 * actually picked. The buttons start something with a real person.
 */
export function RivalryHero({
  rivalry,
  me,
  people,
  homeColour,
  awayColour,
  myTeamDeclared,
  onChallenge,
  onDefend,
  onBet,
  onPickTeam,
}: {
  rivalry: Rivalry;
  me: Participant;
  people: readonly Participant[];
  homeColour: string;
  awayColour: string;
  myTeamDeclared: boolean;
  /** Challenge the person the banner is about. */
  onChallenge?: (personId: string) => void;
  /** I'm the outsider: defend myself, first. */
  onDefend?: () => void;
  /** Bet somebody. */
  onBet?: () => void;
  onPickTeam?: () => void;
}) {
  const about = rivalry.about
    ? people.find((p) => p.id === rivalry.about)
    : undefined;
  const isMe = about?.id === me.id;
  const a = rivalry.team?.colours.primary ?? homeColour;
  const b = rivalry.team?.colours.secondary ?? awayColour;

  return (
    <section
      aria-labelledby="rivalry-title"
      className={`${styles.territory} ${styles.rise} rounded-[28px] px-5 pt-5 pb-5 text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/15`}
      style={{ ["--team-a" as string]: a, ["--team-b" as string]: b }}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold tracking-[0.2em] text-[#ffd84d] uppercase [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
            {rivalry.kicker}
          </p>
          <h2
            id="rivalry-title"
            className={`${styles.display} mt-2 text-[38px] leading-[0.9] [overflow-wrap:anywhere] [text-shadow:0_3px_18px_rgba(0,0,0,0.45)] sm:text-[48px]`}
          >
            {rivalry.title}
          </h2>
        </div>
        {about && (
          <span className={`${styles.crest} mt-1 shrink-0`}>
            <FanAvatar person={about} size={64} />
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {rivalry.lines.map((line) => (
          <p
            key={line}
            className="text-[16.5px] leading-snug font-semibold text-white/95 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]"
          >
            {line}
          </p>
        ))}
      </div>
      {(rivalry.team || rivalry.feud) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {rivalry.team && <TeamChip team={rivalry.team} full />}
          {rivalry.feud && (
            <span className="rounded-full bg-black/35 px-3 py-1 text-[12.5px] font-semibold text-white/90">
              History: {rivalry.feud}
            </span>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!myTeamDeclared && onPickTeam && (
          <button
            type="button"
            onClick={onPickTeam}
            className={`${styles.display} min-h-12 rounded-2xl bg-[#ffd84d] px-5 text-[19px] text-[#0b1220] active:scale-[0.98]`}
          >
            Pick your team
          </button>
        )}
        {isMe && onDefend && (
          <button
            type="button"
            onClick={onDefend}
            className={`${styles.display} min-h-12 rounded-2xl bg-[#ffd84d] px-5 text-[19px] text-[#0b1220] active:scale-[0.98]`}
          >
            Defend yourself
          </button>
        )}
        {about && !isMe && onChallenge && (
          <button
            type="button"
            onClick={() => onChallenge(about.id)}
            className={`${styles.display} min-h-12 rounded-2xl bg-[#ffd84d] px-5 text-[19px] text-[#0b1220] active:scale-[0.98]`}
          >
            Challenge {about.name}
          </button>
        )}
        {onBet && people.length > 1 && (
          <button
            type="button"
            onClick={onBet}
            className={`${styles.display} min-h-12 rounded-2xl bg-black/35 px-5 text-[19px] text-white ring-1 ring-white/30 active:scale-[0.98]`}
          >
            {isMe ? "Go on the attack" : "Make a bet"}
          </button>
        )}
      </div>
    </section>
  );
}
