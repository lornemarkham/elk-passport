"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  fearLevelsFor,
  shortlist,
  type Audience,
  type Fear,
  type Film,
} from "@/lib/movies/catalogue";
import {
  AUDIENCES,
  AUDIENCE_QUESTION,
  COMMITTED,
  FEAR_COPY,
  FEAR_QUESTION,
  OPENING,
} from "@/lib/movies/voice";
import { wantToDo } from "@/lib/october/october-repo";
import { isSignedOut } from "@/lib/data/boards-repo";
import type { MovieReaction } from "@/lib/movies/types";

/**
 * **Movie Night.** A Surface, not a Scene (bible §3.1): it exists to help
 * somebody choose something great, and to learn their taste by being used.
 *
 * Three steps and no more — who's here, how much, three films. The
 * **interaction is identical for every audience**; only October's wording
 * moves (`voice.ts`), because a five-year-old's movie night is not a horror
 * mistake and pretending otherwise would be the same lie as a cozy haunted
 * house.
 *
 * Two axes stay apart the whole way down. The audience question filters by
 * suitability and never touches fear; the fear question offers only the levels
 * the catalogue can actually fill for that room — which is "we have nothing",
 * not "children cannot be frightened". Coraline is in the kids set and is
 * creepy, and that is the point.
 */
type Step = "audience" | "fear" | "shortlist" | "committed";

interface MovieNightProps {
  readonly signedIn: boolean;
  readonly reactions: readonly MovieReaction[];
}

export function MovieNight({ signedIn, reactions }: MovieNightProps) {
  const reduced = useReducedMotion() ?? false;
  const [step, setStep] = useState<Step>("audience");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [fear, setFear] = useState<Fear | null>(null);
  const [chosen, setChosen] = useState<Film | null>(null);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);

  /** Films they have already told us about — a shortlist should move on. */
  const seen = useMemo(
    () => new Set(reactions.map((r) => r.filmId)),
    [reactions],
  );

  const levels = audience ? fearLevelsFor(audience) : [];
  const films =
    audience && fear ? shortlist(audience, fear, { exclude: seen, seed }) : [];

  async function commit(film: Film) {
    setChosen(film);
    setStep("committed");
    if (!signedIn) return;

    setBusy(true);
    try {
      // The same October everything else goes into. Movie Night does not
      // invent a second place to keep things.
      await wantToDo({
        entityId: film.id,
        entityKind: "Movie",
        name: `${film.title} (${film.year})`,
      });
    } catch (error) {
      toast.error(
        isSignedOut(error)
          ? "Your session ended. Sign in again to keep this."
          : "Couldn't add that to your October.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0d14] text-[#e9e6da]">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-14">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-[#8a5a24]">Movie Night</p>
          <Link
            href="/october/mine"
            className="min-h-11 text-xs text-[#e9e6da]/40 underline-offset-4 hover:underline"
          >
            My October
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {/* ------------------------------------------------- who's here */}
          {step === "audience" && (
            <Panel key="audience" reduced={reduced}>
              <p className="font-serif text-2xl text-[#e9e6da]/70">{OPENING}</p>
              <h1 className="font-heading mt-6 text-3xl">
                {AUDIENCE_QUESTION}
              </h1>
              <ul className="mt-6 flex flex-col" data-testid="audiences">
                {AUDIENCES.map((option) => (
                  <li key={option.id}>
                    <Choice
                      label={option.label}
                      whisper={option.whisper}
                      testId={`audience-${option.id}`}
                      onClick={() => {
                        setAudience(option.id);
                        setFear(null);
                        setStep("fear");
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* ------------------------------------------------- how much */}
          {step === "fear" && audience && (
            <Panel key="fear" reduced={reduced}>
              <h1 className="font-heading text-3xl">
                {FEAR_QUESTION[audience]}
              </h1>
              <ul className="mt-6 flex flex-col" data-testid="fears">
                {levels.map((level) => (
                  <li key={level}>
                    <Choice
                      label={FEAR_COPY[audience][level].label}
                      whisper={FEAR_COPY[audience][level].whisper}
                      testId={`fear-${level}`}
                      onClick={() => {
                        setFear(level);
                        setStep("shortlist");
                      }}
                    />
                  </li>
                ))}
              </ul>
              <BackLink onClick={() => setStep("audience")} />
            </Panel>
          )}

          {/* ------------------------------------------------- three films */}
          {step === "shortlist" && audience && fear && (
            <Panel key="shortlist" reduced={reduced}>
              <h1 className="font-heading text-3xl">
                {films.length > 0 ? "Three." : "Nothing left."}
              </h1>
              {films.length === 0 ? (
                <p className="mt-4 text-[#e9e6da]/60">
                  You&apos;ve seen everything Passport knows at that level. Try
                  another, or come back when the catalogue grows.
                </p>
              ) : (
                <ul
                  className="mt-6 flex flex-col gap-3"
                  data-testid="shortlist"
                >
                  {films.map((film) => (
                    <FilmCard
                      key={film.id}
                      film={film}
                      onPick={() => void commit(film)}
                    />
                  ))}
                </ul>
              )}
              <div className="mt-6 flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setSeed((s) => s + 3)}
                  className="min-h-11 text-sm text-[#e9e6da]/50 underline-offset-4 hover:underline"
                  data-testid="none-of-these"
                >
                  none of these
                </button>
                <BackLink onClick={() => setStep("fear")} inline />
              </div>
            </Panel>
          )}

          {/* ------------------------------------------------- committed */}
          {step === "committed" && chosen && audience && (
            <Panel key="committed" reduced={reduced}>
              <p className="font-serif text-2xl text-[#e9e6da]/70">
                {COMMITTED[audience]}
              </p>
              <h1 className="font-heading mt-5 text-3xl">{chosen.title}</h1>
              <p className="mt-1 text-sm text-[#e9e6da]/50">
                {chosen.year} · {chosen.runtimeMinutes} min ·{" "}
                {chosen.certification.code} ({chosen.certification.system})
              </p>
              <p className="mt-5 max-w-md leading-relaxed text-[#e9e6da]/75">
                {chosen.line}
              </p>
              <p className="mt-8 text-sm text-[#e9e6da]/45">
                {signedIn
                  ? busy
                    ? "Keeping it…"
                    : "It's in your October. Tell me what you thought when it's over."
                  : "Sign in and it would be waiting in your October."}
              </p>
              <div className="mt-6 flex items-center gap-5">
                <Link
                  href="/october/mine"
                  className="inline-flex min-h-11 items-center rounded-full bg-[#e9e6da] px-5 text-sm font-medium text-[#0b0d14]"
                >
                  My October
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setChosen(null);
                    setStep("shortlist");
                  }}
                  className="min-h-11 text-sm text-[#e9e6da]/50 underline-offset-4 hover:underline"
                >
                  actually, something else
                </button>
              </div>
            </Panel>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Panel({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -6 }}
      transition={{
        duration: reduced ? 0.15 : 0.5,
        ease: [0.22, 0.61, 0.36, 1],
      }}
      className="mt-16 flex-1"
    >
      {children}
    </motion.section>
  );
}

function Choice({
  label,
  whisper,
  onClick,
  testId,
}: {
  label: string;
  whisper: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group flex min-h-14 w-full flex-col items-start rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
    >
      <span className="font-serif text-xl">{label}</span>
      <span className="text-sm text-[#e9e6da]/45 transition-colors group-hover:text-[#e9e6da]/70">
        {whisper}
      </span>
    </button>
  );
}

function FilmCard({ film, onPick }: { film: Film; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        data-testid={`film-${film.id}`}
        className="flex w-full flex-col items-start rounded-xl border border-[#e9e6da]/12 p-4 text-left transition-colors hover:border-[#e9e6da]/30 hover:bg-white/[0.03]"
      >
        <span className="font-heading text-xl">{film.title}</span>
        <span className="mt-0.5 text-xs text-[#e9e6da]/45">
          {film.year} · {film.runtimeMinutes} min ·{" "}
          <span data-testid={`cert-${film.id}`}>{film.certification.code}</span>
        </span>
        <span className="mt-2 text-sm leading-relaxed text-[#e9e6da]/70">
          {film.line}
        </span>
        {film.mechanisms.length > 0 && (
          <span className="mt-3 flex flex-wrap gap-1.5">
            {film.mechanisms.slice(0, 3).map((m) => (
              <span
                key={m}
                className="rounded-full border border-[#8a5a24]/40 px-2 py-0.5 text-[10px] tracking-wide text-[#c89b6a] uppercase"
              >
                {m}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

function BackLink({
  onClick,
  inline = false,
}: {
  onClick: () => void;
  inline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${inline ? "" : "mt-8"}min-h-11 text-sm text-[#e9e6da]/40 underline-offset-4 hover:underline`}
    >
      ← back
    </button>
  );
}
