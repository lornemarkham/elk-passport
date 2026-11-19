"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MODES,
  STAGES,
  type ModeId,
  type StageId,
} from "@/domain/date-night/connect/content";
import styles from "./connect.module.css";

/**
 * **The front door of Connect & Play.** Pick a mode, say where you two are,
 * press one of two buttons. Surprise me and First date are already chosen, so
 * the shortest way in is one tap.
 */
export function Start() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeId>("surprise");
  const [stage, setStage] = useState<StageId>("first");
  const [name, setName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [mine, setMine] = useState(["", "", ""]);
  const [theirs, setTheirs] = useState(["", "", ""]);
  const [busy, setBusy] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function begin(phones: 1 | 2) {
    setBusy(phones);
    setError(null);
    try {
      const res = await fetch("/api/date-night/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          stage,
          phones,
          name,
          guestName,
          questions: mine,
          guestQuestions: theirs,
        }),
      });
      if (res.status === 503) {
        setError(
          "Connect & Play isn't switched on here yet. Nothing was lost; try again soon.",
        );
        return;
      }
      if (res.status === 429) {
        setError(
          "Lots of nights have been started from here lately. Try again a little later.",
        );
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { code } = (await res.json()) as { code: string };
      router.push(`/datenight/play/${code}${phones === 2 ? "?invite=1" : ""}`);
    } catch {
      setError("Couldn't start. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const set =
    (list: string[], put: (v: string[]) => void, i: number) => (v: string) =>
      put(list.map((x, j) => (j === i ? v : x)));

  return (
    <main className={styles.page}>
      <div className={styles.col}>
        <header>
          <p className={styles.eyebrow}>Passport · Date Night</p>
          <h1 className={styles.title}>Connect &amp; Play</h1>
          <p className={styles.lede}>
            Questions and games for two. Put the phones on the table and get to
            know each other. No sign-up, nothing to install.
          </p>
        </header>

        <section aria-labelledby="mode-h">
          <h2 id="mode-h" className={styles.h2}>
            What kind of night?
          </h2>
          <div className={styles.modes} role="group" aria-labelledby="mode-h">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.mode}
                aria-pressed={mode === m.id}
                data-testid={`mode-${m.id}`}
                onClick={() => setMode(m.id)}
              >
                <strong>{m.label}</strong>
                <span>{m.line}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="stage-h">
          <h2 id="stage-h" className={styles.h2}>
            Where are you two?
          </h2>
          <div className={styles.chips} role="group" aria-labelledby="stage-h">
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.chip}
                aria-pressed={stage === s.id}
                data-testid={`stage-${s.id}`}
                onClick={() => setStage(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className={styles.note} style={{ marginTop: "0.5rem" }}>
            This only sets how personal the questions get. You can change it any
            time, and so can your date.
          </p>
        </section>

        <details className={styles.details}>
          <summary>Names and your own questions (optional)</summary>
          <div className={styles.fields}>
            <label className={styles.label}>
              Your first name
              <input
                className={styles.field}
                value={name}
                maxLength={24}
                autoComplete="given-name"
                onChange={(e) => setName(e.target.value)}
                data-testid="host-name"
              />
            </label>
            <p className={styles.note}>
              Three things you&apos;d like your date to answer. They&apos;re
              private: your date sees one only when it comes up, a few cards
              apart, and can skip it without saying why.
            </p>
            {mine.map((q, i) => (
              <label key={i} className={styles.label}>
                Question {i + 1}
                <input
                  className={styles.field}
                  value={q}
                  maxLength={160}
                  onChange={(e) => set(mine, setMine, i)(e.target.value)}
                  data-testid={`host-q-${i}`}
                />
              </label>
            ))}
            <details>
              <summary className={styles.note} style={{ cursor: "pointer" }}>
                Playing on one phone? Add your date&apos;s name and questions
                too
              </summary>
              <div className={styles.fields} style={{ marginTop: "0.6rem" }}>
                <label className={styles.label}>
                  Their first name
                  <input
                    className={styles.field}
                    value={guestName}
                    maxLength={24}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </label>
                {theirs.map((q, i) => (
                  <label key={i} className={styles.label}>
                    Their question {i + 1}
                    <input
                      className={styles.field}
                      value={q}
                      maxLength={160}
                      onChange={(e) =>
                        set(theirs, setTheirs, i)(e.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
          </div>
        </details>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={`${styles.row} ${styles.row2}`}>
          <button
            type="button"
            className={styles.primary}
            disabled={busy !== null}
            onClick={() => begin(2)}
            data-testid="start-invite"
          >
            {busy === 2 ? "Making your link…" : "Invite my date"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy !== null}
            onClick={() => begin(1)}
            data-testid="start-one-phone"
          >
            {busy === 1 ? "Starting…" : "Play on this phone"}
          </button>
        </div>
        <p className={styles.note}>
          Invite sends your date a link to open on their own phone. Nothing is
          kept past a day, and either of you can leave and take your answers
          with you at any time.
        </p>
      </div>
    </main>
  );
}
