"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Participant } from "@/experience-lab/core/types";
import { answerText, verdictFor, type Verdict } from "@/domain/hockey/reveal";
import styles from "./hockey.module.css";

/**
 * **The picks, face down, until you turn them over.**
 *
 * Once the picks lock, everybody's answers arrive — the database decides
 * that, not this component — and they arrive as cards to flip, one at a
 * time or all at once, because "Maya had 2–3 Wild" is funnier as a reveal
 * than as a row. Once the host calls a result, each card says whether it was
 * right, half right or wrong, by the engine's own scoring.
 */
export function RevealBoard({
  prompts,
  people,
  morning,
}: {
  prompts: readonly LivePrompt[];
  people: readonly Participant[];
  morning: boolean;
}) {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const keys = prompts.flatMap((p) =>
    p.responses.map((r) => `${p.prompt.id}:${r.participantId}`),
  );
  const allFlipped = keys.length > 0 && keys.every((k) => flipped.has(k));
  if (keys.length === 0) return null;

  return (
    <section aria-labelledby="reveal-title">
      <div className="mb-4 flex flex-col items-start gap-3">
        <div>
          <h2
            id="reveal-title"
            className={`${styles.wide} text-[28px] leading-none text-white`}
          >
            {morning ? "Who called it" : "The picks are out"}
          </h2>
          <p className="mt-2 text-[15px] leading-snug text-white/70">
            {morning
              ? "Every sealed pick, and how it went."
              : "Sealed until puck drop. Turn them over."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFlipped(allFlipped ? new Set() : new Set(keys))}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#ffd84d] px-4 text-[14px] font-bold text-[#0b1220]"
        >
          <Eye className="h-4 w-4" />
          {allFlipped ? "Turn back" : "Flip them all"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {prompts.map((p) => {
          const result =
            p.prompt.resolution !== undefined && p.showResolution
              ? answerText(p.prompt, p.prompt.resolution, people)
              : null;
          return (
            <article
              key={p.prompt.id}
              className="rounded-[22px] bg-[#101826] p-4 ring-1 ring-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[18px] leading-snug font-bold text-white">
                  {p.prompt.question}
                </h3>
                {result && (
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#0b1220]">
                    Result: {result}
                  </span>
                )}
              </div>
              {p.responses.length === 0 ? (
                <p className="mt-2 text-[14px] text-white/55">
                  Nobody picked this. Cowards.
                </p>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {p.responses.map((r) => {
                    const person = people.find((x) => x.id === r.participantId);
                    if (!person) return null;
                    const key = `${p.prompt.id}:${r.participantId}`;
                    const open = flipped.has(key);
                    return (
                      <li key={key}>
                        <FlipCard
                          person={person}
                          open={open}
                          answer={answerText(p.prompt, r.value, people)}
                          verdict={verdictFor(p, r)}
                          points={p.prompt.scoring}
                          onFlip={() =>
                            setFlipped((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

const VERDICT: Record<Verdict, { label: string; className: string } | null> = {
  exact: { label: "Called it", className: "bg-[#0f7a3d] text-white" },
  partial: { label: "Half right", className: "bg-[#ffd84d] text-[#0b1220]" },
  wrong: { label: "Nope", className: "bg-[#c8102e] text-white" },
  open: null,
};

function FlipCard({
  person,
  open,
  answer,
  verdict,
  points,
  onFlip,
}: {
  person: Participant;
  open: boolean;
  answer: string;
  verdict: Verdict;
  points?: LivePrompt["prompt"]["scoring"];
  onFlip: () => void;
}) {
  const v = VERDICT[verdict];
  const earned =
    verdict === "exact"
      ? points?.points
      : verdict === "partial"
        ? points?.partial?.points
        : undefined;
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={
        open ? `${person.name}: ${answer}` : `Turn over ${person.name}'s pick`
      }
      className={`${styles.flip} ${open ? styles.flipped : ""} block h-[88px] w-full text-left`}
    >
      <span className={`${styles.flipInner} block h-full`}>
        <span
          className={`${styles.face} flex h-full items-center gap-2.5 rounded-2xl bg-[repeating-linear-gradient(135deg,#1c2638_0_8px,#162033_8px_16px)] px-3 ring-1 ring-white/10`}
        >
          <Avatar person={person} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-white">
              {person.name}
            </span>
            <span className="block text-[12.5px] font-semibold tracking-wide text-white/55 uppercase">
              Tap to reveal
            </span>
          </span>
        </span>
        <span
          className={`${styles.back} flex flex-col justify-center rounded-2xl bg-white px-3 text-[#0b1220]`}
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0b1220]/65">
            <Avatar person={person} size={18} />
            <span className="truncate">{person.name}</span>
          </span>
          <span
            className={`${styles.display} mt-0.5 truncate text-[26px] leading-none`}
          >
            {answer}
          </span>
          {v && (
            <span
              className={`mt-1 w-fit rounded-full px-2 py-0.5 text-[12px] font-bold ${v.className}`}
            >
              {v.label}
              {earned ? ` +${earned}` : ""}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
