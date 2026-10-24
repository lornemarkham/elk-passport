"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Participant } from "@/experience-lab/core/types";
import {
  GOALS_LINE,
  KIND_EMOJI,
  KIND_TITLE,
  MARKET_LABEL,
  MARKET_PROMPT,
  kindAsk,
  otherSide,
  sideWords,
  type ChallengeKind,
  type Game,
  type IssueInput,
  type Market,
  type Side,
} from "@/domain/hockey/challenges";
import { teamByAbbr } from "@/domain/hockey/fans";
import { FanAvatar } from "../FanTag";
import styles from "../hockey.module.css";

export interface Draft {
  readonly kind: ChallengeKind;
  readonly targetId?: string;
  readonly market?: Market;
  readonly side?: Side;
}

const KINDS: readonly ChallengeKind[] = [
  "bet",
  "defend",
  "commentary",
  "hottake",
  "prophecy",
];

const PLACEHOLDER: Readonly<Record<ChallengeKind, string>> = {
  bet: "Optional trash talk. Keep it about hockey.",
  defend: "Why your team is fine, actually. 280 characters. Make it count.",
  commentary: "“HE SHOOTS — and the building forgets how to breathe —”",
  hottake: "Your most indefensible hockey opinion.",
  prophecy: "Something specific that will (or won't) happen tonight.",
};

/**
 * **Throw it down: one sheet for every challenge.** Who, what, and — for a
 * bet — which side, as big buttons in the teams' own colours; a line of
 * trash talk if you want one. For yourself (volunteering, or a prophecy)
 * you write the thing now: going first is the point. The server decides
 * whether it stands — this sheet only makes it easy to ask.
 */
export function ThrowDown({
  draft,
  me,
  people,
  fans,
  game,
  promptIds,
  beforeStart,
  error,
  onSend,
  onClose,
}: {
  draft: Draft;
  me: Participant;
  people: readonly Participant[];
  fans: Readonly<Record<string, string>>;
  game: Game;
  /** Template questions on tonight (a bet rides on one). */
  promptIds: readonly string[];
  beforeStart: boolean;
  error: string | null;
  onSend: (input: IssueInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<ChallengeKind>(draft.kind);
  const others = people.filter((p) => p.id !== me.id);
  const selfKind = kind === "prophecy";
  const [target, setTarget] = useState<string>(
    draft.targetId ?? (selfKind ? me.id : (others[0]?.id ?? me.id)),
  );
  const markets = (Object.keys(MARKET_PROMPT) as Market[]).filter((m) =>
    promptIds.includes(MARKET_PROMPT[m]),
  );
  const [market, setMarket] = useState<Market>(
    draft.market ?? markets[0] ?? "winner",
  );
  const [side, setSide] = useState<Side | undefined>(draft.side);
  const [taunt, setTaunt] = useState("");
  const [entry, setEntry] = useState("");
  const [sending, setSending] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const who =
    kind === "prophecy"
      ? me.id
      : kind === "bet" && target === me.id
        ? others[0]?.id
        : target;
  const self = who === me.id;
  const person = people.find((p) => p.id === who);
  const theirTeam = teamByAbbr(who ? fans[who] : null);
  const needsEntry = self && kind !== "bet";
  const sides: readonly Side[] =
    market === "overtime"
      ? ["yes", "no"]
      : market === "goals"
        ? ["over", "under"]
        : ["home", "away"];
  const kindsHere = KINDS.filter(
    (k) => (k !== "bet" && k !== "prophecy") || beforeStart,
  ).filter((k) => k !== "bet" || (others.length > 0 && markets.length > 0));
  const ready =
    Boolean(who) &&
    (kind !== "bet" || Boolean(side)) &&
    (!needsEntry || entry.trim().length > 0);

  const send = async () => {
    if (!who || !ready || sending) return;
    setSending(true);
    const ok = await onSend({
      kind,
      targetId: who,
      ...(kind === "bet" ? { market, side } : {}),
      ...(taunt.trim() && !self ? { taunt: taunt.trim() } : {}),
      ...(needsEntry ? { entry: entry.trim() } : {}),
    });
    setSending(false);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="throw-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`${styles.sheet} flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-[#0b1220] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white ring-1 ring-white/15 outline-none sm:rounded-3xl`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="throw-title"
            className={`${styles.display} text-[34px] leading-[0.92]`}
          >
            {KIND_EMOJI[kind]} {KIND_TITLE[kind]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 ring-1 ring-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* What kind */}
        <div
          role="radiogroup"
          aria-label="What kind of challenge"
          className={`${styles.noScrollbar} -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1`}
        >
          {kindsHere.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                if (k === "prophecy") setTarget(me.id);
                else if (k === "bet" && target === me.id && others[0])
                  setTarget(others[0].id);
              }}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold transition ${
                kind === k
                  ? "bg-[#ffd84d] text-[#0b1220]"
                  : "bg-white/[0.08] text-white/80 ring-1 ring-white/15"
              }`}
            >
              <span aria-hidden>{KIND_EMOJI[k]}</span>
              {KIND_TITLE[k].replace(/^The /, "")}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[15px] leading-snug text-white/75">
          {self && kind !== "prophecy"
            ? "Volunteering: you go first, the jury rules. +3 if they're convinced."
            : kindAsk(kind, theirTeam?.name)}
        </p>

        {/* Who */}
        {kind !== "prophecy" && (
          <fieldset className="mt-4">
            <legend className="text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase">
              {kind === "bet" ? "Bet who" : "Who's up"}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(kind === "bet" ? others : [...others, me]).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={who === p.id}
                  onClick={() => setTarget(p.id)}
                  className={`inline-flex min-h-12 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 text-[15px] font-bold transition ${
                    who === p.id
                      ? "bg-white text-[#0b1220]"
                      : "bg-white/[0.07] text-white ring-1 ring-white/15"
                  }`}
                >
                  <FanAvatar person={p} size={34} />
                  {p.id === me.id ? "Me — I'll go first" : p.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* A bet: which question, which side */}
        {kind === "bet" && (
          <>
            <fieldset className="mt-4">
              <legend className="text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase">
                On
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {markets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={market === m}
                    onClick={() => {
                      setMarket(m);
                      setSide(undefined);
                    }}
                    className={`min-h-12 rounded-2xl px-3 text-[14.5px] font-bold transition ${
                      market === m
                        ? "bg-white text-[#0b1220]"
                        : "bg-white/[0.07] text-white ring-1 ring-white/15"
                    }`}
                  >
                    {MARKET_LABEL[m]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase">
                You say
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {sides.map((s) => {
                  const team =
                    s === "home"
                      ? game.homeTeam
                      : s === "away"
                        ? game.awayTeam
                        : null;
                  const chosen = side === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => setSide(s)}
                      className={`flex min-h-[76px] flex-col items-center justify-center rounded-2xl px-2 text-center transition active:scale-[0.97] ${
                        chosen
                          ? "ring-4 ring-[#ffd84d]"
                          : "ring-1 ring-white/15"
                      }`}
                      style={
                        team
                          ? {
                              background: team.colours.primary,
                              color: team.colours.ink,
                            }
                          : {
                              background: chosen
                                ? "#ffffff"
                                : "rgba(255,255,255,0.07)",
                              color: chosen ? "#0b1220" : "#fff",
                            }
                      }
                    >
                      {team && (
                        <span
                          className={`${styles.display} text-[26px] leading-none`}
                        >
                          {team.abbr}
                        </span>
                      )}
                      <span className="mt-1 text-[14px] leading-tight font-bold">
                        {sideWords(market, s, game)
                          .replace(/^the /, "")
                          .replace(/^./, (c) => c.toUpperCase())}
                      </span>
                    </button>
                  );
                })}
              </div>
              {side && person && (
                <p className="mt-2 text-[14px] text-white/70">
                  {person.name} gets{" "}
                  {sideWords(market, otherSide(market, side), game)}.
                  {market === "goals" && ` (The line is ${GOALS_LINE}.)`} Winner
                  +3. Settled by the host&apos;s call — the same one the picks
                  wait on.
                </p>
              )}
            </fieldset>
          </>
        )}

        {needsEntry && (
          <label className="mt-4 block">
            <span className="text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase">
              {kind === "prophecy" ? "Your prophecy" : "On the record"}
            </span>
            <textarea
              value={entry}
              onChange={(e) => setEntry(e.target.value.slice(0, 280))}
              rows={3}
              placeholder={PLACEHOLDER[kind]}
              className="mt-2 w-full rounded-2xl bg-white/[0.07] px-4 py-3 text-[16px] text-white ring-1 ring-white/15 placeholder:text-white/40 focus:ring-2 focus:ring-[#ffd84d] focus:outline-none"
            />
            <span className="mt-1 block text-right text-[12px] text-white/45">
              {entry.length}/280
            </span>
          </label>
        )}

        {!self && (
          <label className="mt-4 block">
            <span className="text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase">
              Trash talk{" "}
              <span className="font-medium tracking-normal text-white/40 normal-case">
                (optional)
              </span>
            </span>
            <input
              value={taunt}
              onChange={(e) => setTaunt(e.target.value.slice(0, 140))}
              placeholder={PLACEHOLDER.bet}
              className="mt-2 min-h-12 w-full rounded-2xl bg-white/[0.07] px-4 text-[16px] text-white ring-1 ring-white/15 placeholder:text-white/40 focus:ring-2 focus:ring-[#ffd84d] focus:outline-none"
            />
          </label>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-[#c8102e]/20 px-3 py-2 text-[14px] text-white"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!ready || sending}
          onClick={send}
          className={`${styles.display} mt-5 min-h-14 w-full rounded-2xl bg-[#ffd84d] text-[22px] text-[#0b1220] transition active:scale-[0.98] disabled:opacity-40`}
        >
          {sending
            ? "Sending…"
            : self
              ? kind === "prophecy"
                ? "Seal the prophecy"
                : "Put it on the record"
              : `Throw it at ${person?.name ?? "them"}`}
        </button>
        <p className="mt-2 text-center text-[12.5px] text-white/50">
          {self
            ? "Everybody on this night sees it. The jury is everybody else."
            : `${person?.name ?? "They"} can accept or pass. A pass is private — nobody else is told.`}
        </p>
      </div>
    </div>
  );
}
