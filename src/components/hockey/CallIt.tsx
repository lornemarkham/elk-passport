"use client";

import { useState } from "react";
import { SectionHead, Surface } from "@/experience-lab/ui/atoms";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { ResponseValue } from "@/experience-lab/core/types";
import type { GameView } from "@/app/hockey/_server/game";
import type { SharedNight } from "./useSharedNight";

/**
 * **Somebody has to say what actually happened.**
 *
 * The lab's fixture knew the final score before the game, which is the one
 * thing a real night cannot. Passport has no live scores feed and will not
 * pretend to, so the host — or whoever asked a question — calls the result,
 * and the leaderboard, the awards and the receipts all follow from that one
 * entry. A result can be corrected; standings are derived, so nothing else has
 * to change.
 *
 * When the NHL's own record of a finished game matches this night, the host
 * can start from it with one tap ("Use the NHL's numbers"). That fills in
 * only what the record settles (score, overtime, first goal, total goals),
 * still as the host's own call, and everything stays editable afterwards.
 *
 * Only shown once the picks are locked: before then, a result is a spoiler at
 * best and a thumb on the scale at worst.
 */
export function CallIt({
  night,
  nhl,
}: {
  night: SharedNight;
  nhl?: GameView | null;
}) {
  const { live, role, state, definition } = night;
  const me = state.meId;
  // The engine withholds a called result until its moment (a first goal
  // called mid-game is not shown until the period ends), so "has this been
  // called?" has to ask what is stored, not what is showing.
  const called = new Set(
    [...definition.prompts, ...state.addedPrompts]
      .filter((p) => p.resolution !== undefined)
      .map((p) => p.id),
  );
  const callable = live.prompts.filter(
    (p) =>
      p.prompt.scoring &&
      p.prompt.resolvedBy !== "vote" &&
      p.locked &&
      !called.has(p.prompt.id) &&
      (role === "host" || p.prompt.askedBy === me),
  );
  if (callable.length === 0) return null;
  const suggested = callable.filter((p) => nhl?.suggestions?.[p.prompt.id]);

  return (
    <section aria-label="Call it">
      <SectionHead
        title="Call it"
        subtitle={
          role === "host"
            ? "You're the host, so you're the referee. Nobody else can change these."
            : "You asked these, so you call them."
        }
      />
      <Surface>
        {role === "host" && suggested.length > 0 && nhl?.suggestions && (
          <div className="mb-4 rounded-2xl bg-[#ffd84d]/10 p-3">
            <p className="text-[14px] text-white/85">
              The NHL has this one on record:{" "}
              {suggested
                .map((p) => nhl.suggestions?.[p.prompt.id]?.words)
                .join(" · ")}
              .
            </p>
            <button
              type="button"
              className="mt-2 min-h-11 rounded-full bg-[#ffd84d] px-4 text-[14px] font-semibold text-[#0b1220]"
              onClick={() => {
                for (const p of suggested) {
                  void night.send({
                    type: "callIt",
                    promptId: p.prompt.id,
                    value: nhl.suggestions?.[p.prompt.id]?.value as never,
                  });
                }
              }}
            >
              Use the NHL&apos;s numbers
            </button>
          </div>
        )}
        <ul className="flex flex-col gap-4">
          {callable.map((p) => (
            <Caller
              key={p.prompt.id}
              live={p}
              onCall={(value) =>
                void night.send({
                  type: "callIt",
                  promptId: p.prompt.id,
                  value,
                })
              }
            />
          ))}
        </ul>
      </Surface>
    </section>
  );
}

function Caller({
  live,
  onCall,
}: {
  live: LivePrompt;
  onCall: (value: ResponseValue) => void;
}) {
  const { prompt } = live;
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const num = (s: string) => Number.parseInt(s, 10);
  const field =
    "w-16 rounded-lg border border-white/15 bg-black/20 px-2 py-1.5 text-center text-[14px] text-white";
  const chip =
    "rounded-full border border-white/20 px-3 py-1.5 text-[13px] hover:border-white/60";

  return (
    <li>
      <p className="mb-2 text-[14px] text-white/85">{prompt.question}</p>
      {prompt.kind === "pair" && (
        <div className="flex items-center gap-2 text-[13px] text-white/60">
          {prompt.pairLabels?.[0]}
          <input
            inputMode="numeric"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className={field}
            aria-label={prompt.pairLabels?.[0]}
          />
          <input
            inputMode="numeric"
            value={b}
            onChange={(e) => setB(e.target.value)}
            className={field}
            aria-label={prompt.pairLabels?.[1]}
          />
          {prompt.pairLabels?.[1]}
          <button
            type="button"
            className={chip}
            disabled={Number.isNaN(num(a)) || Number.isNaN(num(b))}
            onClick={() => onCall([num(a), num(b)])}
          >
            Final
          </button>
        </div>
      )}
      {prompt.kind === "number" && (
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className={field}
            aria-label={prompt.question}
          />
          <button
            type="button"
            className={chip}
            disabled={Number.isNaN(num(a))}
            onClick={() => onCall(num(a))}
          >
            That&apos;s it
          </button>
        </div>
      )}
      {prompt.kind === "boolean" && (
        <div className="flex gap-2">
          <button type="button" className={chip} onClick={() => onCall(true)}>
            Yes
          </button>
          <button type="button" className={chip} onClick={() => onCall(false)}>
            No
          </button>
        </div>
      )}
      {(prompt.kind === "choice" || prompt.kind === "person") && (
        <div className="flex flex-wrap gap-2">
          {(prompt.options ?? []).map((o) => (
            <button
              key={o.id}
              type="button"
              className={chip}
              onClick={() => onCall(o.id)}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
