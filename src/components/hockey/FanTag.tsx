"use client";

import { createContext, useContext } from "react";
import { Avatar } from "@/experience-lab/ui/atoms";
import type { Participant } from "@/experience-lab/core/types";
import { fanLabel, teamByAbbr, type NhlTeam } from "@/domain/hockey/fans";

/**
 * **Who everybody bleeds for**, handed down the night's page once so any
 * name — in the chat, the roster, a flipped pick — can wear its team beside
 * it without every component being given the map.
 */
const Fans = createContext<Readonly<Record<string, string>>>({});

export const FansProvider = Fans.Provider;

export function useFan(personId: string | undefined): NhlTeam | null {
  const fans = useContext(Fans);
  return personId ? teamByAbbr(fans[personId]) : null;
}

/**
 * A person's team as a scoreboard chip: its two colours and its code, the
 * emoji, and — where there is room — the full name. Nothing for somebody who
 * hasn't declared. Never tonight's matchup: this is who *they* cheer for.
 */
export function FanTag({
  personId,
  full = false,
  onDark = true,
}: {
  personId: string | undefined;
  /** "Calgary Flames 🔥" instead of "🔥 CGY". */
  full?: boolean;
  /** On the white back of a flipped card, the chip needs an outline. */
  onDark?: boolean;
}) {
  const team = useFan(personId);
  if (!team) return null;
  return <TeamChip team={team} full={full} onDark={onDark} />;
}

export function TeamChip({
  team,
  full = false,
  onDark = true,
}: {
  team: NhlTeam;
  full?: boolean;
  onDark?: boolean;
}) {
  return (
    <span
      title={fanLabel(team)}
      aria-label={`${team.city} ${team.name} fan`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 align-middle text-[11.5px] leading-none font-bold tracking-wide ${
        onDark ? "" : "ring-1 ring-black/15"
      }`}
      style={{
        background: team.colours.primary,
        color: team.colours.ink,
        boxShadow: `inset 0 -2px 0 ${team.colours.secondary}`,
      }}
    >
      <span aria-hidden>{team.emoji}</span>
      {full ? `${team.city} ${team.name}` : team.abbr}
    </span>
  );
}

/**
 * **A person's face on the night, wearing their team.** The lab's avatar —
 * their emoji on their own hue — inside a ring of their team's two colours,
 * with the team's mark on the corner where there's room. Somebody who hasn't
 * declared looks as they always did. Used everywhere Hockey Night shows a
 * person, so a Flames fan is a Flames fan in the roster, the chat, the vote
 * and the standings alike.
 */
export function FanAvatar({
  person,
  size = 32,
  dim = false,
  ring = false,
}: {
  person: Participant;
  size?: number;
  dim?: boolean;
  ring?: boolean;
}) {
  const team = useFan(person.id);
  if (!team)
    return <Avatar person={person} size={size} dim={dim} ring={ring} />;
  const badge = size >= 28;
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      title={`${person.name} · ${team.city} ${team.name}`}
    >
      <span
        className="inline-flex h-full w-full items-center justify-center rounded-full font-medium select-none"
        style={{
          fontSize: size * 0.5,
          background: `linear-gradient(145deg, ${team.colours.primary}, ${team.colours.secondary})`,
          boxShadow: `0 0 0 ${size >= 36 ? 2.5 : 1.5}px ${team.colours.primary}, 0 0 0 ${size >= 36 ? 4 : 2.5}px ${team.colours.secondary}`,
          opacity: dim ? 0.45 : 1,
        }}
      >
        {person.emoji}
      </span>
      {badge && (
        <span
          aria-hidden
          className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full leading-none"
          style={{
            width: size * 0.46,
            height: size * 0.46,
            fontSize: size * 0.26,
            background: team.colours.primary,
            color: team.colours.ink,
            boxShadow: `0 0 0 1.5px #0b1220`,
          }}
        >
          {team.emoji}
        </span>
      )}
    </span>
  );
}
