"use client";

import { useState } from "react";
import {
  CATEGORY_LABEL,
  CHALLENGE_CATEGORIES,
  CHALLENGES,
  CUSTOM_POINTS,
  challengeById,
  offeredTo,
} from "@/domain/snow/challenges";
import { ABILITY_LABEL } from "@/domain/snow/ability";
import { awards, standings } from "@/domain/snow/scoring";
import { POINTS } from "@/domain/snow/scoring";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, btn, btnOn, field } from "./kit";

/**
 * **Challenges and the table.** Optional, level-aware, and incapable of
 * paying for speed or risk: see `domain/snow/challenges.ts`.
 */
export function PlayTab({ day, me, act }: TabProps) {
  const [who, setWho] = useState(me.id);
  const [custom, setCustom] = useState("");
  const table = standings(day);
  const prizes = awards(day);
  const target = day.people.find((p) => p.id === who) ?? me;
  const offered = offeredTo(
    target.discipline === "apres" ? undefined : target.ability,
  );
  const customs = day.customChallenges.flatMap(
    (c) => challengeById(c.id, day.customChallenges) ?? [],
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">Friendly competition</h2>
          <button
            className={`${btn} ${day.challengesOn ? btnOn : ""}`}
            aria-pressed={day.challengesOn}
            onClick={() => act({ type: "challenges", on: !day.challengesOn })}
          >
            {day.challengesOn ? "Challenges on" : "Challenges off"}
          </button>
        </div>
        <p className="text-sm text-[var(--sn-frost)]">
          Totally optional. Points are for safe challenges, showing up (+
          {POINTS.showedUp}), photos (+{POINTS.photo}, up to {POINTS.photoCap})
          and shared moments (+{POINTS.moment}, up to {POINTS.momentCap}). Never
          for speed, steepness, jumps or breaking a mountain rule. Switch it off
          and the day is just a day.
        </p>
      </Card>

      {day.challengesOn && (
        <>
          <Card className="space-y-2" data-testid="standings">
            <h2 className="text-xl font-extrabold">Standings</h2>
            <ol className="space-y-1">
              {table.map((s) => (
                <li
                  key={s.person.id}
                  className="flex items-center justify-between rounded-lg bg-[var(--sn-ice)]/5 px-3 py-2"
                >
                  <span>
                    <span className="mr-3 font-black text-[var(--sn-glow)]">
                      {s.rank}
                    </span>
                    {s.person.name}
                  </span>
                  <span className="font-bold tabular-nums">{s.points} pts</span>
                </li>
              ))}
            </ol>
            {prizes.length > 0 && (
              <ul className="space-y-1 pt-2 text-sm" data-testid="awards">
                {prizes.map((a) => (
                  <li key={a.id}>
                    {a.emoji} <strong>{a.title}</strong>:{" "}
                    {a.winners.map((w) => w.name).join(" & ")}{" "}
                    <span className="text-[var(--sn-frost)]">— {a.why}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-3">
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              Marking challenges for
              <select
                className={`${field} !w-auto`}
                value={target.id}
                onChange={(e) => setWho(e.target.value)}
              >
                {day.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.id === me.id ? " (you)" : ""}
                  </option>
                ))}
              </select>
              <span className="font-normal text-[var(--sn-frost)]">
                {target.discipline === "apres"
                  ? "Après & lodge"
                  : ABILITY_LABEL[target.ability]}
              </span>
            </label>
            {CHALLENGE_CATEGORIES.map((cat) => {
              const items = [
                ...offered,
                ...(cat === "creative" ? customs : []),
              ].filter((c) => c.category === cat);
              const apresOnly = target.discipline === "apres";
              const shown = apresOnly && cat === "run" ? [] : items;
              if (shown.length === 0) return null;
              return (
                <section
                  key={cat}
                  aria-label={CATEGORY_LABEL[cat]}
                  className="space-y-2"
                >
                  <h3 className="text-sm font-bold tracking-wider text-[var(--sn-aurora)] uppercase">
                    {CATEGORY_LABEL[cat]}
                  </h3>
                  <ul className="space-y-2">
                    {shown.map((c) => {
                      const done = day.completions.some(
                        (x) =>
                          x.challengeId === c.id && x.personId === target.id,
                      );
                      return (
                        <li
                          key={c.id}
                          className="rounded-xl border border-[var(--sn-line)] p-3"
                          data-testid={`challenge-${c.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{c.title}</p>
                              <p className="text-sm text-[var(--sn-frost)]">
                                {c.detail}
                              </p>
                              <p className="mt-1 text-xs">
                                <span aria-hidden="true">🛟 </span>
                                {c.safety}
                              </p>
                            </div>
                            <button
                              className={`${btn} shrink-0 ${done ? btnOn : ""}`}
                              aria-pressed={done}
                              aria-label={`${done ? "Undo" : "Mark done"}: ${c.title}`}
                              onClick={() =>
                                act({
                                  type: done ? "uncomplete" : "complete",
                                  challengeId: c.id,
                                  personId: target.id,
                                })
                              }
                            >
                              {done ? "Done ✓" : `+${c.points}`}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </Card>

          <Card className="space-y-2">
            <h2 className="text-xl font-extrabold">Write your own</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  act({
                    type: "customChallenge",
                    id: `custom:${newId()}`,
                    title: custom,
                    by: me.id,
                  })
                )
                  setCustom("");
              }}
            >
              <input
                className={`${field} flex-1`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Best hat at lunch"
                aria-label="Your challenge"
                maxLength={90}
              />
              <button className={btn} type="submit">
                Add
              </button>
            </form>
            <p className="text-xs text-[var(--sn-frost)]">
              Worth {CUSTOM_POINTS} points. Snow turns away anything about
              speed, jumps, risky terrain or drinking, and says why.{" "}
              {CHALLENGES.length} ready-made ones are above.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
