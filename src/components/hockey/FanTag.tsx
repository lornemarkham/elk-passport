"use client";

import { createContext, useContext } from "react";
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
