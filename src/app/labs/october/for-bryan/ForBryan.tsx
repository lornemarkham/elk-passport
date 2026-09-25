"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useMedia } from "./useMedia";
import { Ambient } from "./Ambient";
import { Absence } from "./Absence";
import { Listen } from "./Listen";
import {
  CHAPTERS,
  CLUB_ALIVE,
  CLUB_REMAINS,
  ENDING,
  EVIDENCE,
  LAST,
  LAST_AFTER,
  NUMBERS,
  PICKS,
  RULES,
  USEFUL,
  type Line,
} from "./script";

/**
 * **For Bryan.**
 *
 * A stage, not a page. One chapter at a time, full bleed, advanced by a
 * deliberate act rather than by scrolling — so pacing belongs to the thing
 * being shown, and a chapter is allowed to refuse to move on until something
 * has happened.
 *
 * ## October knows what she is inside
 *
 * The phone and the desktop are genuinely different instruments and are
 * treated as such. `do not turn` means one thing when you can rotate the
 * device in your hand and nothing at all when you cannot, so on a phone it is
 * an orientation it watches, and on a desktop it is a shadow that arrives on
 * the wrong side. The rules chapter asks a thumb to stay where it is on touch
 * and keeps its distance from the pointer on a mouse. None of it asks for a
 * permission.
 *
 * ## Restraint
 *
 * No glitch, no shake, no jump. The two places she is enormous are the only
 * two places anything is loud, and everything around them is nearly empty so
 * that those land. Most of the movement on this page is slow enough that the
 * honest reaction is *did that move?*
 */

const IN = 1000;
const OUT = 700;

/** A chapter of plain lines, spoken one at a time. */
function Lines({
  lines,
  onDone,
}: {
  readonly lines: readonly Line[];
  readonly onDone: () => void;
}) {
  // No reset effect: the stage remounts this per chapter, so the index is
  // fresh by construction rather than by correction.
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(
      () => (i < lines.length - 1 ? setI((n) => n + 1) : onDone()),
      lines[i]!.hold,
    );
    return () => clearTimeout(t);
  }, [i, lines, onDone]);

  const line = lines[i]!;
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: IN / 1000 } }}
        exit={{ opacity: 0, transition: { duration: OUT / 1000 } }}
        className={
          line.huge
            ? "font-heading text-center text-4xl leading-none tracking-tight text-balance text-[#f3efe4] sm:text-7xl"
            : line.small
              ? "text-center text-base text-[#e9e6da]/45 sm:text-lg"
              : "font-heading text-center text-2xl leading-snug text-balance text-[#f3efe4]/90 sm:text-4xl"
        }
      >
        {line.text}
      </motion.p>
    </AnimatePresence>
  );
}

export function ForBryan() {
  const reduced = useReducedMotion() ?? false;
  const touch = useMedia("(pointer: coarse)");
  const [chapter, setChapter] = useState(0);
  const next = useCallback(
    () => setChapter((c) => Math.min(c + 1, CHAPTERS.length - 1)),
    [],
  );

  const here = CHAPTERS[chapter]!;
  const last = chapter === CHAPTERS.length - 1;
  // A chapter of spoken lines ends itself. Offering a way on as well let both
  // fire and skipped the chapter after it, so the affordance only exists where
  // October is actually waiting for you.
  const selfPaced = here.kind === "lines";

  // A way on, offered quietly and only once the chapter has settled.
  // Which chapter the offer belongs to, rather than a boolean that has to be
  // switched off again on the way in — nothing is set synchronously here.
  const [offerFor, setOfferFor] = useState(-1);
  useEffect(() => {
    if (last || selfPaced) return;
    const t = setTimeout(() => setOfferFor(chapter), 5200);
    return () => clearTimeout(t);
  }, [chapter, last, selfPaced]);
  const offer = offerFor === chapter;

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#08070a] text-[#e9e6da] select-none">
      <Ambient reduced={reduced} />
      <Absence />

      <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-7 py-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={here.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 1.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="w-full max-w-2xl"
          >
            {here.kind === "lines" ? (
              <div className="flex min-h-[38vh] items-center justify-center">
                <Lines lines={here.lines} onDone={next} />
              </div>
            ) : here.kind === "ordinary" ? (
              <Ordinary />
            ) : here.kind === "numbers" ? (
              <Numbers touch={touch} />
            ) : here.kind === "rules" ? (
              <Rules touch={touch} />
            ) : here.kind === "turn" ? (
              <Turn touch={touch} />
            ) : here.kind === "recommends" ? (
              <Recommends />
            ) : here.kind === "club" ? (
              <Club />
            ) : here.kind === "evidence" ? (
              <Evidence />
            ) : here.kind === "listen" ? (
              <Listen />
            ) : (
              <Ending />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!last && !selfPaced ? (
        <button
          type="button"
          onClick={next}
          aria-label="Go on"
          className={`fixed inset-x-0 bottom-0 z-20 flex h-24 cursor-pointer items-center justify-center text-[11px] tracking-[0.35em] uppercase transition-opacity duration-[2000ms] ${
            offer
              ? "text-[#e9e6da]/25 hover:text-[#e9e6da]/60"
              : "text-transparent"
          }`}
        >
          go on
        </button>
      ) : null}
    </main>
  );
}

/* ------------------------------------------------------------- the ordinary */

/**
 * The floor, before it goes. Written to be genuinely dull: this is a product
 * that helps you find a pumpkin patch, and if it does not read as real here
 * then nothing later is worth anything.
 */
function Ordinary() {
  const [shown, setShown] = useState(0);
  const [mark, setMark] = useState(false);
  useEffect(() => {
    if (shown > USEFUL.length) return;
    const t = setTimeout(
      () => setShown((n) => n + 1),
      shown === 0 ? 1800 : 1000,
    );
    return () => clearTimeout(t);
  }, [shown]);
  useEffect(() => {
    const t = setTimeout(() => setMark(true), 8600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      <p className="font-heading text-2xl leading-snug text-balance text-[#f3efe4]/90 sm:text-3xl">
        We were trying to help people find something fun to do.
      </p>
      <ul className="mt-10 flex flex-col gap-3">
        {USEFUL.map((u, i) => (
          <li
            key={u}
            className="text-lg text-[#e9e6da]/60 transition-opacity duration-[1400ms]"
            style={{ opacity: i < shown ? 1 : 0 }}
          >
            <span className="mr-3 text-[#d09a4e]/40">·</span>
            {u}
          </li>
        ))}
      </ul>
      {/* Nothing acknowledges this, now or later. */}
      <span
        className="font-heading absolute -right-2 -bottom-16 text-6xl text-[#e9e6da] transition-opacity duration-[4000ms] select-none sm:-right-16"
        style={{ opacity: mark ? 0.07 : 0 }}
        aria-hidden
      >
        10
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- the numbers */

/** Her language, made of three numerals and one word each. */
function Numbers({ touch }: { readonly touch: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      {NUMBERS.map((n, i) => (
        <button
          key={n.n}
          type="button"
          onPointerEnter={() => !touch && setOpen(i)}
          onPointerLeave={() => !touch && setOpen(null)}
          onClick={() => setOpen(open === i ? null : i)}
          className="group flex cursor-pointer items-baseline gap-6 text-left sm:gap-10"
        >
          <span className="font-heading text-6xl leading-none text-[#f3efe4]/80 tabular-nums transition-colors duration-700 group-hover:text-[#d09a4e] sm:text-8xl">
            {n.n}
          </span>
          <span className="flex flex-col">
            <span className="text-[11px] tracking-[0.3em] text-[#d09a4e]/70 uppercase">
              {n.word}
            </span>
            <span
              className="font-heading mt-1 text-lg text-[#e9e6da]/70 transition-opacity duration-700 sm:text-xl"
              style={{ opacity: open === i ? 1 : 0 }}
            >
              {n.says}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- the rules */

/**
 * On a phone she asks for a thumb and speaks only while it stays. On a desktop
 * the rules keep away from the cursor — the one you are reaching for is the one
 * that goes quiet.
 */
function Rules({ touch }: { readonly touch: boolean }) {
  const [held, setHeld] = useState(false);
  const [n, setN] = useState(0);
  const [near, setNear] = useState(-1);
  const box = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!touch) return;
    if (!held) return;
    if (n >= RULES.length) return;
    const t = setTimeout(() => setN((v) => v + 1), n === 0 ? 700 : 1900);
    return () => clearTimeout(t);
  }, [held, n, touch]);

  if (touch) {
    return (
      <div className="flex flex-col items-center">
        <p className="font-heading text-center text-xl text-[#f3efe4]/85">
          keep your thumb here
        </p>
        <button
          type="button"
          aria-label="Hold"
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onPointerCancel={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="mt-8 size-24 rounded-full border transition-all duration-700"
          style={{
            borderColor: held
              ? "rgba(208,154,78,0.6)"
              : "rgba(233,230,218,0.14)",
            boxShadow: held ? "0 0 60px 8px rgba(255,190,110,0.18)" : "none",
            transform: held ? "scale(0.96)" : "scale(1)",
          }}
        />
        <ul className="mt-10 flex min-h-[34vh] w-full flex-col items-center gap-3">
          {RULES.slice(0, n).map((r) => (
            <li
              key={r}
              className="font-heading text-center text-base text-[#e9e6da]/70"
              style={{ animation: "fb-rule 1200ms ease-out both" }}
            >
              {r}
            </li>
          ))}
        </ul>
        {!held && n > 0 ? (
          <p className="mt-2 text-sm text-[#e9e6da]/30 italic">you let go</p>
        ) : null}
        <style>{`@keyframes fb-rule { from { opacity: 0 } to { opacity: 1 } }`}</style>
      </div>
    );
  }

  return (
    <ul
      ref={box}
      // Measured in the handler rather than during render: the rule you are
      // reaching for is the one that goes quiet, and nothing announces it.
      onPointerMove={(e) => {
        const kids = Array.from(e.currentTarget.children);
        let closest = -1;
        let best = 70;
        kids.forEach((k, i) => {
          const r = k.getBoundingClientRect();
          const d = Math.abs(e.clientY - (r.top + r.height / 2));
          if (d < best) {
            best = d;
            closest = i;
          }
        });
        setNear(closest);
      }}
      onPointerLeave={() => setNear(-1)}
      className="flex min-h-[46vh] flex-col justify-center gap-5"
    >
      {RULES.map((r, i) => (
        <li
          key={r}
          className="font-heading text-lg text-[#e9e6da] transition-all duration-[900ms] sm:text-xl"
          style={{
            opacity: near === i ? 0.14 : 0.72,
            transform: near === i ? "translateX(12px)" : "translateX(0)",
          }}
        >
          <span className="mr-4 text-[#d09a4e]/30 select-none">—</span>
          {r}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ do not turn */

/**
 * The instruction that means two different things.
 *
 * Held in the hand it is about the device: rotate it and she notices, which is
 * only possible because a phone can be turned. On a desktop nothing can be
 * rotated, so instead the light goes round behind the words — the shadow ends
 * up on the wrong side, and she says it anyway.
 */
function Turn({ touch }: { readonly touch: boolean }) {
  const [turned, setTurned] = useState(false);
  const [behind, setBehind] = useState(false);

  useEffect(() => {
    if (!touch) {
      const t = setTimeout(() => setBehind(true), 3200);
      return () => clearTimeout(t);
    }
    const portrait = window.matchMedia("(orientation: portrait)");
    const start = portrait.matches;
    const check = () => {
      if (portrait.matches !== start) setTurned(true);
    };
    portrait.addEventListener("change", check);
    return () => portrait.removeEventListener("change", check);
  }, [touch]);

  return (
    <div className="flex min-h-[42vh] flex-col items-center justify-center">
      <p
        className="font-heading text-center text-3xl tracking-tight text-[#f3efe4] transition-all duration-[2600ms] sm:text-5xl"
        style={{
          textShadow: behind
            ? "0 -18px 40px rgba(255,180,100,0.16), 0 6px 0 rgba(0,0,0,0.9)"
            : "0 18px 40px rgba(255,180,100,0.06)",
        }}
      >
        do not turn
      </p>

      {touch ? (
        <p
          className="mt-10 text-center text-base text-[#e9e6da]/60 transition-opacity duration-1000"
          style={{ opacity: turned ? 1 : 0.28 }}
        >
          {turned ? "I said do not turn." : "(you are holding me)"}
        </p>
      ) : (
        <p
          className="mt-10 text-center text-sm text-[#e9e6da]/30 transition-opacity duration-[2600ms]"
          style={{ opacity: behind ? 1 : 0 }}
        >
          the light moved behind it
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- what to watch */

function Recommends() {
  return (
    <div>
      <p className="text-[11px] tracking-[0.3em] text-[#d09a4e]/70 uppercase">
        October thinks you should watch something
      </p>
      <ul className="mt-8 flex flex-col gap-7">
        {PICKS.map((p) => (
          <li key={p.title}>
            <p className="font-heading text-xl text-[#f3efe4] sm:text-2xl">
              {p.title}
              {p.fresh ? (
                <span className="ml-3 align-middle text-[10px] tracking-[0.2em] text-[#d09a4e]/60 uppercase">
                  new
                </span>
              ) : null}
            </p>
            <p className="mt-1 leading-relaxed text-[#e9e6da]/55 italic">
              {p.says}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-[#e9e6da]/30">
        I am not a database. I have opinions.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- the club */

/** The escape room, teased only. Enough to see it, not enough to build it. */
function Club() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const at = [
      1400, 2200, 2900, 3500, 4000, 4400, 5400, 7000, 8600, 10200, 11800,
    ];
    const timers = at.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const black = step >= 7 && step < 8;

  return (
    <div
      className="flex min-h-[52vh] flex-col items-center justify-center transition-colors duration-300"
      style={{ background: black ? "#000" : undefined }}
    >
      {step < 7 ? (
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3">
          {CLUB_ALIVE.slice(0, step).map((w) => (
            <li
              key={w}
              className="font-heading text-2xl text-[#f3efe4]/85 sm:text-4xl"
              style={{ animation: "fb-alive 500ms ease-out both" }}
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      {step === 7 ? (
        <p className="font-heading text-5xl tracking-[0.2em] text-[#f3efe4] sm:text-7xl">
          BLACK
        </p>
      ) : null}

      {step >= 8 ? (
        <div className="w-full">
          <p className="text-center text-[11px] tracking-[0.3em] text-[#d09a4e]/60 uppercase">
            emergency lighting
          </p>
          <p className="font-heading mt-6 text-center text-2xl text-balance text-[#f3efe4]/90 sm:text-3xl">
            Everyone is gone.
          </p>
          <ul className="mt-8 flex flex-col items-center gap-2">
            {CLUB_REMAINS.map((r, i) => (
              <li
                key={r}
                className="text-center text-[#e9e6da]/55 transition-opacity duration-[1600ms]"
                style={{ opacity: step >= 9 + i ? 1 : 0 }}
              >
                {r}
              </li>
            ))}
          </ul>
          <p
            className="mt-10 text-center text-sm text-[#e9e6da]/35 transition-opacity duration-[2000ms]"
            style={{ opacity: step >= 11 ? 1 : 0 }}
          >
            The doors are locked. You escape, eventually, and the band comes
            back in on exactly the beat they left.
            <br />
            Nobody else noticed anything.
          </p>
          <p
            className="font-heading mt-6 text-center text-xl text-[#f3efe4]/85 transition-opacity duration-[2000ms]"
            style={{ opacity: step >= 11 ? 1 : 0 }}
          >
            “you took forever.”
          </p>
        </div>
      ) : null}
      <style>{`@keyframes fb-alive { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- evidence */

/** Not a menu. Things that already got out. */
function Evidence() {
  return (
    <div>
      <p className="text-[11px] tracking-[0.3em] text-[#d09a4e]/70 uppercase">
        Some of it already got out
      </p>
      <ul className="mt-8 flex flex-col gap-1">
        {EVIDENCE.map((e) => (
          <li key={e.href}>
            <Link
              href={e.href}
              className="group block rounded-lg px-4 py-4 transition-colors hover:bg-[#e9e6da]/[0.04]"
            >
              <p className="font-heading text-xl text-[#f3efe4] group-hover:text-[#d09a4e] sm:text-2xl">
                {e.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#e9e6da]/50 italic">
                {e.says}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 px-4 text-sm text-[#e9e6da]/25">
        They open in here. Come back when you are finished.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- ending */

/** Hers. No ask, no sign-off, and a long wait before the last thing. */
function Ending() {
  const [i, setI] = useState(0);
  const [last, setLast] = useState(false);

  useEffect(() => {
    if (i >= ENDING.length) return;
    const t = setTimeout(() => setI((n) => n + 1), ENDING[i]!.hold);
    return () => clearTimeout(t);
  }, [i]);

  useEffect(() => {
    if (i < ENDING.length) return;
    const t = setTimeout(() => setLast(true), LAST_AFTER);
    return () => clearTimeout(t);
  }, [i]);

  return (
    <div className="flex min-h-[54vh] flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {ENDING.map((l, n) => (
          <p
            key={l.text}
            className={`font-heading text-center transition-opacity duration-[2200ms] ${
              n === ENDING.length - 1
                ? "mt-6 text-2xl text-[#f3efe4] sm:text-4xl"
                : "text-xl text-[#e9e6da]/60 sm:text-2xl"
            }`}
            style={{ opacity: n < i ? 1 : 0 }}
          >
            {l.text}
          </p>
        ))}
      </div>

      <p
        className="mt-20 text-center text-base text-[#e9e6da]/40 transition-opacity duration-[4000ms] sm:text-lg"
        style={{ opacity: last ? 1 : 0 }}
      >
        {LAST}
      </p>
    </div>
  );
}
