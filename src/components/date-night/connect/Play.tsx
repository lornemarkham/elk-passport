"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  INTERESTS,
  MODES,
  STAGES,
  type ModeId,
  type StageId,
} from "@/domain/date-night/connect/content";
import type {
  CardView,
  PlayView,
  Slot,
} from "@/domain/date-night/connect/session";
import styles from "./connect.module.css";

export type Gate =
  | { status: "gone" }
  | { status: "full" }
  | { status: "not-ready" }
  | { status: "invite"; code: string; mode: ModeId; host: string }
  | PlayView;

const other = (s: Slot): Slot => (s === 1 ? 2 : 1);
const POLL_MS = 2500;

type Send = (body: Record<string, unknown>) => Promise<PlayView | null>;

/** The whole page for one night, whoever is looking. */
export function Play({
  code,
  initial,
  justMade,
}: {
  code: string;
  initial: Gate;
  justMade: boolean;
}) {
  const [gate, setGate] = useState<Gate>(initial);
  const [gone, setGone] = useState<"left" | null>(null);

  if (gone === "left") return <Left />;
  if (gate.status === "not-ready") return <Unavailable />;
  if (gate.status === "gone") return <Missing />;
  if (gate.status === "full") return <Full />;
  if (gate.status === "invite")
    return (
      <Invite
        gate={gate}
        onJoined={async () => {
          const res = await fetch(`/api/date-night/play/${code}`, {
            cache: "no-store",
          });
          setGate((await res.json()) as Gate);
        }}
      />
    );
  return (
    <Night
      code={code}
      first={gate}
      justMade={justMade}
      onLeft={() => setGone("left")}
      onLost={(g) => setGate(g)}
    />
  );
}

// ---------------------------------------------------------------------------
// The people who can't play
// ---------------------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.col}>{children}</div>
    </main>
  );
}

const Missing = () => (
  <Shell>
    <p className={styles.eyebrow}>Passport · Date Night</p>
    <h1 className={styles.title}>This night has ended</h1>
    <p className={styles.lede}>
      Nights are private and are cleared away after a day, or as soon as
      everyone leaves. Start a new one whenever you like.
    </p>
    <Link className={styles.primary} href="/datenight/play">
      Start a new night
    </Link>
  </Shell>
);

const Full = () => (
  <Shell>
    <p className={styles.eyebrow}>Passport · Date Night</p>
    <h1 className={styles.title}>This night already has two people</h1>
    <p className={styles.lede}>
      If it&apos;s yours, open it on the phone you started on. Otherwise you can
      make a night of your own in a few taps.
    </p>
    <Link className={styles.primary} href="/datenight/play">
      Start my own
    </Link>
  </Shell>
);

const Unavailable = () => (
  <Shell>
    <p className={styles.eyebrow}>Passport · Date Night</p>
    <h1 className={styles.title}>Connect &amp; Play isn&apos;t on here yet</h1>
    <p className={styles.lede}>
      The place it keeps a night for you isn&apos;t set up. Nothing is wrong
      with your link; try again a little later.
    </p>
  </Shell>
);

const Left = () => (
  <Shell>
    <p className={styles.eyebrow}>Passport · Date Night</p>
    <h1 className={styles.title}>You&apos;ve left</h1>
    <p className={styles.lede}>
      Your answers and your questions are deleted. Thanks for playing.
    </p>
    <Link className={styles.primary} href="/datenight">
      Back to Date Night
    </Link>
  </Shell>
);

function Invite({
  gate,
  onJoined,
}: {
  gate: Extract<Gate, { status: "invite" }>;
  onJoined: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = MODES.find((m) => m.id === gate.mode);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/date-night/play/${gate.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "join", name }),
      });
      if (res.status === 409 || res.status === 404) {
        await onJoined();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      await onJoined();
    } catch {
      setError("Couldn't join. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <p className={styles.eyebrow}>Passport · Date Night</p>
      <h1 className={styles.title}>
        {gate.host ? `${gate.host} wants to play` : "You're invited to play"}
      </h1>
      <p className={styles.lede}>
        A few questions and games, just the two of you. {mode?.label}:{" "}
        {mode?.line.toLowerCase()}
      </p>
      <p className={styles.note}>
        No account, nothing to install. Skip anything you like, no explanation
        needed, and leave whenever you want, taking your answers with you.
      </p>
      <label className={styles.label}>
        What should we call you? (optional)
        <input
          className={styles.field}
          value={name}
          maxLength={24}
          autoComplete="given-name"
          onChange={(e) => setName(e.target.value)}
          data-testid="join-name"
        />
      </label>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={join}
        data-testid="join"
      >
        {busy ? "Joining…" : "Join"}
      </button>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// The night
// ---------------------------------------------------------------------------

function Night({
  code,
  first,
  justMade,
  onLeft,
  onLost,
}: {
  code: string;
  first: PlayView;
  justMade: boolean;
  onLeft: () => void;
  onLost: (g: Gate) => void;
}) {
  const [view, setView] = useState<PlayView>(first);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** One phone: who is meant to be holding it. */
  const holder = useRef<Slot>(1);
  const [handoff, setHandoff] = useState<Slot | null>(null);
  const verRef = useRef(first.ver);

  const as = view.phones === 1 ? (view.acting ?? view.me) : undefined;

  const take = useCallback(
    (v: PlayView) => {
      verRef.current = v.ver;
      setView(v);
      if (v.phones === 1 && v.acting && v.acting !== holder.current)
        setHandoff(v.acting);
    },
    [setView],
  );

  const send: Send = useCallback(
    async (body) => {
      if (busy) return null;
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch(`/api/date-night/play/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, as }),
        });
        if (res.status === 404) {
          onLost({ status: "gone" });
          return null;
        }
        if (res.status === 429) {
          setNotice("Easy there. Try that again in a moment.");
          return null;
        }
        if (!res.ok) {
          // Someone else got there first, or the card moved on: look again.
          const again = await fetch(
            `/api/date-night/play/${code}?as=${as ?? ""}`,
            {
              cache: "no-store",
            },
          );
          if (again.ok) take((await again.json()) as PlayView);
          return null;
        }
        const next = (await res.json()) as PlayView;
        take(next);
        return next;
      } catch {
        setNotice("Couldn't reach Passport. Your night is still here.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [as, busy, code, onLost, take],
  );

  // Two phones: look for the other person's moves, quietly, while visible.
  useEffect(() => {
    if (view.phones !== 2) return;
    let stop = false;
    async function look() {
      if (stop || document.hidden) return;
      try {
        const res = await fetch(`/api/date-night/play/${code}`, {
          cache: "no-store",
        });
        if (res.status === 404) return onLost({ status: "gone" });
        const g = (await res.json()) as Gate;
        if (g.status !== "play") return onLost(g);
        if (g.ver !== verRef.current) {
          verRef.current = g.ver;
          setView(g);
        }
      } catch {
        /* offline for a moment: the next look will catch up */
      }
    }
    const timer = setInterval(look, POLL_MS);
    const visible = () => !document.hidden && look();
    document.addEventListener("visibilitychange", visible);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [code, onLost, view.phones]);

  const who = names(view);
  const card = view.card;
  const interactive =
    card.kind === "wyr" ||
    card.kind === "likely" ||
    card.kind === "guess" ||
    card.kind === "truths";
  const revealed = interactive && card.revealed;
  const next = () => send({ type: "next", from: view.index });
  const hasPartner = view.joined[2];

  return (
    <main className={styles.page}>
      <div className={styles.col}>
        <div className={styles.top}>
          <div className={styles.modeBar} role="group" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.modeTab}
                aria-pressed={view.mode === m.id}
                data-testid={`tab-${m.id}`}
                onClick={() => send({ type: "mode", mode: m.id })}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.menuBtn}
            aria-expanded={menu}
            aria-label="Menu"
            data-testid="menu"
            onClick={() => setMenu((m) => !m)}
          >
            ⋯
          </button>
        </div>

        {menu ? (
          <Menu
            code={code}
            view={view}
            send={send}
            onClose={() => setMenu(false)}
            onLeft={onLeft}
            as={as}
          />
        ) : null}

        {view.phones === 2 && !hasPartner ? (
          <InvitePanel code={code} open={justMade} />
        ) : null}
        {view.phones === 2 && hasPartner && view.left[other(view.me)] ? (
          <div className={styles.banner} data-testid="partner-left">
            <p>
              {who.name(other(view.me))} has left. You can keep going on your
              own, or end the night.
            </p>
          </div>
        ) : null}

        <div
          className={styles.card}
          aria-live="polite"
          data-testid="card"
          data-kind={card.kind}
        >
          {handoff ? (
            <div
              className={`${styles.card} ${styles.hand}`}
              style={{ border: 0, boxShadow: "none", padding: 0 }}
            >
              <p className={styles.eyebrow}>Pass the phone</p>
              <p className={styles.big}>
                Hand it to {view.names[handoff] || `Person ${handoff}`}
              </p>
              <p className={styles.hint}>
                Their turn is private. Look away until it comes back.
              </p>
              <button
                type="button"
                className={styles.primary}
                data-testid="handoff"
                onClick={() => {
                  holder.current = handoff;
                  setHandoff(null);
                }}
              >
                I&apos;m {view.names[handoff] || `Person ${handoff}`}
              </button>
            </div>
          ) : (
            <CardBody
              key={card.id}
              view={view}
              card={card}
              send={send}
              busy={busy}
              who={who}
            />
          )}
        </div>

        {notice ? (
          <p className={styles.note} role="status">
            {notice}
          </p>
        ) : null}

        {!handoff ? (
          <div className={interactive && revealed ? undefined : styles.nav}>
            {!(interactive && revealed) ? (
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={next}
                data-testid="skip"
              >
                Skip
              </button>
            ) : null}
            {!interactive || revealed ? (
              <button
                type="button"
                className={styles.primary}
                style={interactive ? { width: "100%" } : undefined}
                disabled={busy}
                onClick={next}
                data-testid="next"
              >
                Next question
              </button>
            ) : (
              <p className={styles.note} style={{ alignSelf: "center" }}>
                Skip any time. No explanation needed.
              </p>
            )}
          </div>
        ) : null}

        {view.shared.length > 0 ? <Plan shared={view.shared} /> : null}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Names, from where this person is sitting
// ---------------------------------------------------------------------------

interface Names {
  /** Mid-sentence: "you", "your date", "Sam". */
  name(s: Slot): string;
  /** Start of a sentence: "You", "Your date", "Sam". */
  Name(s: Slot): string;
}

function names(v: PlayView): Names {
  const name = (s: Slot) =>
    v.phones === 1
      ? v.names[s] || `Person ${s}`
      : s === v.me
        ? "you"
        : v.names[s] || "your date";
  return {
    name,
    Name: (s) => {
      const n = name(s);
      return n.charAt(0).toUpperCase() + n.slice(1);
    },
  };
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const TOPICS: Record<string, string> = {
  starter: "Warm-up",
  interests: "What you're into",
  personal: "A little more personal",
  dreams: "Dreams",
  memories: "Memories",
};

function CardBody({
  view,
  card,
  send,
  busy,
  who,
}: {
  view: PlayView;
  card: CardView;
  send: Send;
  busy: boolean;
  who: Names;
}) {
  const answer = (value: unknown) => send({ type: "answer", value });
  const me = view.me;
  const them = other(me);
  const wait = (slots: Slot[]) =>
    slots.length > 0 && !slots.includes(me) && view.phones === 2;
  const turn = (slots: Slot[]) =>
    view.phones === 1 && slots[0] ? (
      <p className={styles.eyebrow}>{who.Name(slots[0])}&apos;s turn</p>
    ) : null;

  switch (card.kind) {
    case "talk":
      return (
        <>
          <p className={styles.eyebrow}>{TOPICS[card.topic] ?? "Question"}</p>
          <p className={styles.big} data-testid="prompt">
            {card.text}
          </p>
          <p className={styles.hint}>
            Take turns. There&apos;s no wrong answer.
          </p>
        </>
      );

    case "custom":
      return (
        <>
          <p className={styles.eyebrow}>
            {view.phones === 1
              ? `A question ${who.name(card.from)} wanted to ask`
              : card.from === me
                ? "A question you wanted to ask"
                : `A question ${who.name(card.from)} wanted to ask`}
          </p>
          <p className={styles.big} data-testid="prompt">
            {card.text}
          </p>
          <p className={styles.hint}>
            Answer however you like, or skip it. No reason needed.
          </p>
        </>
      );

    case "tod":
      return <TruthOrDare card={card} />;

    case "wyr": {
      const picked = card.mine !== null;
      const opts: [0 | 1, string][] = [
        [0, card.a],
        [1, card.b],
      ];
      return (
        <>
          {turn(card.needs)}
          <p className={styles.eyebrow}>Would you rather…</p>
          <div className={styles.picks}>
            {opts.map(([i, text]) => (
              <button
                key={i}
                type="button"
                className={styles.pick}
                disabled={busy || picked || card.revealed || wait(card.needs)}
                aria-pressed={card.mine === i}
                data-yours={card.revealed && card.mine === i}
                data-theirs={card.revealed && card.theirs === i}
                data-testid={`wyr-${i}`}
                onClick={() => answer(i)}
              >
                {text}
                {card.revealed && card.mine === i ? (
                  <span className={styles.tag}>
                    {view.phones === 1 ? "first" : "you"}
                  </span>
                ) : null}
                {card.revealed && card.theirs === i ? (
                  <span className={`${styles.tag} ${styles.tagBerry}`}>
                    {view.phones === 1 ? "second" : who.name(them)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {!card.revealed && picked ? (
            <p className={styles.hint} data-testid="waiting">
              Locked in.{" "}
              {view.phones === 1 ? "" : `Waiting for ${who.name(them)}…`}
            </p>
          ) : null}
          {card.revealed && card.mine !== null && card.theirs !== null ? (
            <p className={styles.result} data-testid="result">
              {card.mine === card.theirs
                ? `You both picked “${opts[card.mine][1]}”.${card.match ? " That's something you have in common." : ""}`
                : "Different picks. Ask why."}
            </p>
          ) : null}
        </>
      );
    }

    case "likely": {
      const picked = card.mine !== null;
      const label = (s: Slot) =>
        view.phones === 1 ? who.Name(s) : s === me ? "Me" : who.Name(s);
      return (
        <>
          {turn(card.needs)}
          <p className={styles.eyebrow}>Most likely to…</p>
          <p className={styles.big}>
            Which of us is most likely to {card.text}?
          </p>
          <div className={styles.picks}>
            {([me, them] as Slot[]).map((s) => (
              <button
                key={s}
                type="button"
                className={styles.pick}
                disabled={busy || picked || card.revealed || wait(card.needs)}
                aria-pressed={card.mine === s}
                data-yours={card.revealed && card.mine === s}
                data-theirs={card.revealed && card.theirs === s}
                data-testid={`likely-${s === me ? "me" : "them"}`}
                onClick={() => answer(s)}
              >
                {label(s)}
              </button>
            ))}
          </div>
          {!card.revealed && picked ? (
            <p className={styles.hint} data-testid="waiting">
              Locked in.{" "}
              {view.phones === 1 ? "" : `Waiting for ${who.name(them)}…`}
            </p>
          ) : null}
          {card.revealed && card.mine !== null && card.theirs !== null ? (
            <p className={styles.result} data-testid="result">
              {view.phones === 1
                ? card.mine === card.theirs
                  ? `You both say it's ${who.name(card.mine)}.`
                  : "You each pointed at someone different."
                : card.mine === card.theirs
                  ? card.mine === me
                    ? "You both say it's you."
                    : `You both say it's ${who.name(them)}.`
                  : card.mine === me
                    ? "You each pointed at yourselves."
                    : "You each pointed at the other one."}
            </p>
          ) : null}
        </>
      );
    }

    case "guess": {
      const asker = card.asker;
      const askerIsMe = view.phones === 2 && asker === me;
      const stage = card.revealed ? "done" : card.chosen ? "guess" : "ask";
      const mineToDo = view.phones === 1 || card.needs.includes(me);
      return (
        <>
          {turn(card.needs)}
          <p className={styles.eyebrow}>Guess my answer</p>
          <p className={styles.big}>
            {view.phones === 1
              ? `${who.Name(asker)}: ${card.text}`
              : askerIsMe
                ? card.text
                : `${who.Name(asker)}'s turn: ${card.text.replace(/^My /, "Their ").replace(/^I'm /, "They're ").replace(/^I'd /, "They'd ").replace(/^I /, "They ")}`}
          </p>
          {stage === "ask" ? (
            <p className={styles.hint}>
              {view.phones === 1
                ? `${who.Name(asker)}, pick one in secret. ${who.Name(other(asker))} will guess.`
                : askerIsMe
                  ? `Pick one in secret. ${who.Name(them)} will guess.`
                  : `Waiting for ${who.name(asker)} to pick…`}
            </p>
          ) : null}
          {stage === "guess" ? (
            <p className={styles.hint}>
              {view.phones === 1 || !askerIsMe
                ? `${who.Name(other(asker))}: which one did ${who.name(asker)} pick?`
                : `Locked in. Waiting for ${who.name(them)} to guess…`}
            </p>
          ) : null}
          <div className={styles.picks}>
            {card.options.map((o, i) => (
              <button
                key={o}
                type="button"
                className={styles.pick}
                disabled={
                  busy ||
                  stage === "done" ||
                  !mineToDo ||
                  (stage === "ask" && !askerIsMe && view.phones === 2)
                }
                data-yours={
                  card.answer === i && (stage === "done" || askerIsMe)
                }
                data-theirs={stage === "done" && card.guess === i}
                data-testid={`guess-${i}`}
                onClick={() => answer(i)}
              >
                {o}
                {stage === "done" && card.answer === i ? (
                  <span className={styles.tag}>picked</span>
                ) : null}
                {stage === "done" && card.guess === i ? (
                  <span className={`${styles.tag} ${styles.tagBerry}`}>
                    guess
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {stage === "done" && card.answer !== null && card.guess !== null ? (
            <p className={styles.result} data-testid="result">
              {card.answer === card.guess
                ? "Got it."
                : `Not quite. It was “${card.options[card.answer]}”.`}
            </p>
          ) : null}
        </>
      );
    }

    case "truths":
      return (
        <TwoTruths view={view} card={card} send={send} busy={busy} who={who} />
      );
  }
}

function TruthOrDare({ card }: { card: Extract<CardView, { kind: "tod" }> }) {
  const [choice, setChoice] = useState<"truth" | "dare" | null>(null);
  return (
    <>
      <p className={styles.eyebrow}>Truth or dare · date edition</p>
      {choice ? (
        <>
          <p className={styles.eyebrow} style={{ color: "var(--cp-coral)" }}>
            {choice === "truth" ? "Truth" : "Dare"}
          </p>
          <p className={styles.big} data-testid="prompt">
            {choice === "truth" ? card.truth : card.dare}
          </p>
          <p className={styles.hint}>
            Both are always optional. Do it, change your pick, or skip.
          </p>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => setChoice(choice === "truth" ? "dare" : "truth")}
          >
            Switch to {choice === "truth" ? "dare" : "truth"}
          </button>
        </>
      ) : (
        <>
          <p className={styles.big}>
            Whoever&apos;s turn it is: truth or dare?
          </p>
          <div className={styles.picks}>
            <button
              type="button"
              className={styles.pick}
              data-testid="tod-truth"
              onClick={() => setChoice("truth")}
            >
              Truth
            </button>
            <button
              type="button"
              className={styles.pick}
              data-testid="tod-dare"
              onClick={() => setChoice("dare")}
            >
              Dare
            </button>
          </div>
        </>
      )}
    </>
  );
}

function TwoTruths({
  view,
  card,
  send,
  busy,
  who,
}: {
  view: PlayView;
  card: Extract<CardView, { kind: "truths" }>;
  send: Send;
  busy: boolean;
  who: Names;
}) {
  const [text, setText] = useState(["", "", ""]);
  const [lie, setLie] = useState<number | null>(null);
  const writer = card.writer;
  const writerHere = view.phones === 1 || writer === view.me;
  const guesserSlot = other(writer);
  const guesserHere = view.phones === 1 || guesserSlot === view.me;
  const written = card.statements !== null;

  return (
    <>
      {view.phones === 1 && card.needs[0] ? (
        <p className={styles.eyebrow}>{who.Name(card.needs[0])}&apos;s turn</p>
      ) : null}
      <p className={styles.eyebrow}>Two truths and a lie</p>
      {!written ? (
        writerHere ? (
          <>
            <p className={styles.big}>
              Write two true things and one lie. Mark the lie.
            </p>
            <div className={styles.fields}>
              {text.map((t, i) => (
                <div key={i} style={{ display: "grid", gap: "0.35rem" }}>
                  <input
                    className={styles.field}
                    value={t}
                    maxLength={90}
                    aria-label={`Statement ${i + 1}`}
                    data-testid={`truth-${i}`}
                    onChange={(e) =>
                      setText(
                        text.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className={styles.chip}
                    aria-pressed={lie === i}
                    data-testid={`lie-${i}`}
                    onClick={() => setLie(i)}
                  >
                    {lie === i ? "This is the lie" : "Make this the lie"}
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || lie === null || text.some((t) => !t.trim())}
              data-testid="truths-send"
              onClick={() => send({ type: "answer", value: { s: text, lie } })}
            >
              Ready
            </button>
          </>
        ) : (
          <p className={styles.big}>
            {who.Name(writer)} {writer === view.me ? "are" : "is"} writing two
            truths and a lie…
          </p>
        )
      ) : (
        <>
          <p className={styles.big}>
            {card.revealed
              ? "Here's the lie."
              : guesserHere
                ? `Which one is ${who.name(writer)}'s lie?`
                : `Waiting for ${who.name(guesserSlot)} to guess…`}
          </p>
          <div className={styles.picks}>
            {card.statements!.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.pick} ${card.revealed && card.lie === i ? styles.lie : ""}`}
                disabled={
                  busy || card.revealed || !guesserHere || card.guess !== null
                }
                data-yours={card.revealed && card.guess === i}
                data-testid={`stmt-${i}`}
                onClick={() => send({ type: "answer", value: i })}
              >
                {s}
                {card.revealed && card.lie === i ? (
                  <span className={styles.tag}>the lie</span>
                ) : null}
                {card.revealed && card.guess === i ? (
                  <span className={`${styles.tag} ${styles.tagBerry}`}>
                    guess
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {card.revealed && card.guess !== null && card.lie !== null ? (
            <p className={styles.result} data-testid="result">
              {card.guess === card.lie ? "Spotted it." : "Fooled you."}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Invite, menu, and the way out to Atlas
// ---------------------------------------------------------------------------

/** Browser facts that never change while the page is open. */
const noSubscribe = () => () => {};

function InvitePanel({ code, open }: { code: string; open: boolean }) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const url = origin ? `${origin}/datenight/play/${code}` : "";
  const text = `Want to play a little? No app, no sign-up: ${url}`;

  return (
    <div className={styles.banner} data-testid="invite-panel">
      <p>
        <strong>
          {open ? "Send your date this link." : "Your date hasn't joined yet."}
        </strong>{" "}
        It opens right on their phone. You can start while you wait.
      </p>
      <div className={styles.share} data-testid="invite-url">
        {url}
      </div>
      <div className={`${styles.row} ${styles.row2}`}>
        {canShare ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => navigator.share({ text, url }).catch(() => {})}
          >
            Share
          </button>
        ) : (
          <a
            className={styles.primary}
            href={`sms:?&body=${encodeURIComponent(text)}`}
          >
            Text it
          </a>
        )}
        <button
          type="button"
          className={styles.secondary}
          data-testid="copy-link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

/** Interests you both picked, handed to Discovery as a sentence. */
function Plan({ shared }: { shared: readonly (keyof typeof INTERESTS)[] }) {
  const words = [...new Set(shared)].map((i) => INTERESTS[i]);
  const sentence = `a date for two that's ${words.join(" and ")}`;
  return (
    <p className={styles.note} data-testid="plan">
      You both lean {words.join(" and ")}.{" "}
      <a
        href={`/discovery?q=${encodeURIComponent(sentence)}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="plan-link"
      >
        Find a date like that
      </a>
    </p>
  );
}

function Menu({
  code,
  view,
  send,
  onClose,
  onLeft,
  as,
}: {
  code: string;
  view: PlayView;
  send: Send;
  onClose: () => void;
  onLeft: () => void;
  as: Slot | undefined;
}) {
  const [qs, setQs] = useState<string[]>([...view.mine]);
  const [saved, setSaved] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    try {
      const res = await fetch(`/api/date-night/play/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "leave", as }),
      });
      if (res.ok || res.status === 404) onLeft();
      else setError("Couldn't leave just now. Try again.");
    } catch {
      setError("Couldn't leave just now. Try again.");
    }
  }

  return (
    <section
      className={styles.sheet}
      aria-label="Menu"
      data-testid="menu-sheet"
    >
      <div>
        <h2 className={styles.h2}>How are you two?</h2>
        <div
          className={styles.chips}
          role="group"
          aria-label="Relationship stage"
        >
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.chip}
              aria-pressed={view.stage === s.id}
              data-testid={`menu-stage-${s.id}`}
              onClick={() => send({ type: "stage", stage: s.id as StageId })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className={styles.note} style={{ marginTop: "0.4rem" }}>
          Changes the next question, not the ones already asked.
        </p>
      </div>

      <div>
        <h2 className={styles.h2}>Your three questions</h2>
        <p className={styles.note}>
          Private. Your date only sees one when it comes up, and can skip it.
        </p>
        <div className={styles.fields} style={{ marginTop: "0.5rem" }}>
          {qs.map((q, i) => (
            <input
              key={i}
              className={styles.field}
              value={q}
              maxLength={160}
              aria-label={`Your question ${i + 1}`}
              data-testid={`my-q-${i}`}
              onChange={(e) => {
                setSaved(false);
                setQs(qs.map((x, j) => (j === i ? e.target.value : x)));
              }}
            />
          ))}
          <button
            type="button"
            className={styles.secondary}
            data-testid="save-questions"
            onClick={async () => {
              const v = await send({ type: "questions", list: qs });
              setSaved(v !== null);
            }}
          >
            {saved ? "Saved" : "Save my questions"}
          </button>
        </div>
      </div>

      <div>
        <h2 className={styles.h2}>Plan something together</h2>
        <p className={styles.note}>
          {view.shared.length
            ? "Based on what you both picked."
            : "Questions and games can tell you what you both like. Until then, here's the general idea."}
        </p>
        <p style={{ margin: "0.5rem 0 0" }}>
          <Link className={styles.secondary} href="/datenight">
            Plan a Date Night
          </Link>
        </p>
      </div>

      <div>
        {!sure ? (
          <button
            type="button"
            className={styles.ghost}
            data-testid="leave"
            onClick={() => setSure(true)}
          >
            Leave and delete my answers
          </button>
        ) : (
          <div className={styles.banner}>
            <p>
              This removes your name, your answers and your questions from the
              night right away.{" "}
              {view.phones === 2
                ? "Your date can carry on without them."
                : "It ends the night."}
            </p>
            <div className={`${styles.row} ${styles.row2}`}>
              <button
                type="button"
                className={styles.primary}
                data-testid="leave-confirm"
                onClick={leave}
              >
                Leave
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setSure(false)}
              >
                Stay
              </button>
            </div>
          </div>
        )}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button type="button" className={styles.ghost} onClick={onClose}>
        Close
      </button>
    </section>
  );
}
