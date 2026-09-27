"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  readOctoberMemory,
  rememberEncounter,
  type Door,
  type Hearing,
  type NumberChoice,
} from "@/lib/october/foundYou";
import {
  AFTER_EXIT_BLACK,
  ASK_DOOR,
  ASK_HEARING,
  ASK_NUMBER,
  ENDING,
  EXIT_LABEL,
  NUMBERS,
  OPENING,
  OVERLOOKED,
  RECOGNITION,
  ambiguousRecall,
  greets,
  onHearing,
  onNumber,
  plainRecall,
  type Choices,
} from "./encounter";

/**
 * **October Found You.**
 *
 * A small encounter that behaves like a game for about a minute and then stops
 * behaving like one. The visitor makes three primitive choices; October brings
 * one of them back twice, the second time in a way that does not quite fit;
 * and the way out turns out to be the point.
 *
 * ## The waits are the content
 *
 * Every pause here is written. Nothing on this page is loading, and nothing
 * should ever be drawn over a silence to reassure somebody — the reassurance
 * is what would kill it. The only motion is opacity.
 *
 * ## Mobile first, genuinely
 *
 * Most visitors will arrive from a code on a phone, so the choices are large
 * and low on the screen where a thumb already is, nothing depends on hover,
 * and the stage is sized in `svh` so the address bar cannot crop the ending.
 */

const IN = 1100;
const OUT = 800;

type Phase =
  | "arrive"
  | "opening"
  | "number"
  | "numberReply"
  | "door"
  | "plain"
  | "hearing"
  | "hearingReply"
  | "overlooked"
  | "ambiguous"
  | "exit"
  | "black"
  | "ending"
  | "after";

/** One line, alone, centred. The only thing this page ever draws. */
function Say({
  text,
  size = "normal",
}: {
  readonly text: string;
  readonly size?: "normal" | "small";
}) {
  return (
    <motion.p
      key={text}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: IN / 1000 } }}
      exit={{ opacity: 0, transition: { duration: OUT / 1000 } }}
      className={
        size === "small"
          ? "text-center text-base text-[#e9e6da]/45"
          : "font-heading text-center text-2xl leading-snug text-balance text-[#f3efe4]/90 sm:text-4xl"
      }
    >
      {text}
    </motion.p>
  );
}

/** A choice. Big, quiet, and the same on both devices. */
function Choice({
  label,
  onPick,
  wide,
}: {
  readonly label: string;
  readonly onPick: () => void;
  readonly wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`min-h-14 cursor-pointer rounded-full border border-[#e9e6da]/15 text-[#e9e6da]/75 transition-colors hover:border-[#d09a4e]/50 hover:bg-[#d09a4e]/[0.07] hover:text-[#f3efe4] focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none ${
        wide ? "px-9" : "w-20"
      } font-heading text-lg tracking-wide`}
    >
      {label}
    </button>
  );
}

export function FoundYou() {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("arrive");
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Choices>({});
  /** Whether she had met this visitor *before tonight*. Read once. */
  const knownBefore = useSyncExternalStore(
    // Storage is not reactive and nothing else writes it while this is open,
    // so there is nothing to subscribe to — but reading it this way keeps the
    // answer out of an effect that would have to correct itself after mount.
    () => () => {},
    () => greets(readOctoberMemory().found),
    () => false,
  );
  const saved = useRef(false);

  /** Move to a phase and restart its internal counter. */
  const go = useCallback((p: Phase) => {
    setStep(0);
    setPhase(p);
  }, []);

  // ------------------------------------------------------------ the timeline
  useEffect(() => {
    const wait = (ms: number, then: () => void) => {
      const t = setTimeout(then, ms);
      return () => clearTimeout(t);
    };

    if (phase === "arrive") {
      // Longer for a stranger; she does not pounce on anybody.
      return wait(knownBefore ? 2400 : 2000, () => go("opening"));
    }
    // Each list phase ends itself from inside its own last wait. Overshooting
    // the index and correcting it afterwards would mean changing state while
    // rendering, and would flash an empty beat on the way past.
    const through = (
      count: number,
      hold: number,
      onEnd: () => void,
    ): (() => void) =>
      wait(hold, () => (step < count - 1 ? setStep((n) => n + 1) : onEnd()));

    if (phase === "opening") {
      const line = OPENING[step];
      if (!line) return;
      return through(OPENING.length, line.hold, () => go("number"));
    }
    if (phase === "numberReply") {
      const lines = choices.number ? onNumber(choices.number) : [];
      if (!lines.length) return wait(900, () => go("door"));
      return through(lines.length, step === 0 ? 2600 : 3200, () => go("door"));
    }
    if (phase === "plain") {
      return wait(3600, () => go("hearing"));
    }
    if (phase === "hearingReply") {
      const lines = choices.hearing ? onHearing(choices.hearing) : [];
      const line = lines[step];
      if (!line) return wait(0, () => go("overlooked"));
      return through(lines.length, line.hold, () => go("overlooked"));
    }
    if (phase === "overlooked") {
      const line = OVERLOOKED[step];
      if (!line) return wait(0, () => go("ambiguous"));
      return through(OVERLOOKED.length, line.hold, () => go("ambiguous"));
    }
    if (phase === "ambiguous") {
      return wait(5200, () => go("exit"));
    }
    if (phase === "black") {
      return wait(AFTER_EXIT_BLACK, () => go("ending"));
    }
    if (phase === "ending") {
      const line = ENDING[step];
      if (!line) return wait(0, () => go("after"));
      return through(ENDING.length, line.hold, () => go("after"));
    }
    return;
  }, [phase, step, choices, knownBefore, go]);

  // She keeps it once, at the ending, not on the way past.
  useEffect(() => {
    if (phase !== "ending" || saved.current) return;
    saved.current = true;
    rememberEncounter({
      number: choices.number,
      door: choices.door,
      hearing: choices.hearing,
    });
  }, [phase, choices]);

  const pickNumber = useCallback(
    (n: NumberChoice) => {
      setChoices((c) => ({ ...c, number: n }));
      go("numberReply");
    },
    [go],
  );
  const pickDoor = useCallback(
    (d: Door) => {
      setChoices((c) => ({ ...c, door: d }));
      go("plain");
    },
    [go],
  );
  const pickHearing = useCallback(
    (h: Hearing) => {
      setChoices((c) => ({ ...c, hearing: h }));
      go("hearingReply");
    },
    [go],
  );

  const black = phase === "black";

  return (
    <main
      data-testid="found-you"
      data-phase={phase}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#08070a] px-7 py-16 text-[#e9e6da] select-none"
      style={{ background: black ? "#000" : undefined }}
    >
      <div className="flex min-h-[34vh] w-full max-w-lg items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === "arrive" && knownBefore ? (
            <Say key="recognise" text={RECOGNITION} />
          ) : phase === "opening" && OPENING[step] ? (
            <Say key={`o${step}`} text={OPENING[step]!.text} />
          ) : phase === "number" ? (
            <Say key="askn" text={ASK_NUMBER} />
          ) : phase === "numberReply" && choices.number ? (
            <Say
              key={`nr${step}`}
              text={onNumber(choices.number)[step] ?? ""}
            />
          ) : phase === "door" ? (
            <Say key="askd" text={ASK_DOOR} />
          ) : phase === "plain" ? (
            <Say key="plain" text={plainRecall(choices)} />
          ) : phase === "hearing" ? (
            <Say key="askh" text={ASK_HEARING} />
          ) : phase === "hearingReply" && choices.hearing ? (
            <Say
              key={`hr${step}`}
              text={onHearing(choices.hearing)[step]?.text ?? ""}
            />
          ) : phase === "overlooked" && OVERLOOKED[step] ? (
            <Say key={`ov${step}`} text={OVERLOOKED[step]!.text} />
          ) : phase === "ambiguous" ? (
            <Say key="amb" text={ambiguousRecall()} />
          ) : phase === "ending" && ENDING[step] ? (
            <Say key={`e${step}`} text={ENDING[step]!.text} />
          ) : phase === "after" ? (
            <Say key="after" text="" />
          ) : null}
        </AnimatePresence>
      </div>

      {/* The choices sit low, where a thumb already is. */}
      <div className="flex min-h-[22vh] w-full max-w-lg items-start justify-center pt-6">
        <AnimatePresence mode="wait">
          {phase === "number" ? (
            <motion.div
              key="cn"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: 1.4, delay: 0.8 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              className="flex gap-4"
            >
              {NUMBERS.map((n) => (
                <Choice key={n} label={n} onPick={() => pickNumber(n)} />
              ))}
            </motion.div>
          ) : phase === "door" ? (
            <motion.div
              key="cd"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: 1.4, delay: 0.8 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              className="flex gap-4"
            >
              <Choice label="STAY" wide onPick={() => pickDoor("STAY")} />
              <Choice label="LEAVE" wide onPick={() => pickDoor("LEAVE")} />
            </motion.div>
          ) : phase === "hearing" ? (
            <motion.div
              key="ch"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: 1.4, delay: 1.2 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              className="flex gap-4"
            >
              <Choice label="YES" wide onPick={() => pickHearing("YES")} />
              <Choice label="NO" wide onPick={() => pickHearing("NO")} />
            </motion.div>
          ) : phase === "exit" ? (
            <motion.button
              key="cx"
              type="button"
              data-testid="exit"
              onClick={() => go("black")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 2.2, delay: 1 } }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              className="font-heading min-h-14 cursor-pointer rounded-full border border-[#d09a4e]/40 px-12 text-lg tracking-[0.3em] text-[#d09a4e] transition-colors hover:bg-[#d09a4e]/10 hover:text-[#f3efe4] focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none"
            >
              {EXIT_LABEL}
            </motion.button>
          ) : phase === "after" ? (
            <motion.a
              key="ca"
              href="/october"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 3, delay: 1.5 } }}
              className="text-sm text-[#e9e6da]/25 underline-offset-8 transition-colors hover:text-[#e9e6da]/55 hover:underline"
            >
              back to October
            </motion.a>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Present from the first breath and never mentioned. Not decoration —
          it is the only thing on screen that was already here. */}
      {!reduced && !black ? (
        <span
          aria-hidden
          className="font-heading pointer-events-none absolute right-[8%] bottom-[9%] text-[16vmin] leading-none text-[#e9e6da] select-none"
          style={{ opacity: 0.028 }}
        >
          10
        </span>
      ) : null}
    </main>
  );
}
