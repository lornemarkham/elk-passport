"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DreamAnswer,
  DreamCard,
  DreamScene,
} from "@/domain/dream/compose";
import type { FigureOption, FigureRound } from "@/domain/dream/figure";
import { sentenceFrom } from "@/domain/dream/figureSentence";
import { useLocation } from "@/lib/location/useLocation";
import { DISCOVERY_TOWNS, townById } from "@/domain/discovery/towns";
import { useSpeech } from "./useSpeech";
import { Reel, ReelPaused } from "./Reel";
import { Figure } from "./Figure";
import { Scenes } from "./Scenes";
import { Day } from "./Day";
import styles from "./dream.module.css";

/**
 * **Dream** — `/labs/dream`. Discover when you know. Dream when you don't.
 * Go when you're ready.
 *
 * One page, three ways in: say it (typed or spoken), *surprise me*, or *help
 * me figure it out* (four pairs of real photographs). Every answer comes from
 * `POST /api/labs/dream`, which reads the sentence with Passport's own
 * deterministic readers and answers it from Atlas — no model, no spend. The
 * conversation is the state, kept in the URL (`?say=…&say=…`), so Back,
 * refresh and a shared link all land on the same answer.
 */

/** The five intentions the owner asked to see, as one-tap starts. */
export const TRY: readonly (readonly [string, string])[] = [
  ["I'm bored", "I'm bored. Surprise me."],
  [
    "Two kids, $40, four hours",
    "I have two kids tomorrow, $40 and four hours. Find skating, Christmas lights and hot chocolate within 10 km.",
  ],
  [
    "Impress someone",
    "I want to impress someone. Money isn't an issue. Find an incredible restaurant, Christmas lights and a beautiful hotel.",
  ],
  [
    "Broke, woods & stars",
    "We're broke. We love the woods, stars, campfires and free hot springs. Find us an adventure.",
  ],
  ["No idea", "I don't know what I want. Help me figure it out."],
];

const PROMPTS = [
  "Four hours with my niece, nothing too far…",
  "Somewhere cozy tonight, just the two of us…",
  "Surprise me with something I've never done…",
  "Free stuff outside this afternoon…",
];

type Phase = "open" | "figure" | "answer";
type Status = "idle" | "reading" | "atlas-down" | "failed";

async function ask(body: unknown) {
  const response = await fetch("/api/labs/dream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 503) return { atlas: "unreachable" as const };
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as {
    answer?: DreamAnswer;
    rounds?: FigureRound[];
    reel?: DreamCard[];
  };
}

function readUrl(): { turns: string[]; at?: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    turns: params.getAll("say").filter(Boolean).slice(0, 8),
    ...(params.get("at") ? { at: params.get("at")! } : {}),
  };
}

function writeUrl(turns: readonly string[], at: string, push: boolean) {
  const params = new URLSearchParams();
  for (const t of turns) params.append("say", t);
  if (turns.length) params.set("at", at);
  const url = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
  if (push) window.history.pushState({ dream: turns }, "", url);
  else window.history.replaceState({ dream: turns }, "", url);
}

export function Dream({
  initialTown,
  reel: serverReel,
}: {
  initialTown: string;
  /** The opening reel, streamed by the server for `initialTown`. */
  reel: ReactNode;
}) {
  const location = useLocation();
  const town = location.townId ?? initialTown;
  const townName = townById(town)?.name ?? "Vernon";

  const [phase, setPhase] = useState<Phase>("open");
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState<DreamAnswer | undefined>();
  const [rounds, setRounds] = useState<FigureRound[]>([]);
  // The server's reel serves the town it was rendered for; another town's
  // frames are fetched here when somebody changes the place.
  const [reel, setReel] = useState<readonly DreamCard[] | undefined>();
  const [reelTown, setReelTown] = useState(initialTown);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [without, setWithout] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [prompt, setPrompt] = useState(0);
  const answerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const asked = useRef(0);

  // The opening reel follows the place, once it is known to differ.
  useEffect(() => {
    if (!location.ready || town === reelTown) return;
    let live = true;
    ask({ reel: true, at: town })
      .then((r) => {
        if (live && "reel" in r && r.reel) {
          setReel(r.reel);
          setReelTown(town);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [location.ready, town, reelTown]);

  // A gentle change of example in the empty box.
  useEffect(() => {
    if (draft || phase !== "open") return;
    const t = window.setInterval(
      () => setPrompt((p) => (p + 1) % PROMPTS.length),
      3600,
    );
    return () => window.clearInterval(t);
  }, [draft, phase]);

  const run = useCallback(
    async (
      next: string[],
      options: {
        keep?: Record<string, string>;
        without?: string[];
        seed?: number;
        push?: boolean;
      } = {},
    ) => {
      const ticket = ++asked.current;
      setTurns(next);
      setPhase("answer");
      setStatus("reading");
      writeUrl(next, town, options.push ?? true);
      try {
        const r = await ask({
          turns: next,
          at: town,
          keep: Object.values(options.keep ?? chosen).slice(0, 6),
          without: options.without ?? without,
          seed: options.seed ?? seed,
        });
        if (ticket !== asked.current) return;
        if ("atlas" in r) return setStatus("atlas-down");
        if (r.answer?.mode === "unsure") {
          // "I don't know" — help them find out, with photographs.
          const f = await ask({
            figure: true,
            at: town,
            seed: options.seed ?? seed,
          });
          if (ticket !== asked.current) return;
          if ("rounds" in f && f.rounds?.length) {
            setRounds(f.rounds);
            setPhase("figure");
            setStatus("idle");
            return;
          }
        }
        setAnswer(r.answer);
        setStatus("idle");
        requestAnimationFrame(() =>
          answerRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        );
      } catch {
        if (ticket === asked.current) setStatus("failed");
      }
    },
    [town, chosen, without, seed],
  );

  // A shared link, Back and Forward: the URL is the conversation.
  useEffect(() => {
    const fromUrl = () => {
      const { turns: said, at } = readUrl();
      if (at && townById(at) && at !== location.townId) location.choose(at);
      if (said.length) void run(said, { push: false, keep: {}, without: [] });
      else {
        setPhase("open");
        setAnswer(undefined);
        setTurns([]);
      }
    };
    if (readUrl().turns.length) fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
    // Only on mount: later changes go through `run`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = useCallback(
    (text: string) => {
      const said = text.trim();
      if (!said) return;
      setDraft("");
      const fresh =
        phase !== "answer" ||
        /^(start over|forget (it|that)|new idea)\b/i.test(said);
      if (fresh) {
        setChosen({});
        setWithout([]);
        void run([said], { keep: {}, without: [] });
      } else void run([...turns, said]);
    },
    [phase, turns, run],
  );

  const speech = useSpeech(say);

  const surprise = () => {
    const nextSeed = answer?.mode === "surprise" ? seed + 1 : seed;
    setSeed(nextSeed);
    setChosen({});
    void run(["I'm bored. Surprise me."], {
      seed: nextSeed,
      keep: {},
      without,
    });
  };

  const figured = (picks: FigureOption[]) => {
    const sentence = sentenceFrom(picks);
    const keep = Object.fromEntries(
      picks
        .filter((p) => !["day", "near", "far"].includes(p.id))
        .map((p) => [`pick-${p.id}`, p.card.id]),
    );
    setChosen(keep);
    void run([sentence], { keep, without: [], push: true });
  };

  const choose = (scene: DreamScene, card: DreamCard) => {
    const next = { ...chosen, [scene.id]: card.id };
    setChosen(next);
    void run(turns, { keep: next, push: false });
  };

  const refuse = (card: DreamCard) => {
    const next = [...without, card.id];
    const keep = Object.fromEntries(
      Object.entries(chosen).filter(([, id]) => id !== card.id),
    );
    setWithout(next);
    setChosen(keep);
    void run(turns, { without: next, keep, push: false });
  };

  const startOver = () => {
    asked.current++;
    setPhase("open");
    setAnswer(undefined);
    setTurns([]);
    setChosen({});
    setWithout([]);
    setStatus("idle");
    writeUrl([], town, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const reading = status === "reading";
  const heard = answer?.heard ?? [];

  const composer = (docked: boolean) => (
    <form
      className={docked ? styles.dock : styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        say(draft);
      }}
    >
      <label
        className={styles.srOnly}
        htmlFor={docked ? "dream-more" : "dream-say"}
      >
        {docked ? "Change anything" : "Tell me about the day you want"}
      </label>
      <textarea
        id={docked ? "dream-more" : "dream-say"}
        ref={docked ? undefined : inputRef}
        className={styles.input}
        rows={docked ? 1 : 2}
        value={speech.listening ? speech.heard : draft}
        placeholder={
          docked
            ? "Change anything — “make it free”, “closer”, “no hotel”…"
            : PROMPTS[prompt]
        }
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            say(draft);
          }
        }}
        enterKeyHint="go"
        autoComplete="off"
      />
      {speech.supported ? (
        <button
          type="button"
          className={styles.mic}
          data-on={speech.listening ? "" : undefined}
          onClick={speech.listening ? speech.stop : speech.start}
          aria-label={speech.listening ? "Stop listening" : "Say it instead"}
          aria-pressed={speech.listening}
          title="Your browser's speech service listens; Passport gets only the words."
        >
          <MicIcon />
        </button>
      ) : null}
      <button
        type="submit"
        className={styles.send}
        disabled={!draft.trim() || reading}
        aria-label={docked ? "Change it" : "Find it"}
      >
        →
      </button>
    </form>
  );

  const towns = useMemo(
    () => [...DISCOVERY_TOWNS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div className={styles.dream} data-phase={phase}>
      <section className={styles.hero} aria-label="Dream">
        <ReelPaused.Provider value={phase !== "open"}>
          {reel && reelTown === town ? <Reel frames={reel} /> : serverReel}
        </ReelPaused.Provider>
        <div className={styles.heroInner}>
          <h1 className={styles.title}>
            <span>Discover when you know.</span>
            <span>Dream when you don&rsquo;t.</span>
            <span>Go when you&rsquo;re ready.</span>
          </h1>
          {composer(false)}
          {speech.problem ? (
            <p className={styles.note}>{speech.problem}</p>
          ) : null}
          <div className={styles.doors}>
            <button type="button" className={styles.door} onClick={surprise}>
              Surprise me
            </button>
            <button
              type="button"
              className={styles.door}
              onClick={() =>
                say("I don't know what I want. Help me figure it out.")
              }
            >
              Help me figure it out
            </button>
          </div>
          <div className={styles.try}>
            <span>Try</span>
            {TRY.map(([label, sentence]) => (
              <button key={label} type="button" onClick={() => say(sentence)}>
                {label}
              </button>
            ))}
          </div>
          <div className={styles.from}>
            <label htmlFor="dream-town">From</label>
            <select
              id="dream-town"
              value={town}
              onChange={(e) => location.choose(e.target.value)}
            >
              {towns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {location.approximate ? <span>(a guess — change it)</span> : null}
            <span className={styles.browse}>
              Rather browse? <a href="/discovery">Discover</a> ·{" "}
              <a href="/go">Build a day by hand</a> ·{" "}
              <a href="/christmas">Christmas</a>
            </span>
          </div>
        </div>
      </section>

      <p className={styles.srOnly} aria-live="polite">
        {reading
          ? "Looking…"
          : answer
            ? `${answer.scenes.length} things found near ${answer.town.name}.`
            : ""}
      </p>

      {phase === "figure" && rounds.length > 0 ? (
        <Figure rounds={rounds} onDone={figured} onSkip={surprise} />
      ) : null}

      {phase === "answer" ? (
        <div
          ref={answerRef}
          className={styles.answer}
          data-reading={reading ? "" : undefined}
        >
          <header className={styles.said}>
            <ol className={styles.turns}>
              {turns.map((t, i) => (
                <li key={`${i}-${t}`}>{t}</li>
              ))}
            </ol>
            {heard.length > 0 ? (
              <p className={styles.heard}>
                <span>Heard</span>
                {heard.map((h) => (
                  <span
                    key={h.label}
                    className={styles.chip}
                    data-assumed={h.from === "assumed" ? "" : undefined}
                    title={
                      h.from === "assumed"
                        ? "Assumed — say otherwise to change it"
                        : "From your words"
                    }
                  >
                    {h.label}
                  </span>
                ))}
              </p>
            ) : null}
            <button type="button" className={styles.quiet} onClick={startOver}>
              Start over
            </button>
          </header>

          {status === "atlas-down" ? (
            <p className={styles.gap}>
              Atlas isn&rsquo;t answering right now, and Passport won&rsquo;t
              make anything up without it. Try again in a minute — what you said
              is kept.
            </p>
          ) : status === "failed" ? (
            <p className={styles.gap}>
              That didn&rsquo;t go through.{" "}
              <button
                type="button"
                className={styles.quiet}
                onClick={() => void run(turns, { push: false })}
              >
                Try again
              </button>
            </p>
          ) : null}

          {reading && !answer ? <Loading town={townName} /> : null}

          {answer ? (
            <>
              {answer.mode === "surprise" ? (
                <p className={styles.lede}>
                  Three things near {answer.town.name}, picked from{" "}
                  {answer.considered.toLocaleString("en-CA")} places Atlas
                  knows.{" "}
                  <button
                    type="button"
                    className={styles.quiet}
                    onClick={surprise}
                  >
                    Surprise me again
                  </button>
                </p>
              ) : null}
              <Scenes
                scenes={answer.scenes}
                chosen={chosen}
                onChoose={choose}
                onRefuse={refuse}
              />
              {answer.day ? (
                <Day day={answer.day} from={`${answer.town.name}, BC`} />
              ) : null}
            </>
          ) : null}

          <div className={styles.dockWrap}>
            {answer?.next.length ? (
              <div className={styles.next}>
                {answer.next.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      n === "Surprise me again" ? surprise() : say(n)
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : null}
            {composer(true)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Loading({ town }: { town: string }) {
  return (
    <div className={styles.loading} aria-hidden>
      <span>Looking through what Atlas knows around {town}…</span>
      <i />
      <i />
      <i />
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
      />
    </svg>
  );
}
