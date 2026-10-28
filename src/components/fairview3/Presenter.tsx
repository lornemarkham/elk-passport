"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ANTHEM_LYRICS,
  FEEDBACK_PROMPTS,
  QUESTIONS,
  SECTIONS,
  SECTION_IDS,
  questionForSection,
  sectionIndex,
  type SectionId,
} from "@/lib/fairview3/show";
import type {
  Feedback,
  Inbox,
  PresenterAction,
  VoteStatus,
} from "@/lib/fairview3/store";
import { useLive } from "./useLive";

/**
 * **The presenter's console.** One key, typed once, kept in an httpOnly
 * cookie; every action goes to the server, which asks the store whether the
 * key is still good. Nothing on this page is trusted by anything else.
 */
export function Presenter() {
  const [auth, setAuth] = useState<"asking" | "out" | "in">("asking");
  const [notReady, setNotReady] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fairview3/presenter/session", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 503) {
          setNotReady(
            ((await r.json()) as { because?: string }).because ?? "not ready",
          );
          return setAuth("out");
        }
        const b = (await r.json()) as { presenter?: boolean };
        setAuth(b.presenter ? "in" : "out");
      })
      .catch(() => setAuth("out"));
  }, []);

  if (auth === "asking")
    return (
      <Shell>
        <p className="text-white/60">Checking…</p>
      </Shell>
    );
  if (auth === "out")
    return (
      <Shell>
        <KeyForm onIn={() => setAuth("in")} notReady={notReady} />
      </Shell>
    );
  return (
    <Shell>
      <Console onOut={() => setAuth("out")} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="fv3-display-tight text-xs tracking-[0.3em] text-white/50 uppercase">
            Fairview 3
          </p>
          <h1 className="fv3-display text-3xl">Presenter</h1>
        </div>
        <a
          href="/fairview3/stage"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
        >
          Open stage ↗
        </a>
      </header>
      {children}
    </main>
  );
}

function KeyForm({
  onIn,
  notReady,
}: {
  onIn: () => void;
  notReady: string | null;
}) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/fairview3/presenter/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (r.ok) onIn();
      else if (r.status === 503)
        setErr(
          "The database isn't set up yet. Run the Fairview 3 SQL, then set the presenter key.",
        );
      else if (r.status === 429) setErr("Too many tries. Wait a minute.");
      else setErr("That key doesn't open this door.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="fv3-card max-w-md px-6 py-6">
      <label className="block text-sm text-white/70" htmlFor="fv3-key">
        Presenter key
      </label>
      <input
        id="fv3-key"
        type="password"
        autoComplete="current-password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 text-white ring-1 ring-white/20 focus:ring-fuchsia-400 focus:outline-none"
        data-testid="presenter-key"
      />
      <button
        type="submit"
        disabled={busy || !key}
        className="fv3-shimmer fv3-display-tight mt-4 rounded-full px-6 py-3 text-black disabled:opacity-40"
        data-testid="presenter-enter"
      >
        Enter
      </button>
      {err && (
        <p
          className="mt-3 text-sm text-amber-300"
          data-testid="presenter-error"
        >
          {err}
        </p>
      )}
      {notReady && !err && (
        <p className="mt-3 text-sm text-amber-300">
          Database not ready: {notReady}
        </p>
      )}
    </form>
  );
}

type Act = (a: PresenterAction) => Promise<boolean>;

function Console({ onOut }: { onOut: () => void }) {
  const { snapshot, link, refresh } = useLive(1500);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      const r = await fetch("/api/fairview3/presenter", { cache: "no-store" });
      if (r.status === 403) return onOut();
      if (r.ok) setInbox((await r.json()) as Inbox);
    } catch {
      /* next tick */
    }
  }, [onOut]);

  useEffect(() => {
    const t = setInterval(loadInbox, 3000);
    const first = setTimeout(loadInbox, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [loadInbox]);

  const act: Act = useCallback(
    async (a) => {
      const r = await fetch("/api/fairview3/presenter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(a),
      });
      if (r.status === 403) {
        onOut();
        return false;
      }
      if (!r.ok) {
        setFlash("That didn't apply. Try again.");
        return false;
      }
      await Promise.all([
        refresh(),
        a.type === "moderate" ? loadInbox() : Promise.resolve(),
      ]);
      return true;
    },
    [onOut, refresh, loadInbox],
  );

  const state = snapshot?.state;
  const section = state?.section ?? "curtain";
  const idx = sectionIndex(section);
  const go = (s: SectionId) => act({ type: "section", section: s });
  const question = questionForSection(section);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
        <span
          className={`h-2.5 w-2.5 rounded-full ${link === "live" ? "bg-emerald-400" : "bg-amber-400"}`}
        />
        <span data-testid="presenter-link">{link}</span>
        <span>·</span>
        <span>
          <b className="text-white" data-testid="presenter-participants">
            {snapshot?.participants ?? 0}
          </b>{" "}
          in the circle
        </span>
        <span>·</span>
        <span>
          <b className="text-white">{inbox?.counts.pending ?? 0}</b> feedback to
          review
        </span>
        {flash && <span className="text-amber-300">{flash}</span>}
        <button
          type="button"
          className="ml-auto text-white/50 underline"
          onClick={async () => {
            await fetch("/api/fairview3/presenter/session", {
              method: "DELETE",
            });
            onOut();
          }}
        >
          Sign out
        </button>
      </div>

      {/* Sections */}
      <section className="fv3-card px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-white/50 uppercase">
              Now showing
            </p>
            <p className="fv3-display text-2xl" data-testid="presenter-section">
              {SECTIONS[idx]?.label}
            </p>
            <p className="text-sm text-white/70">{SECTIONS[idx]?.cue}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={idx <= 0}
              onClick={() => go(SECTION_IDS[idx - 1]!)}
              className="rounded-full bg-white/10 px-5 py-3 font-bold disabled:opacity-30"
              data-testid="prev"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={idx >= SECTION_IDS.length - 1}
              onClick={() => go(SECTION_IDS[idx + 1]!)}
              className="fv3-shimmer rounded-full px-6 py-3 font-black text-black disabled:opacity-30"
              data-testid="next"
            >
              Next →
            </button>
          </div>
        </div>
        <ol className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(s.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                  i === idx
                    ? "bg-white text-black ring-white"
                    : i < idx
                      ? "bg-white/5 text-white/50 ring-white/10"
                      : "bg-white/10 text-white/80 ring-white/20"
                }`}
                data-testid={`go-${s.id}`}
              >
                {i + 1}. {s.label}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* Voting */}
      <section className="fv3-card px-5 py-5">
        <p className="text-xs tracking-widest text-white/50 uppercase">
          Voting
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {QUESTIONS.map((q) => {
            const status: VoteStatus = state?.questions[q.id] ?? "closed";
            const total =
              snapshot?.tallies[q.id].reduce((a, b) => a + b, 0) ?? 0;
            const here = question?.id === q.id;
            return (
              <li
                key={q.id}
                className={`rounded-xl px-4 py-3 ${here ? "bg-white/10 ring-1 ring-fuchsia-400" : "bg-white/5"}`}
                data-testid={`q-${q.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{q.prompt}</span>
                  <span
                    className="rounded-full bg-black/40 px-2 py-0.5 text-xs text-white/70"
                    data-testid={`status-${q.id}`}
                  >
                    {status} · {total} votes
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn
                    on={status === "open"}
                    onClick={() =>
                      act({ type: "question", question: q.id, status: "open" })
                    }
                    testId={`open-${q.id}`}
                  >
                    Open voting
                  </Btn>
                  <Btn
                    on={status === "closed"}
                    onClick={() =>
                      act({
                        type: "question",
                        question: q.id,
                        status: "closed",
                      })
                    }
                    testId={`close-${q.id}`}
                  >
                    Close
                  </Btn>
                  <Btn
                    on={status === "revealed"}
                    onClick={() =>
                      act({
                        type: "question",
                        question: q.id,
                        status: "revealed",
                      })
                    }
                    testId={`reveal-${q.id}`}
                  >
                    Reveal results
                  </Btn>
                  {!here && (
                    <button
                      type="button"
                      onClick={() => go(q.section)}
                      className="text-xs text-white/60 underline"
                    >
                      jump to its section
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Feedback */}
      <FeedbackDesk inbox={inbox} act={act} />

      {/* Finale */}
      <FinaleDesk
        started={state?.finale.started ?? false}
        audioUrl={state?.finale.audioUrl ?? null}
        lyrics={state?.finale.lyrics ?? null}
        act={act}
      />

      {/* Danger */}
      <section className="fv3-card px-5 py-5">
        <p className="text-xs tracking-widest text-white/50 uppercase">
          Reset (asks first)
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["votes", "feedback", "all"] as const).map((what) => (
            <button
              key={what}
              type="button"
              onClick={() => {
                if (window.confirm(`Reset ${what}? This cannot be undone.`))
                  void act({ type: "reset", what });
              }}
              className="rounded-full bg-red-500/20 px-4 py-2 text-sm font-bold text-red-200 ring-1 ring-red-400/40"
              data-testid={`reset-${what}`}
            >
              Reset {what}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Btn({
  on,
  onClick,
  children,
  testId,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${on ? "bg-white text-black ring-white" : "bg-white/10 text-white ring-white/20"}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function FeedbackDesk({ inbox, act }: { inbox: Inbox | null; act: Act }) {
  const [tab, setTab] = useState<Feedback["status"]>("pending");
  const rows = inbox?.feedback.filter((f) => f.status === tab) ?? [];
  return (
    <section className="fv3-card px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-xs tracking-widest text-white/50 uppercase">
          Feedback
        </p>
        {(["pending", "approved", "hidden"] as const).map((s) => (
          <Btn
            key={s}
            on={tab === s}
            onClick={() => setTab(s)}
            testId={`tab-${s}`}
          >
            {s} {inbox?.counts[s] ?? 0}
          </Btn>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-2" data-testid="inbox">
        {rows.length === 0 && (
          <li className="text-sm text-white/50">Nothing here.</li>
        )}
        {rows.map((f) => (
          <li
            key={f.id}
            className="rounded-xl bg-white/5 px-4 py-3"
            data-testid="inbox-row"
          >
            <p className="text-xs tracking-widest text-white/40 uppercase">
              {FEEDBACK_PROMPTS.find((p) => p.id === f.prompt)?.label}
            </p>
            <p className="text-white">{f.body}</p>
            <div className="mt-2 flex gap-2">
              {f.status !== "approved" && (
                <Btn
                  on={false}
                  onClick={() =>
                    act({ type: "moderate", id: f.id, status: "approved" })
                  }
                  testId="approve"
                >
                  Approve → stage
                </Btn>
              )}
              {f.status !== "hidden" && (
                <Btn
                  on={false}
                  onClick={() =>
                    act({ type: "moderate", id: f.id, status: "hidden" })
                  }
                  testId="hide"
                >
                  Hide
                </Btn>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FinaleDesk({
  started,
  audioUrl,
  lyrics,
  act,
}: {
  started: boolean;
  audioUrl: string | null;
  lyrics: string | null;
  act: Act;
}) {
  const [url, setUrl] = useState(audioUrl ?? "");
  const [words, setWords] = useState(lyrics ?? "");
  const [open, setOpen] = useState(false);
  // When the saved URL changes under us (another console, a reset), show it.
  const [seenUrl, setSeenUrl] = useState(audioUrl);
  if (seenUrl !== audioUrl) {
    setSeenUrl(audioUrl);
    setUrl(audioUrl ?? "");
  }
  return (
    <section className="fv3-card px-5 py-5">
      <p className="text-xs tracking-widest text-white/50 uppercase">
        The metal finale
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => act({ type: "finale", started: !started })}
          className={`rounded-full px-5 py-3 font-black ${started ? "bg-red-500 text-white" : "fv3-shimmer text-black"}`}
          data-testid="finale-toggle"
        >
          {started ? "■ Stop the anthem" : "🤘 Start the anthem"}
        </button>
        <span className="self-center text-sm text-white/60">
          {audioUrl
            ? "Audio file set."
            : "No audio yet — the stage shows the ready state."}
        </span>
      </div>
      <label className="mt-4 block text-sm text-white/70" htmlFor="fv3-audio">
        Song file URL (https, mp3/m4a). Saved without a rebuild.
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="fv3-audio"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/no-more-crystal-balls.mp3"
          className="w-full rounded-xl bg-black/40 px-4 py-2 text-white ring-1 ring-white/20 focus:outline-none"
          data-testid="audio-url"
        />
        <Btn
          on={false}
          onClick={() => act({ type: "finale", audioUrl: url.trim() || null })}
          testId="audio-save"
        >
          Save
        </Btn>
      </div>
      <button
        type="button"
        className="mt-3 text-sm text-white/60 underline"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide lyrics editor" : "Edit lyrics"}
      </button>
      {open && (
        <div className="mt-2">
          <textarea
            value={words}
            onChange={(e) => setWords(e.target.value)}
            rows={10}
            placeholder={ANTHEM_LYRICS}
            className="w-full rounded-xl bg-black/40 px-4 py-2 font-mono text-sm text-white ring-1 ring-white/20 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <Btn
              on={false}
              onClick={() =>
                act({ type: "finale", lyrics: words.trim() || null })
              }
            >
              Save lyrics
            </Btn>
            <Btn
              on={false}
              onClick={() => {
                setWords("");
                void act({ type: "finale", lyrics: null });
              }}
            >
              Use the default
            </Btn>
          </div>
        </div>
      )}
    </section>
  );
}
