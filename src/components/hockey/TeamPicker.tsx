"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { NHL_TEAMS, teamByAbbr } from "@/domain/hockey/fans";
import { TeamChip } from "./FanTag";
import styles from "./hockey.module.css";

/**
 * **WHO DO YOU BLEED FOR?** — all 32, in the teams' own colours.
 *
 * A sheet over the night, never a gate in front of it: close it and nothing
 * is lost. Says outright that this is your team, not tonight's game, so a
 * Flames fan at a Canucks game doesn't think they are being asked to pick a
 * side in it.
 */
export function TeamPicker({
  current,
  onPick,
  onClose,
}: {
  current: string | null;
  onPick: (team: string | null) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const now = teamByAbbr(current);

  useEffect(() => {
    dialog.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const said = filter.trim().toLowerCase();
  const shown = said
    ? NHL_TEAMS.filter((t) =>
        `${t.city} ${t.name} ${t.abbr}`.toLowerCase().includes(said),
      )
    : NHL_TEAMS;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bleed-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[#0b1220] text-white ring-1 ring-white/15 outline-none sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2
              id="bleed-title"
              className={`${styles.wide} text-[30px] leading-none text-white`}
            >
              WHO DO YOU BLEED FOR?
            </h2>
            <p className="mt-2 text-[14.5px] text-white/70">
              Your team — not tonight&apos;s game. Change it any time; Chirp Bot
              will notice.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 ring-1 ring-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find your team"
            aria-label="Find your team"
            className="min-h-11 w-full rounded-full bg-white/[0.08] px-4 text-[16px] text-white ring-1 ring-white/15 outline-none placeholder:text-white/50 focus:ring-white/45"
          />
        </div>

        <ul
          role="radiogroup"
          aria-label="NHL teams"
          className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto px-5 py-4"
        >
          {shown.map((team) => {
            const chosen = team.abbr === current;
            return (
              <li key={team.abbr}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={`${team.city} ${team.name}`}
                  onClick={() => onPick(team.abbr)}
                  className={`flex min-h-14 w-full items-center gap-2 rounded-2xl px-3 py-2 text-left transition active:scale-[0.98] ${
                    chosen ? "ring-2 ring-[#ffd84d]" : "ring-1 ring-white/10"
                  }`}
                  style={{
                    background: team.colours.primary,
                    color: team.colours.ink,
                    boxShadow: `inset -12px 0 0 ${team.colours.secondary}`,
                  }}
                >
                  <span aria-hidden className="text-[22px]">
                    {team.emoji}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[12px] font-semibold opacity-85">
                      {team.city}
                    </span>
                    <span className="block truncate text-[15px] font-bold">
                      {team.name}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="col-span-2 text-[14px] text-white/60">
              No NHL team by that name. Yet.
            </li>
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {now ? (
            <span className="flex min-w-0 items-center gap-2 text-[14px] text-white/70">
              Now: <TeamChip team={now} full />
            </span>
          ) : (
            <span className="text-[14px] text-white/60">
              No team yet. Neutral is a choice too. A weak one.
            </span>
          )}
          {now && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="min-h-11 shrink-0 text-[14px] text-white/65 underline-offset-2 hover:underline"
            >
              No team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
