"use client";

import { useEffect, useRef, useState } from "react";
import type { FigureOption, FigureRound } from "@/domain/dream/figure";
import { Photo } from "./Photo";
import styles from "./dream.module.css";

/**
 * **Help me figure it out** — two real places, one question, one tap. Four
 * times, then the sentence those taps make is shown and read. Skippable at
 * every step; nothing is remembered.
 */
export function Figure({
  rounds,
  onDone,
  onSkip,
}: {
  rounds: readonly FigureRound[];
  onDone: (picks: FigureOption[]) => void;
  onSkip: () => void;
}) {
  const [picks, setPicks] = useState<FigureOption[]>([]);
  const [leaving, setLeaving] = useState<string | undefined>();
  const round = rounds[picks.length];
  const here = useRef<HTMLElement>(null);
  // On a phone the pair is the whole screen: bring it into view at once.
  useEffect(() => {
    here.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!round) return null;
  const choose = (option: FigureOption) => {
    if (leaving) return;
    setLeaving(option.id);
    window.setTimeout(() => {
      const next = [...picks, option];
      setLeaving(undefined);
      if (next.length >= rounds.length) onDone(next);
      else setPicks(next);
    }, 420);
  };

  return (
    <section ref={here} className={styles.figure} aria-labelledby="figure-q">
      <header className={styles.figureHead}>
        <p className={styles.kicker}>
          {picks.length + 1} of {rounds.length} · just tap the one that pulls
          you
        </p>
        <h2 id="figure-q" className={styles.figureQ}>
          {round.question}
        </h2>
      </header>
      <div className={styles.pair} key={round.id}>
        {round.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.pick}
            data-chosen={leaving === option.id ? "" : undefined}
            data-dropped={leaving && leaving !== option.id ? "" : undefined}
            onClick={() => choose(option)}
            aria-label={`${option.label}: ${option.card.title}`}
          >
            <Photo
              photo={option.card.photo}
              alt=""
              priority
              className={styles.pickPhoto}
            />
            <span className={styles.pickScrim} aria-hidden />
            <span className={styles.pickLabel}>{option.label}</span>
            <span className={styles.pickPlace}>
              {option.card.title}
              {option.card.km !== undefined
                ? ` · ${option.card.km < 1 ? "under 1" : Math.round(option.card.km)} km`
                : ""}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.figureFoot}>
        <span className={styles.dots} aria-hidden>
          {rounds.map((r, i) => (
            <i key={r.id} data-on={i <= picks.length ? "" : undefined} />
          ))}
        </span>
        <button type="button" className={styles.quiet} onClick={onSkip}>
          Just surprise me
        </button>
      </div>
    </section>
  );
}
