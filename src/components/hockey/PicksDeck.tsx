"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import { PromptCard } from "@/experience-lab/ui/PromptCard";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Participant, ResponseValue } from "@/experience-lab/core/types";
import { answerText, pickProgress } from "@/domain/hockey/reveal";
import { matchupOf, teamColours } from "@/domain/hockey/teams";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

/**
 * **Seven sealed picks, one at a time, by thumb.**
 *
 * The lab found that seven prediction cards in a column read as a form, and
 * fixed it with a deck. This keeps the deck and makes each card something
 * you play rather than fill in: the score as two big team-coloured counters,
 * yes/no as two buttons you cannot miss, a choice as tiles. A tap is the
 * answer — no submit button, the lab's rule — and the card says SEALED when
 * it is in, then moves on by itself.
 *
 * The game logic is the engine's, untouched: what is open, what is locked,
 * what counts, and what anybody else may see are all still `LivePrompt`.
 * A question this deck does not know how to draw (a forfeit you have to opt
 * into, a photo, a sentence) is drawn by the lab's own `PromptCard`, so its
 * consent and reveal rules come with it.
 */
export function PicksDeck({
  night,
  prompts,
  title,
  subtitle,
  lockLabel,
}: {
  night: SharedNight;
  prompts: readonly LivePrompt[];
  title: string;
  subtitle?: string;
  lockLabel?: string;
}) {
  const { live } = night;
  const progress = pickProgress(prompts);
  const firstOpen = Math.max(
    0,
    prompts.findIndex((p) => p.myResponse === undefined),
  );
  const [index, setIndex] = useState(firstOpen);
  const [sealed, setSealed] = useState<string | null>(null);
  const advance = useRef<number | null>(null);
  const at = Math.min(index, Math.max(0, prompts.length - 1));
  const current = prompts[at];
  const done = progress.total > 0 && progress.mine === progress.total;
  const [showDone, setShowDone] = useState(done);

  useEffect(
    () => () => {
      if (advance.current) window.clearTimeout(advance.current);
    },
    [],
  );

  const go = (to: number) => {
    if (advance.current) window.clearTimeout(advance.current);
    setShowDone(false);
    setIndex(Math.max(0, Math.min(prompts.length - 1, to)));
  };

  const answer = (
    prompt: LivePrompt,
    value: ResponseValue,
    moveOn: boolean,
  ) => {
    night.respond(prompt.prompt.id, value);
    setSealed(prompt.prompt.id);
    if (!moveOn) return;
    if (advance.current) window.clearTimeout(advance.current);
    advance.current = window.setTimeout(() => {
      const next = prompts.findIndex(
        (p, i) =>
          i > at &&
          p.myResponse === undefined &&
          p.prompt.id !== prompt.prompt.id,
      );
      if (next >= 0) setIndex(next);
      else if (
        prompts.every(
          (p) => p.myResponse !== undefined || p.prompt.id === prompt.prompt.id,
        )
      )
        setShowDone(true);
      else setIndex(Math.min(prompts.length - 1, at + 1));
    }, 700);
  };

  // A swipe moves through the deck as the arrows do.
  const touch = useRef<number | null>(null);

  if (!current) return null;

  return (
    <section aria-labelledby="picks-title">
      <div className="mb-4">
        <h2
          id="picks-title"
          className={`${styles.wide} text-[28px] leading-none text-white`}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-[15px] leading-snug text-white/70">
            {subtitle}
          </p>
        )}
      </div>

      {/* Progress: one puck per pick, filled once sealed. */}
      <div className="mb-3">
        <p className="mb-2 flex items-baseline justify-between gap-3 text-[14px] font-semibold text-white">
          <span>
            {progress.mine} of {progress.total} sealed
          </span>
          {progress.open && lockLabel && (
            <span className="text-[13px] font-medium text-white/60">
              Lock at {lockLabel}
            </span>
          )}
        </p>
        <ol className="flex gap-1.5" aria-label="Your picks">
          {prompts.map((p, i) => {
            const mine = p.myResponse !== undefined;
            const here = i === at && !showDone;
            return (
              <li key={p.prompt.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`${p.prompt.question}${mine ? " — sealed" : ""}`}
                  aria-current={here ? "step" : undefined}
                  className={`flex h-10 w-full items-center justify-center rounded-full text-[13px] font-bold transition ${
                    mine
                      ? "bg-[#ffd84d] text-[#0b1220]"
                      : "bg-white/[0.08] text-white/70 ring-1 ring-white/20"
                  } ${here ? "outline-2 outline-offset-2 outline-white" : ""}`}
                >
                  {mine ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {showDone ? (
        <AllSealed
          prompts={prompts}
          people={live.participants}
          onChange={() => go(0)}
          open={progress.open}
        />
      ) : (
        <div
          onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start === null || end === undefined) return;
            if (end - start < -60) go(at + 1);
            if (end - start > 60) go(at - 1);
          }}
        >
          <PickCard
            key={current.prompt.id}
            live={current}
            night={night}
            justSealed={sealed === current.prompt.id}
            onAnswer={(value, moveOn) => answer(current, value, moveOn)}
          />
        </div>
      )}

      {!showDone && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => go(at - 1)}
            disabled={at === 0}
            className="inline-flex min-h-12 items-center gap-1 rounded-full px-4 text-[15px] font-semibold text-white/80 ring-1 ring-white/15 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <span className="text-[14px] text-white/60">
            {at + 1} of {prompts.length}
          </span>
          {at < prompts.length - 1 ? (
            <button
              type="button"
              onClick={() => go(at + 1)}
              className="inline-flex min-h-12 items-center gap-1 rounded-full bg-white/[0.1] px-4 text-[15px] font-semibold text-white ring-1 ring-white/20"
            >
              {current.myResponse !== undefined ? "Next" : "Skip"}
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDone(true)}
              className="inline-flex min-h-12 items-center gap-1 rounded-full bg-white/[0.1] px-4 text-[15px] font-semibold text-white ring-1 ring-white/20"
            >
              Done
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function PickCard({
  live,
  night,
  justSealed,
  onAnswer,
}: {
  live: LivePrompt;
  night: SharedNight;
  justSealed: boolean;
  onAnswer: (value: ResponseValue, moveOn: boolean) => void;
}) {
  const { prompt } = live;
  const people = night.live.participants;
  const me = night.live.me;
  const canAnswer = Boolean(me) && live.open;
  const asker = prompt.askedBy
    ? people.find((p) => p.id === prompt.askedBy)
    : undefined;
  const drawable =
    !prompt.requiresConsent &&
    !prompt.optionsFrom &&
    ["pair", "boolean", "number", "choice", "person"].includes(prompt.kind);

  if (!drawable) {
    // The lab's card, with its consent gate and reveal rules intact.
    return (
      <div className={styles.rise}>
        <PromptCard
          live={live}
          me={me}
          people={people}
          onRespond={(value) => night.respond(prompt.id, value)}
          onAddOption={(label, detail) =>
            night.addOption(prompt.id, label, detail)
          }
          onCue={night.cue}
          onConsent={night.consent}
        />
      </div>
    );
  }

  const answered = live.myResponse !== undefined;
  return (
    <article
      className={`${styles.ice} ${styles.rise} relative overflow-hidden rounded-[26px] px-5 pt-5 pb-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]`}
    >
      {answered && (
        <span
          aria-hidden
          className={`${justSealed ? styles.stamp : ""} pointer-events-none absolute top-4 right-3 -rotate-[8deg] rounded-md border-[3px] border-[#c8102e] px-2 py-0.5 text-[15px] font-black tracking-[0.12em] text-[#c8102e] uppercase opacity-90`}
        >
          Sealed
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2 pr-24">
        {prompt.scoring && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0b1220] px-2.5 py-1 text-[12px] font-bold text-[#ffd84d]">
            <Sparkles className="h-3.5 w-3.5" />
            {prompt.scoring.label ?? "Points"} +{prompt.scoring.points}
          </span>
        )}
        {asker && (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0b1220]/65">
            <Avatar person={asker} size={20} />
            {asker.name} asked
          </span>
        )}
      </div>
      <h3
        className={`${styles.wide} mt-3 text-[26px] leading-[1.08] text-balance text-[#0b1220]`}
      >
        {prompt.question}
      </h3>

      <div className="mt-5">
        {prompt.kind === "pair" && (
          <ScorePick live={live} canAnswer={canAnswer} onAnswer={onAnswer} />
        )}
        {prompt.kind === "boolean" && (
          <YesNo live={live} canAnswer={canAnswer} onAnswer={onAnswer} />
        )}
        {prompt.kind === "number" && (
          <NumberPick live={live} canAnswer={canAnswer} onAnswer={onAnswer} />
        )}
        {(prompt.kind === "choice" || prompt.kind === "person") && (
          <Tiles
            live={live}
            people={people}
            subtitle={night.live.definition.subtitle}
            canAnswer={canAnswer}
            onAnswer={onAnswer}
          />
        )}
      </div>

      <p className="mt-4 text-[13.5px] text-[#0b1220]/60">
        {!me
          ? "Join to answer — takes one tap."
          : !live.open
            ? live.locked
              ? "Locked. Nobody can save you now."
              : "Not open yet."
            : answered
              ? "Sealed. Nobody sees it until the picks lock. Change it until then."
              : prompt.kind === "pair" || prompt.kind === "number"
                ? "Nudge a number and it's yours."
                : "One tap and it's sealed."}
      </p>
    </article>
  );
}

function ScorePick({
  live,
  canAnswer,
  onAnswer,
}: {
  live: LivePrompt;
  canAnswer: boolean;
  onAnswer: (value: ResponseValue, moveOn: boolean) => void;
}) {
  const answered = Array.isArray(live.myResponse?.value);
  const current = answered
    ? (live.myResponse!.value as readonly number[])
    : [2, 2];
  const labels = live.prompt.pairLabels ?? ["Home", "Away"];
  const set = (i: 0 | 1, next: number) => {
    const pair: [number, number] = [current[0] ?? 0, current[1] ?? 0];
    pair[i] = Math.max(0, Math.min(20, next));
    onAnswer(pair, false);
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      {([0, 1] as const).map((i) => {
        const kit = teamColours(labels[i]);
        return (
          <div
            key={i}
            className="flex flex-col items-center overflow-hidden rounded-2xl bg-[#0b1220]/[0.04] ring-1 ring-[#0b1220]/10"
          >
            <span
              className={`${styles.display} w-full py-1.5 text-center text-[17px]`}
              style={{ background: kit.primary, color: kit.ink }}
            >
              {kit.abbr}
            </span>
            <span
              className={`${styles.display} my-1 text-[64px] leading-none tabular-nums ${
                answered ? "text-[#0b1220]" : "text-[#0b1220]/30"
              }`}
              aria-live="polite"
              aria-label={`${labels[i]} ${current[i]}`}
            >
              {current[i]}
            </span>
            <span className="grid w-full grid-cols-2 border-t border-[#0b1220]/10">
              <button
                type="button"
                disabled={!canAnswer || (current[i] ?? 0) <= 0}
                onClick={() => set(i, (current[i] ?? 0) - 1)}
                aria-label={`${labels[i]} one fewer`}
                className="flex h-14 items-center justify-center text-[#0b1220] transition active:bg-[#0b1220]/10 disabled:opacity-25"
              >
                <Minus className="h-6 w-6" strokeWidth={3} />
              </button>
              <button
                type="button"
                disabled={!canAnswer || (current[i] ?? 0) >= 20}
                onClick={() => set(i, (current[i] ?? 0) + 1)}
                aria-label={`${labels[i]} one more`}
                className="flex h-14 items-center justify-center border-l border-[#0b1220]/10 text-[#0b1220] transition active:bg-[#0b1220]/10 disabled:opacity-25"
              >
                <Plus className="h-6 w-6" strokeWidth={3} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function YesNo({
  live,
  canAnswer,
  onAnswer,
}: {
  live: LivePrompt;
  canAnswer: boolean;
  onAnswer: (value: ResponseValue, moveOn: boolean) => void;
}) {
  const mine = live.myResponse?.value;
  return (
    <div className="grid grid-cols-2 gap-3">
      {[true, false].map((value) => {
        const chosen = mine === value;
        return (
          <button
            key={String(value)}
            type="button"
            disabled={!canAnswer}
            aria-pressed={chosen}
            onClick={() => onAnswer(value, true)}
            className={`${styles.display} flex h-24 items-center justify-center rounded-2xl text-[40px] transition active:scale-[0.97] disabled:cursor-default ${
              chosen
                ? value
                  ? "bg-[#0f7a3d] text-white"
                  : "bg-[#c8102e] text-white"
                : "bg-[#0b1220]/[0.05] text-[#0b1220] ring-1 ring-[#0b1220]/12 hover:bg-[#0b1220]/[0.09]"
            }`}
          >
            {value ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

function NumberPick({
  live,
  canAnswer,
  onAnswer,
}: {
  live: LivePrompt;
  canAnswer: boolean;
  onAnswer: (value: ResponseValue, moveOn: boolean) => void;
}) {
  const answered = typeof live.myResponse?.value === "number";
  const value = answered ? (live.myResponse!.value as number) : 5;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#0b1220]/[0.04] p-2 ring-1 ring-[#0b1220]/10">
      <button
        type="button"
        disabled={!canAnswer || value <= 0}
        onClick={() => onAnswer(Math.max(0, value - 1), false)}
        aria-label="One fewer"
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-white text-[#0b1220] shadow-sm transition active:scale-95 disabled:opacity-25"
      >
        <Minus className="h-7 w-7" strokeWidth={3} />
      </button>
      <span className="flex flex-col items-center">
        <span
          className={`${styles.display} text-[64px] leading-none tabular-nums ${
            answered ? "text-[#0b1220]" : "text-[#0b1220]/30"
          }`}
          aria-live="polite"
        >
          {value}
        </span>
        {live.prompt.unit && (
          <span className="text-[13px] font-semibold tracking-wide text-[#0b1220]/60 uppercase">
            {live.prompt.unit}
          </span>
        )}
      </span>
      <button
        type="button"
        disabled={!canAnswer || value >= 20}
        onClick={() => onAnswer(Math.min(20, value + 1), false)}
        aria-label="One more"
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-white text-[#0b1220] shadow-sm transition active:scale-95 disabled:opacity-25"
      >
        <Plus className="h-7 w-7" strokeWidth={3} />
      </button>
    </div>
  );
}

function Tiles({
  live,
  people,
  subtitle,
  canAnswer,
  onAnswer,
}: {
  live: LivePrompt;
  people: readonly Participant[];
  subtitle: string;
  canAnswer: boolean;
  onAnswer: (value: ResponseValue, moveOn: boolean) => void;
}) {
  const mine = live.myResponse?.value;
  const { home, away } = matchupOf(subtitle);
  const options = live.tally;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((option) => {
        const chosen = mine === option.optionId;
        const team =
          option.label === home || option.label === away
            ? teamColours(option.label)
            : undefined;
        const person = people.find((p) => p.id === option.optionId);
        return (
          <button
            key={option.optionId}
            type="button"
            disabled={!canAnswer}
            aria-pressed={chosen}
            onClick={() => onAnswer(option.optionId, true)}
            className={`relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-center transition active:scale-[0.97] disabled:cursor-default ${
              chosen ? "ring-4 ring-[#ffd84d]" : "ring-1 ring-[#0b1220]/12"
            } ${team ? "" : chosen ? "bg-[#0b1220] text-white" : "bg-[#0b1220]/[0.04] text-[#0b1220]"}`}
            style={
              team ? { background: team.primary, color: team.ink } : undefined
            }
          >
            {person ? (
              <Avatar person={person} size={36} />
            ) : team ? (
              <span className={`${styles.display} text-[30px] leading-none`}>
                {team.abbr}
              </span>
            ) : (
              option.emoji && (
                <span className="text-[30px] leading-none" aria-hidden>
                  {option.emoji}
                </span>
              )
            )}
            <span className="text-[16px] leading-tight font-bold">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AllSealed({
  prompts,
  people,
  onChange,
  open,
}: {
  prompts: readonly LivePrompt[];
  people: readonly Participant[];
  onChange: () => void;
  open: boolean;
}) {
  return (
    <div
      className={`${styles.ice} ${styles.rise} rounded-[26px] px-5 pt-5 pb-5`}
    >
      <p
        className={`${styles.display} text-[34px] leading-none text-[#0b1220]`}
      >
        All sealed. 🔒
      </p>
      <p className="mt-2 text-[15px] text-[#0b1220]/70">
        Nobody sees them until the picks lock. Now you wait — insufferably.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-[#0b1220]/10">
        {prompts.map((p) => (
          <li
            key={p.prompt.id}
            className="flex items-baseline justify-between gap-3 py-2.5"
          >
            <span className="min-w-0 text-[14.5px] text-[#0b1220]/70">
              {p.prompt.question}
            </span>
            <span className="shrink-0 text-[16px] font-bold text-[#0b1220]">
              {p.myResponse
                ? answerText(p.prompt, p.myResponse.value, people)
                : "—"}
            </span>
          </li>
        ))}
      </ul>
      {open && (
        <button
          type="button"
          onClick={onChange}
          className="mt-3 inline-flex min-h-12 items-center rounded-full bg-[#0b1220] px-5 text-[15px] font-bold text-white"
        >
          Change a pick
        </button>
      )}
    </div>
  );
}
