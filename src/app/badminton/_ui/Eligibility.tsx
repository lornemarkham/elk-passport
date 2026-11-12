"use client";

import { useState } from "react";
import { LEVELS } from "@/lib/courtqueue/journey";
import type { LiveView } from "@/lib/courtqueue/view";
import { Btn, Card, cx } from "./bits";

/**
 * **How courts are chosen** (owner decision 2026-11-12): one switch between
 * open play (everyone, every court — the default) and guided play (each court
 * may name a lowest level), plus the number of courts. Levels show here and
 * nowhere else, and only to the organizer, and only in guided play.
 */
export function Eligibility({
  view,
  clubAct,
}: {
  view: LiveView;
  clubAct: (cmd: object) => Promise<boolean>;
}) {
  const o = view.organizer!;
  const guided = o.mode === "guided";
  const [showPlayers, setShowPlayers] = useState(false);
  const [filter, setFilter] = useState("");
  const set = (mode: "open" | "guided") => clubAct({ type: "play-mode", mode });
  return (
    <Card>
      <h2 className="mb-1 font-bold">How courts are chosen</h2>
      <div
        role="group"
        aria-label="Play mode"
        className="mb-2 grid grid-cols-2 gap-2"
        data-testid="mode-switch"
      >
        {(
          [
            ["open", "Open play"],
            ["guided", "Guided play"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={o.mode === m}
            onClick={() => o.mode !== m && void set(m)}
            className={cx(
              "min-h-12 rounded-xl p-3 text-sm font-bold",
              o.mode === m
                ? "bg-lime-300 text-black"
                : "bg-white/10 text-white/80",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-white/70" data-testid="mode-explainer">
        {guided
          ? "Each court below can ask for a lowest level. Nobody is ever put on a court that asks for more than they have; players with more can still play the easier courts. Everything else — longest wait first, nobody stays on — works the same."
          : "Everyone is eligible for every court. Longest-waiting players go first; all four leave the court after every game."}
      </p>

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          Courts at the venue: {o.courts.length}
        </span>
        <span className="flex gap-2">
          <Btn
            kind="ghost"
            aria-label="Fewer courts"
            disabled={o.courts.length <= 1}
            onClick={() =>
              void clubAct({ type: "courts-count", count: o.courts.length - 1 })
            }
          >
            −
          </Btn>
          <Btn
            kind="ghost"
            aria-label="More courts"
            disabled={o.courts.length >= 12}
            onClick={() =>
              void clubAct({ type: "courts-count", count: o.courts.length + 1 })
            }
          >
            +
          </Btn>
        </span>
      </div>

      {guided && (
        <>
          <ul className="space-y-2" data-testid="court-eligibility">
            {o.courts.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white/5 p-2"
              >
                <span className="text-sm font-semibold">{c.name}</span>
                <select
                  aria-label={`Who may play on ${c.name}`}
                  value={c.minLevel ?? ""}
                  onChange={(e) =>
                    void clubAct({
                      type: "court",
                      court: c.id,
                      patch: { minLevel: e.target.value || null },
                    })
                  }
                  className="rounded-lg bg-white/10 p-2 text-sm"
                >
                  <option value="">Anyone</option>
                  {LEVELS.filter((l) => l.id !== "beginner").map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label} and up
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-white/60">
            A player nobody has placed counts as a beginner, so they are never
            sent to a court that asks for more.
            {o.unplacedHere > 0
              ? ` ${o.unplacedHere} here tonight ${o.unplacedHere === 1 ? "has" : "have"} no level yet.`
              : ""}
          </p>
          <Btn
            kind="ghost"
            className="mt-2"
            onClick={() => setShowPlayers((v) => !v)}
          >
            {showPlayers ? "Hide player levels" : "Set player levels"}
          </Btn>
          {showPlayers && (
            <div className="mt-2" data-testid="placements">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a player"
                className="mb-2 w-full rounded-xl bg-white/10 p-2 text-sm"
              />
              <ul className="space-y-1">
                {o.placements
                  .filter((p) =>
                    p.name.toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map((p) => (
                    <li
                      key={p.playerId}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{p.name}</span>
                      <select
                        aria-label={`Level for ${p.name}`}
                        value={p.placed ? p.level : ""}
                        onChange={(e) =>
                          void clubAct({
                            type: "place",
                            playerId: p.playerId,
                            level: e.target.value || null,
                          })
                        }
                        className="rounded-lg bg-white/10 p-1.5 text-sm"
                      >
                        <option value="">
                          {p.known ? "Their own answer" : "Not set (beginner)"}
                        </option>
                        {LEVELS.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
