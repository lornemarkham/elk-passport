"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { PromptCard } from "@/experience-lab/ui/PromptCard";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Participant, ResponseValue } from "@/experience-lab/core/types";
import { relativeTime } from "@/experience-lab/core/phase";
import { answerText, pickProgress } from "@/domain/hockey/reveal";
import { personaOf, type CallPersona } from "@/domain/hockey/cup";
import { matchupOf, teamColours } from "@/domain/hockey/teams";
import type { Side } from "@/domain/hockey/challenges";
import { FanAvatar } from "../FanTag";
import type { SharedNight } from "../useSharedNight";
import styles from "../hockey.module.css";

/**
 * **Bold predictions.** The sealed picks — same questions, same scoring,
 * same sealing (`sealed.ts`, the database's reveal rule) — dealt as a run of
 * game cards with personality, one at a time, played by thumb. When they're
 * all in, they go into the vault face down: what you can still do (bet
 * somebody on it, change your mind before puck drop) instead of a list of
 * padlocks.
 */
export function BoldCalls({
  night,
  prompts,
  lockLabel,
  onBet,
}: {
  night: SharedNight;
  prompts: readonly LivePrompt[];
  lockLabel?: string;
  /** Bet somebody on the winner, from your own pick's side. */
  onBet?: (side?: Side) => void;
}) {
  const { live, definition } = night;
  const progress = pickProgress(prompts);
  const host = live.participants.find((p) => p.id === definition.hostId)?.name;
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
  const [showVault, setShowVault] = useState(done);
  const touch = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (advance.current) window.clearTimeout(advance.current);
    },
    [],
  );

  const go = (to: number) => {
    if (advance.current) window.clearTimeout(advance.current);
    setShowVault(false);
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
        setShowVault(true);
      else setIndex(Math.min(prompts.length - 1, at + 1));
    }, 700);
  };

  if (!current) return null;
  const { home, away } = matchupOf(definition.subtitle);
  const toneOf = (persona: CallPersona) =>
    persona.tone === "home"
      ? teamColours(home).primary
      : persona.tone === "away"
        ? teamColours(away).primary
        : persona.tone === "gold"
          ? "#b8860b"
          : persona.tone === "red"
            ? "#c8102e"
            : "#3b5b8a";

  return (
    <section aria-labelledby="picks-title">
      <div className="mb-3">
        <h2
          id="picks-title"
          className={`${styles.display} text-[40px] leading-[0.85] text-white`}
        >
          Bold predictions
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-white/70">
          Sealed until puck drop — nobody sees anybody&apos;s, even after they
          make theirs. No money, no gambling, purely so you can be insufferable
          about it later.
        </p>
      </div>

      {/* The deck: every card by name, sealed or not yet. */}
      <ol
        className={`${styles.noScrollbar} -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1`}
        aria-label="Your picks"
      >
        {prompts.map((p, i) => {
          const persona = personaOf(p.prompt, host);
          const mine = p.myResponse !== undefined;
          const here = i === at && !showVault;
          return (
            <li key={p.prompt.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`${p.prompt.question}${mine ? " — sealed" : ""}`}
                aria-current={here ? "step" : undefined}
                className={`flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap transition ${
                  here
                    ? "bg-white text-[#0b1220]"
                    : mine
                      ? "bg-white/[0.12] text-white"
                      : "bg-transparent text-white/70 ring-1 ring-white/25"
                }`}
              >
                {mine ? (
                  <Check
                    className="h-3.5 w-3.5 text-[#46d37f]"
                    strokeWidth={3}
                  />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ffd84d]" />
                )}
                {persona.title}
              </button>
            </li>
          );
        })}
      </ol>

      {showVault ? (
        <Vault
          prompts={prompts}
          people={live.participants}
          host={host}
          lockLabel={lockLabel}
          now={live.now}
          anchor={new Date(definition.anchorAt)}
          open={progress.open}
          onChange={() => go(0)}
          onBet={onBet}
          home={home}
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
          <CallCard
            key={current.prompt.id}
            live={current}
            night={night}
            persona={personaOf(current.prompt, host)}
            tone={toneOf(personaOf(current.prompt, host))}
            justSealed={sealed === current.prompt.id}
            onAnswer={(value, moveOn) => answer(current, value, moveOn)}
          />
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
              {progress.mine} of {progress.total} sealed
              {progress.open && lockLabel ? ` · lock ${lockLabel}` : ""}
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
                onClick={() => setShowVault(true)}
                className="inline-flex min-h-12 items-center gap-1 rounded-full bg-white/[0.1] px-4 text-[15px] font-semibold text-white ring-1 ring-white/20"
              >
                Done
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CallCard({
  live,
  night,
  persona,
  tone,
  justSealed,
  onAnswer,
}: {
  live: LivePrompt;
  night: SharedNight;
  persona: CallPersona;
  tone: string;
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
      className={`${styles.gamecard} ${styles.rise} relative overflow-hidden rounded-[28px] px-5 pt-5 pb-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95)] ring-1 ring-white/15`}
      style={{ ["--tone" as string]: tone }}
    >
      {answered && (
        <span
          aria-hidden
          className={`${justSealed ? styles.stamp : ""} pointer-events-none absolute top-4 right-3 -rotate-[8deg] rounded-md border-[3px] border-[#ffd84d] px-2 py-0.5 text-[15px] font-black tracking-[0.12em] text-[#ffd84d] uppercase`}
        >
          Sealed
        </span>
      )}
      <p className="pr-24 text-[12px] font-extrabold tracking-[0.2em] text-[#ffd84d] uppercase">
        {prompt.scoring
          ? `${prompt.scoring.label ?? "Points"} · +${prompt.scoring.points}${prompt.scoring.partial ? ` (${prompt.scoring.partial.points} for ${prompt.scoring.partial.label.toLowerCase()})` : ""}`
          : "Bragging rights"}
      </p>
      <p
        className={`${styles.display} mt-1 text-[46px] leading-[0.85] text-white`}
      >
        {persona.title}
      </p>
      <h3 className="mt-3 text-[21px] leading-[1.15] font-extrabold text-balance text-white">
        {prompt.question}
      </h3>
      {asker ? (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13.5px] text-white/70">
          <FanAvatar person={asker} size={20} /> {asker.name} asked
        </p>
      ) : (
        <p className="mt-1.5 text-[14px] leading-snug text-white/70">
          {persona.line}
        </p>
      )}

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

      <p className="mt-4 text-[13.5px] text-white/60">
        {!me
          ? "Join to answer — takes one tap."
          : !live.open
            ? live.locked
              ? "Locked. Nobody can save you now."
              : "Not open yet."
            : answered
              ? "Sealed. Nobody sees it until puck drop. Change it until then."
              : prompt.kind === "pair" || prompt.kind === "number"
                ? "Nudge a number and it's yours."
                : "One tap and it's sealed."}
      </p>
    </article>
  );
}

type AnswerProps = {
  live: LivePrompt;
  canAnswer: boolean;
  onAnswer: (value: ResponseValue, moveOn: boolean) => void;
};

function ScorePick({ live, canAnswer, onAnswer }: AnswerProps) {
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
            className="flex flex-col items-center overflow-hidden rounded-2xl ring-1 ring-white/15"
            style={{
              background: `linear-gradient(180deg, ${kit.primary}, color-mix(in srgb, ${kit.primary} 40%, #0b1220))`,
            }}
          >
            <span
              className={`${styles.display} w-full py-1.5 text-center text-[18px]`}
              style={{ color: kit.ink }}
            >
              {kit.abbr}
            </span>
            <span
              className={`${styles.display} my-1 text-[72px] leading-none tabular-nums ${answered ? "text-white" : "text-white/40"}`}
              aria-live="polite"
              aria-label={`${labels[i]} ${current[i]}`}
            >
              {current[i]}
            </span>
            <span className="grid w-full grid-cols-2 border-t border-white/15">
              <button
                type="button"
                disabled={!canAnswer || (current[i] ?? 0) <= 0}
                onClick={() => set(i, (current[i] ?? 0) - 1)}
                aria-label={`${labels[i]} one fewer`}
                className="flex h-14 items-center justify-center text-white transition active:bg-white/10 disabled:opacity-25"
              >
                <Minus className="h-6 w-6" strokeWidth={3} />
              </button>
              <button
                type="button"
                disabled={!canAnswer || (current[i] ?? 0) >= 20}
                onClick={() => set(i, (current[i] ?? 0) + 1)}
                aria-label={`${labels[i]} one more`}
                className="flex h-14 items-center justify-center border-l border-white/15 text-white transition active:bg-white/10 disabled:opacity-25"
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

function YesNo({ live, canAnswer, onAnswer }: AnswerProps) {
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
            className={`${styles.display} flex h-24 items-center justify-center rounded-2xl text-[42px] transition active:scale-[0.97] disabled:cursor-default ${
              chosen
                ? value
                  ? "bg-[#0f7a3d] text-white ring-4 ring-[#ffd84d]"
                  : "bg-[#c8102e] text-white ring-4 ring-[#ffd84d]"
                : "bg-white/[0.08] text-white ring-1 ring-white/20 hover:bg-white/[0.12]"
            }`}
          >
            {value ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

function NumberPick({ live, canAnswer, onAnswer }: AnswerProps) {
  const answered = typeof live.myResponse?.value === "number";
  const value = answered ? (live.myResponse!.value as number) : 5;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] p-2 ring-1 ring-white/15">
      <button
        type="button"
        disabled={!canAnswer || value <= 0}
        onClick={() => onAnswer(Math.max(0, value - 1), false)}
        aria-label="One fewer"
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/[0.12] text-white transition active:scale-95 disabled:opacity-25"
      >
        <Minus className="h-7 w-7" strokeWidth={3} />
      </button>
      <span className="flex flex-col items-center">
        <span
          className={`${styles.display} text-[72px] leading-none tabular-nums ${answered ? "text-white" : "text-white/40"}`}
          aria-live="polite"
        >
          {value}
        </span>
        {live.prompt.unit && (
          <span className="text-[13px] font-semibold tracking-wide text-white/60 uppercase">
            {live.prompt.unit}
          </span>
        )}
      </span>
      <button
        type="button"
        disabled={!canAnswer || value >= 20}
        onClick={() => onAnswer(Math.min(20, value + 1), false)}
        aria-label="One more"
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/[0.12] text-white transition active:scale-95 disabled:opacity-25"
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
}: AnswerProps & { people: readonly Participant[]; subtitle: string }) {
  const mine = live.myResponse?.value;
  const { home, away } = matchupOf(subtitle);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {live.tally.map((option) => {
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
              chosen ? "ring-4 ring-[#ffd84d]" : "ring-1 ring-white/20"
            } ${team ? "" : chosen ? "bg-white text-[#0b1220]" : "bg-white/[0.07] text-white"}`}
            style={
              team ? { background: team.primary, color: team.ink } : undefined
            }
          >
            {person ? (
              <FanAvatar person={person} size={36} />
            ) : team ? (
              <span className={`${styles.display} text-[32px] leading-none`}>
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

/**
 * **The vault.** Everything sealed, face down, with what it opens to and
 * when. Your own picks are yours to peek at — a flip, not a table — and the
 * thing worth doing next is right there: bet somebody on it, or change your
 * mind before the lock.
 */
function Vault({
  prompts,
  people,
  host,
  lockLabel,
  now,
  anchor,
  open,
  onChange,
  onBet,
  home,
}: {
  prompts: readonly LivePrompt[];
  people: readonly Participant[];
  host?: string;
  lockLabel?: string;
  now: Date;
  anchor: Date;
  open: boolean;
  onChange: () => void;
  onBet?: (side?: Side) => void;
  home: string;
}) {
  const [peek, setPeek] = useState(false);
  const mine = prompts.filter((p) => p.myResponse);
  const score = prompts.find((p) => p.prompt.id === "final-score")?.myResponse
    ?.value;
  const scoreSide: Side | undefined = Array.isArray(score)
    ? (score[0] as number) > (score[1] as number)
      ? "home"
      : (score[1] as number) > (score[0] as number)
        ? "away"
        : undefined
    : undefined;
  const longshot = prompts
    .filter((p) => p.prompt.scoring && p.myResponse)
    .sort(
      (a, b) =>
        (b.prompt.scoring?.points ?? 0) - (a.prompt.scoring?.points ?? 0),
    )[0];
  const fan = mine.slice(0, 3);

  return (
    <div
      className={`${styles.gamecard} ${styles.rise} rounded-[28px] px-5 pt-5 pb-5 ring-1 ring-white/15`}
      style={{ ["--tone" as string]: "#b8860b" }}
    >
      <div className="flex items-start gap-4">
        <div className="relative h-[92px] w-[96px] shrink-0" aria-hidden>
          {fan.map((p, i) => (
            <span
              key={p.prompt.id}
              className={`${styles.sealedBack} absolute top-0 left-4 flex h-[84px] w-[60px] items-end justify-center rounded-xl pb-2 text-[9px] font-black tracking-wider text-white/90 uppercase ring-2 ring-white/30`}
              style={{
                transform: `rotate(${(i - 1) * 12}deg) translateX(${(i - 1) * 14}px)`,
                zIndex: i,
              }}
            >
              <span className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#c8102e] text-[13px] ring-2 ring-[#7a0a1c]">
                🏒
              </span>
              {personaOf(p.prompt, host).title.split(" ").slice(-1)[0]}
            </span>
          ))}
        </div>
        <div className="min-w-0">
          <p
            className={`${styles.display} text-[36px] leading-[0.88] text-white`}
          >
            In the vault.
          </p>
          <p className="mt-2 text-[15px] leading-snug text-white/80">
            {mine.length} {mine.length === 1 ? "pick" : "picks"} sealed.{" "}
            {open
              ? `They open at puck drop${lockLabel ? `, ${lockLabel}` : ""} — ${relativeTime(anchor, now)}.`
              : "They're open now."}
          </p>
        </div>
      </div>

      {(Array.isArray(score) || longshot) && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.isArray(score) && (
            <p className="rounded-2xl bg-black/30 px-4 py-3 text-[14px] text-white/80">
              <span className="block text-[11.5px] font-extrabold tracking-[0.16em] text-[#ffd84d] uppercase">
                Your big call
              </span>
              <span className={`${styles.display} text-[30px] text-white`}>
                {home} {(score as number[])[0]}–{(score as number[])[1]}
              </span>
            </p>
          )}
          {longshot && longshot.prompt.id !== "final-score" && (
            <p className="rounded-2xl bg-black/30 px-4 py-3 text-[14px] text-white/80">
              <span className="block text-[11.5px] font-extrabold tracking-[0.16em] text-[#ffd84d] uppercase">
                Worth the most · +{longshot.prompt.scoring!.points}
              </span>
              <span className="font-bold text-white">
                {personaOf(longshot.prompt, host).title}:
              </span>{" "}
              {answerText(longshot.prompt, longshot.myResponse!.value, people)}
            </p>
          )}
        </div>
      )}

      {peek && (
        <ul
          className="mt-3 grid grid-cols-2 gap-2"
          aria-label="Your sealed picks"
        >
          {mine.map((p) => (
            <li
              key={p.prompt.id}
              className={`${styles.pop} rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10`}
            >
              <span className="block text-[11px] font-extrabold tracking-[0.14em] text-[#ffd84d] uppercase">
                {personaOf(p.prompt, host).title}
              </span>
              <span className="mt-0.5 block text-[16px] font-extrabold text-white">
                {answerText(p.prompt, p.myResponse!.value, people)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {onBet && open && (
          <button
            type="button"
            onClick={() => onBet(scoreSide)}
            className={`${styles.display} min-h-12 rounded-2xl bg-[#ffd84d] px-5 text-[19px] text-[#0b1220] active:scale-[0.98]`}
          >
            Bet somebody on it
          </button>
        )}
        <button
          type="button"
          onClick={() => setPeek((v) => !v)}
          className="min-h-12 rounded-2xl px-4 text-[14.5px] font-bold text-white ring-1 ring-white/20"
        >
          {peek ? "Hide mine" : "Peek at mine"}
        </button>
        {open && (
          <button
            type="button"
            onClick={onChange}
            className="min-h-12 rounded-2xl px-4 text-[14.5px] font-bold text-white/80 ring-1 ring-white/15"
          >
            Change a pick
          </button>
        )}
      </div>
    </div>
  );
}
