"use client";

import { useState } from "react";
import { personName } from "@/domain/snow/day";
import {
  PREDICTION_POINTS,
  PREDICTION_STARTERS,
  isSettled,
  tally,
} from "@/domain/snow/predictions";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, btn, btnOn, field } from "./kit";

/**
 * **Call it.** Yes/no lines about the crew's own day. Everyone says what they
 * think; anyone settles it afterwards. Nothing here claims a fact about the
 * mountain, and settling is reversible.
 */
export function PredictionsCard({ day, me, act }: TabProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const taken = new Set(day.predictions.map((p) => p.text));
  const starters = PREDICTION_STARTERS.filter((s) => !taken.has(s)).slice(0, 3);

  const add = (value: string) => {
    const ok = act({ type: "predict", id: newId(), text: value, by: me.id });
    setError(ok ? "" : "That one didn't fit. Try fewer, plainer words.");
    if (ok) setText("");
  };

  return (
    <Card className="space-y-3" data-testid="predictions">
      <h2 className="text-xl font-extrabold">Call it</h2>
      <p className="text-sm text-[var(--sn-frost)]">
        Say what you think will happen. Settle it after, and each right call is
        worth {PREDICTION_POINTS} points.
      </p>
      <ul className="space-y-3">
        {day.predictions.map((p) => {
          const mine = p.guesses[me.id];
          const t = tally(p);
          const settled = isSettled(p);
          return (
            <li
              key={p.id}
              className="space-y-2 rounded-lg bg-[var(--sn-ice)]/5 p-3"
            >
              <p className="font-semibold">
                {p.text}{" "}
                <span className="text-xs font-normal text-[var(--sn-frost)]">
                  — {personName(day, p.by)}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {([true, false] as const).map((says) => (
                  <button
                    key={String(says)}
                    className={`${btn} ${mine === says ? btnOn : ""}`}
                    aria-pressed={mine === says}
                    disabled={settled}
                    onClick={() =>
                      act({
                        type: "guess",
                        id: p.id,
                        personId: me.id,
                        says: mine === says ? null : says,
                      })
                    }
                  >
                    {says ? "Yes" : "No"}
                  </button>
                ))}
                <span className="text-xs text-[var(--sn-frost)]">
                  {t.yes} yes · {t.no} no
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {settled ? (
                  <>
                    <strong>
                      {p.outcome ? "It happened ✅" : "It didn't ❌"}
                    </strong>
                    <button
                      className="underline"
                      onClick={() =>
                        act({ type: "settle", id: p.id, outcome: null })
                      }
                    >
                      Reopen
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--sn-frost)]">Settle it:</span>
                    <button
                      className={btn}
                      onClick={() =>
                        act({ type: "settle", id: p.id, outcome: true })
                      }
                    >
                      It happened
                    </button>
                    <button
                      className={btn}
                      onClick={() =>
                        act({ type: "settle", id: p.id, outcome: false })
                      }
                    >
                      It didn&apos;t
                    </button>
                  </>
                )}
                <button
                  className="ml-auto px-2"
                  aria-label={`Remove ${p.text}`}
                  onClick={() => act({ type: "removePrediction", id: p.id })}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {starters.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Ideas">
          {starters.map((s) => (
            <button key={s} className={btn} onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
      >
        <input
          className={`${field} flex-1`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Your own call…"
          aria-label="Write a prediction"
          maxLength={90}
        />
        <button className={btn} type="submit">
          Add
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-[var(--sn-glow)]">
          {error}
        </p>
      )}
    </Card>
  );
}
