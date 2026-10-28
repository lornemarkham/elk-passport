"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FEEDBACK_MAX_CHARS,
  FEEDBACK_PROMPTS,
  questionForSection,
  teamForSection,
  type FeedbackPromptId,
  type Question,
} from "@/lib/fairview3/show";
import { initialState, type Snapshot } from "@/lib/fairview3/store";
import { Finale } from "./Finale";
import { myVotes, participantId, rememberVote } from "./participant";
import {
  Curtain,
  Frame,
  Headline,
  Kicker,
  Know,
  Line,
  Merlin,
  OPTION_HUES,
  Parallel,
  Results,
  Spellbook,
  TeamSection,
} from "./Sections";
import { useLive, type Link } from "./useLive";

const HUE_BTN: Record<(typeof OPTION_HUES)[number], string> = {
  cyan: "from-cyan-500/70 to-cyan-300/40 ring-cyan-300",
  fuchsia: "from-fuchsia-500/70 to-pink-300/40 ring-fuchsia-300",
  amber: "from-amber-500/70 to-yellow-300/40 ring-amber-300",
  emerald: "from-emerald-500/70 to-lime-300/40 ring-emerald-300",
};

/** A phone in the room. Follows the big screen; votes; challenges us. */
export function Audience() {
  const { snapshot, link, refresh } = useLive(2000);
  // Lazy and client-only: the server renders the curtain, which needs no id.
  const [pid] = useState<string | null>(() =>
    typeof window === "undefined" ? null : participantId(),
  );

  useEffect(() => {
    if (!pid) return;
    const id = pid;
    const say = () =>
      fetch("/api/fairview3/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant: id }),
      }).catch(() => {});
    say();
    const onVisible = () => document.visibilityState === "visible" && say();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pid]);

  const state = snapshot?.state ?? initialState();
  const section = state.section;
  const team = teamForSection(section);
  const question = questionForSection(section);

  return (
    <main className="relative">
      <StatusPill link={link} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35 }}
        >
          {section === "curtain" && (
            <Curtain mode="phone" participants={snapshot?.participants ?? 0} />
          )}
          {section === "merlin" && <Merlin mode="phone" />}
          {section === "spellbook" && <Spellbook mode="phone" />}
          {team && <TeamSection team={team} mode="phone" />}
          {section === "parallel" && <Parallel mode="phone" />}
          {section === "know" && <Know mode="phone" />}
          {question && snapshot && pid && (
            <Ballot
              question={question}
              snapshot={snapshot}
              pid={pid}
              refresh={refresh}
            />
          )}
          {section === "challenge" && pid && <Challenge pid={pid} />}
          {section === "finale" && (
            <Finale mode="phone" finale={state.finale} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function StatusPill({ link }: { link: Link }) {
  const label =
    link === "live"
      ? "live"
      : link === "not-ready"
        ? "doors open soon"
        : "reconnecting…";
  return (
    <div
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur"
      data-testid="link-status"
      data-link={link}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          link === "live"
            ? "bg-emerald-400"
            : link === "not-ready"
              ? "bg-amber-400"
              : "fv3-pulse bg-fuchsia-400"
        }`}
      />
      {label}
    </div>
  );
}

function Ballot({
  question,
  snapshot,
  pid,
  refresh,
}: {
  question: Question;
  snapshot: Snapshot;
  pid: string;
  refresh: () => Promise<void>;
}) {
  const status = snapshot.state.questions[question.id];
  const tally = snapshot.tallies[question.id];
  const total = tally.reduce((a, b) => a + b, 0);
  const [mine, setMine] = useState<number | undefined>(
    () => myVotes()[question.id],
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const cast = async (option: number) => {
    if (busy || status !== "open") return;
    setBusy(true);
    setNote(null);
    const was = mine;
    setMine(option);
    try {
      const res = await fetch("/api/fairview3/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant: pid,
          question: question.id,
          option,
        }),
      });
      if (res.ok) {
        rememberVote(question.id, option);
        setNote("Locked in. Change your mind any time while voting is open.");
        void refresh();
      } else {
        setMine(was);
        setNote(
          res.status === 409
            ? "Voting just closed."
            : "That didn't go through. Try again.",
        );
      }
    } catch {
      setMine(was);
      setNote("No signal. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame mode="phone">
      <Kicker>Live vote</Kicker>
      <Headline
        mode="phone"
        className="mt-2"
        size="text-[8.5vw] leading-[0.95]"
      >
        {question.prompt}
      </Headline>
      {status === "revealed" ? (
        <div className="mt-6">
          <Results
            question={question}
            tally={tally}
            status={status}
            mode="phone"
            mine={mine}
          />
          {question.note && (
            <Line mode="phone" className="mt-5 text-white/70">
              {question.note}
            </Line>
          )}
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3" data-testid="ballot">
            {question.options.map((label, i) => {
              const chosen = mine === i;
              return (
                <li key={label}>
                  <button
                    type="button"
                    disabled={status !== "open" || busy}
                    onClick={() => cast(i)}
                    className={`fv3-display-tight w-full rounded-2xl bg-gradient-to-r px-5 py-4 text-left text-xl ring-2 transition active:scale-[0.98] disabled:opacity-60 ${
                      HUE_BTN[OPTION_HUES[i % OPTION_HUES.length]!]
                    } ${chosen ? "shadow-[0_0_30px_rgba(255,255,255,0.35)] ring-4 ring-white" : "ring-transparent"}`}
                    aria-pressed={chosen}
                  >
                    {label}
                    {chosen && <span className="ml-2">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-white/70" data-testid="ballot-note">
            {status === "open"
              ? (note ?? "Tap one. Your vote is anonymous.")
              : "Voting isn't open yet. Watch the screen."}
          </p>
          <p className="mt-2 text-sm text-white/50">
            <span
              className="fv3-display-tight text-white"
              data-testid="phone-total"
            >
              {total}
            </span>{" "}
            votes in
          </p>
        </>
      )}
    </Frame>
  );
}

function Challenge({ pid }: { pid: string }) {
  const [prompt, setPrompt] = useState<FeedbackPromptId>("missed");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState<
    { prompt: FeedbackPromptId; body: string }[]
  >([]);

  const send = async () => {
    if (busy || body.trim().length < 3) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/fairview3/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant: pid, prompt, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { because?: string };
      if (res.ok) {
        setSent((s) => [{ prompt, body: body.trim() }, ...s]);
        setBody("");
        setNote("Sent. A human reads it before it hits the screen. Thank you.");
      } else {
        setNote(data.because ?? "That didn't go through. Try again.");
      }
    } catch {
      setNote("No signal. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame mode="phone">
      <Kicker>Challenge us</Kicker>
      <Headline mode="phone" className="mt-2" size="text-[13vw] leading-[0.9]">
        What did <span className="fv3-electric">we miss?</span>
      </Headline>
      <Line mode="phone" className="mt-3 text-white/70">
        Anonymous. No names, no patient details, no links.
      </Line>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {FEEDBACK_PROMPTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={prompt === p.id}
            onClick={() => setPrompt(p.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
              prompt === p.id
                ? "bg-white text-black ring-white"
                : "bg-white/10 text-white/80 ring-white/20"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, FEEDBACK_MAX_CHARS))}
        rows={4}
        placeholder={FEEDBACK_PROMPTS.find((p) => p.id === prompt)!.label}
        className="fv3-card mt-4 w-full resize-none px-4 py-3 text-lg text-white placeholder:text-white/40 focus:ring-2 focus:ring-fuchsia-400 focus:outline-none"
        data-testid="feedback-body"
      />
      <div className="mt-2 flex items-center justify-between text-sm text-white/50">
        <span>
          {body.length}/{FEEDBACK_MAX_CHARS}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={busy || body.trim().length < 3}
          className="fv3-shimmer fv3-display-tight rounded-full px-6 py-3 text-lg text-black disabled:opacity-40"
          data-testid="feedback-send"
        >
          Send it
        </button>
      </div>
      {note && (
        <p className="mt-3 text-sm text-white/80" data-testid="feedback-note">
          {note}
        </p>
      )}
      {sent.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {sent.map((s, i) => (
            <li key={i} className="fv3-card px-4 py-3 text-white/80">
              <span className="text-xs tracking-widest text-white/40 uppercase">
                {FEEDBACK_PROMPTS.find((p) => p.id === s.prompt)!.label}
              </span>
              <p>{s.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
