"use client";

import { useState } from "react";
import {
  CAN_SAY,
  changedStops,
  clockWords,
  composeDay,
  readChange,
  type Basis,
  type Composed,
  type Stop,
  type Tweaks,
} from "@/domain/snow/itinerary";
import { proposalsFor } from "@/domain/snow/day";
import type { ResortFacts } from "@/domain/snow/resorts";
import type { TabProps } from "./tabs";
import type { Nearby } from "./useMountainDay";
import { pickDetail } from "./AroundMountain";
import { newId } from "./store";
import { Card, btn, field, styles } from "./kit";

const BASIS: Record<Basis, { word: string; cls: string }> = {
  decided: {
    word: "Locked in",
    cls: "bg-[var(--sn-aurora)]/20 text-[var(--sn-aurora)]",
  },
  crew: {
    word: "Crew's pick",
    cls: "bg-[var(--sn-ice)]/15 text-[var(--sn-ice)]",
  },
  published: {
    word: "Published",
    cls: "bg-[var(--sn-aurora)]/15 text-[var(--sn-aurora)]",
  },
  atlas: {
    word: "Suggested · Atlas place",
    cls: "bg-[var(--sn-glow)]/15 text-[var(--sn-glow)]",
  },
  suggested: {
    word: "Suggested",
    cls: "bg-[var(--sn-frost)]/15 text-[var(--sn-frost)]",
  },
};

function StopRow({ s, p, fresh }: { s: Stop; p: TabProps; fresh?: boolean }) {
  const onVote =
    s.topic &&
    proposalsFor(p.day, s.topic).some(
      (x) => x.label.toLowerCase() === s.pick?.title.toLowerCase(),
    );
  return (
    <li
      className={`grid grid-cols-[4.5rem_1fr] gap-3 border-l-2 py-2 pl-3 ${fresh ? "border-[var(--sn-glow)]" : "border-[var(--sn-line)]"}`}
      data-testid={`stop-${s.id}`}
    >
      <span className="text-sm font-bold text-[var(--sn-frost)] tabular-nums">
        {s.time ? clockWords(s.time) : ""}
      </span>
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {s.title}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${BASIS[s.basis].cls}`}
          >
            {s.gap ? "Not in Atlas yet" : BASIS[s.basis].word}
          </span>
        </p>
        {s.detail && (
          <p className="text-sm text-[var(--sn-frost)]">{s.detail}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {s.source && (
            <a
              className="text-xs underline"
              href={s.source.url}
              target="_blank"
              rel="noreferrer"
            >
              {s.source.label} ↗
            </a>
          )}
          {s.basis === "atlas" && s.pick && s.topic && (
            <button
              type="button"
              className={`${btn} !min-h-9 text-xs`}
              disabled={onVote}
              onClick={() =>
                p.act({
                  type: "propose",
                  proposal: {
                    id: newId(),
                    topic: s.topic!,
                    label: s.pick!.title,
                    detail: pickDetail(s.pick!),
                    by: p.me.id,
                    source: "atlas",
                  },
                })
              }
            >
              {onVote ? "On the crew's vote" : "Put it to the crew"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * **Your day, laid out — and changed in words.** A preview comes before
 * anything moves; Undo comes after. Locked decisions never move.
 */
export function DayPlan({
  nearby,
  facts,
  mountainName,
  tweaks,
  save,
  undo,
  canUndo,
  ...p
}: TabProps & {
  nearby: Nearby;
  facts?: ResortFacts;
  mountainName?: string;
  tweaks: Tweaks;
  save: (t: Tweaks) => void;
  undo: () => void;
  canUndo: boolean;
}) {
  const [text, setText] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    tweaks: Tweaks;
    plan: Composed;
    said: string;
  } | null>(null);
  const picks = nearby.status === "connected" ? nearby.picks : [];
  const plan = composeDay({ day: p.day, mountainName, facts, picks, tweaks });
  const fresh = preview
    ? new Set(changedStops(plan, preview.plan).map((s) => s.id))
    : new Set<string>();

  function ask(sentence: string) {
    const r = readChange(sentence, tweaks, p.day, picks);
    if (!r.ok) {
      setPreview(null);
      setSaid(r.said);
      return;
    }
    setSaid(null);
    setPreview({
      tweaks: r.tweaks,
      plan: composeDay({
        day: p.day,
        mountainName,
        facts,
        picks,
        tweaks: r.tweaks,
      }),
      said: r.said,
    });
  }

  const shown = preview?.plan ?? plan;
  return (
    <Card className="space-y-4" data-testid="day-plan">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black">
            Your day on {mountainName ?? "the mountain"}
          </h2>
          <p className="text-sm text-[var(--sn-frost)]">
            Built from your crew&apos;s choices, the resort&apos;s published
            hours and real places in Atlas. Badges say which is which.
          </p>
        </div>
        {tweaks.stay === "mountain" && (
          <span className="rounded-full bg-[var(--sn-aurora)]/15 px-3 py-1 text-xs font-bold text-[var(--sn-aurora)]">
            Staying on the mountain
          </span>
        )}
      </div>

      {nearby.status === "unavailable" && (
        <p className="text-sm">
          Atlas isn&apos;t answering, so this plan has no place suggestions —
          only your crew&apos;s picks and the resort&apos;s published hours.
        </p>
      )}

      {preview && (
        <div
          className="rounded-xl border border-[var(--sn-glow)] p-3"
          role="status"
          data-testid="plan-preview"
        >
          <p className="font-semibold">Preview: {preview.said}</p>
          <p className="text-xs text-[var(--sn-frost)]">
            Highlighted stops change. Nothing else moves.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={`${styles.go} min-h-11 rounded-full px-5`}
              onClick={() => {
                save(preview.tweaks);
                setPreview(null);
                setText("");
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ol className="space-y-1" aria-label="The day, in order">
        {shown.stops.map((s) => (
          <StopRow key={s.id} s={s} p={p} fresh={fresh.has(s.id)} />
        ))}
      </ol>
      <ul className="space-y-0.5 text-xs text-[var(--sn-frost)]">
        {plan.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) ask(text);
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">
            Change it — say it how you&apos;d say it
          </span>
          <div className="flex gap-2">
            <input
              className={`${field} flex-1`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Move lunch earlier"
              maxLength={160}
            />
            <button type="submit" className={btn}>
              Try it
            </button>
          </div>
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Things you can say">
          {CAN_SAY.map((c) => (
            <button
              key={c}
              type="button"
              className={`${btn} !min-h-9 text-xs`}
              onClick={() => ask(c)}
            >
              {c}
            </button>
          ))}
          {canUndo && (
            <button
              type="button"
              className={`${btn} !min-h-9 text-xs`}
              onClick={undo}
            >
              Undo last change
            </button>
          )}
        </div>
        {said && (
          <p
            className="text-sm font-semibold text-[var(--sn-glow)]"
            role="status"
            data-testid="plan-said"
          >
            {said}
          </p>
        )}
        <p className="text-xs text-[var(--sn-frost)]">
          Read by rules, not AI. Timing changes stay on this phone; picks you
          put to the crew are shared.
        </p>
      </form>
    </Card>
  );
}
