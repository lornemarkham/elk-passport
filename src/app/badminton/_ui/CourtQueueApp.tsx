"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveView } from "@/lib/courtqueue/view";
import { post, useLive } from "./api";
import { Btn, Card, cx } from "./bits";
import { Clubhouse, unreadCount } from "./Clubhouse";
import { ChallengeTab, Courts } from "./Courts";
import { Me } from "./Me";
import { useAlerts } from "./notify";
import { Organizer } from "./Organizer";
import { Schedule } from "./Schedule";
import { FinishSheet, Tonight, UpTakeover } from "./Tonight";

type Tab =
  | "tonight"
  | "clubhouse"
  | "courts"
  | "schedule"
  | "challenge"
  | "me"
  | "organizer";

/**
 * **CourtQueue — Everybody Plays.** One phone each, no central screen. The
 * whole app is this page; everything it shows comes from the server and is
 * refreshed every couple of seconds.
 */
export function CourtQueueApp() {
  const [focus, setFocus] = useState<string | null>(null);
  const { view, notReady, online, offset, refresh, accept } = useLive(focus);
  const [tab, setTab] = useState<Tab>("tonight");
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(
    null,
  );
  const alerts = useAlerts(view?.me?.id ?? null);
  const [finishing, setFinishing] = useState(false);
  const [hidden, setHidden] = useState<string | null>(null);
  const say = useCallback((text: string, bad?: boolean) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), bad ? 4500 : 2500);
  }, []);
  useCalledAlert(view, alerts.state === "on" ? null : alerts.notify, say);

  const actPath = `/api/badminton/act${focus ? `?org=${encodeURIComponent(focus)}` : ""}`;
  const act = useCallback(
    async (cmd: object, sessionId?: string) => {
      const id = sessionId ?? view?.night?.id;
      const out = await post(actPath, { scope: "session", sessionId: id, cmd });
      if (out.view) accept(out.view);
      if (!out.ok) say(out.error ?? "That didn't work.", true);
      return out.ok;
    },
    [view?.night?.id, accept, say, actPath],
  );
  const clubAct = useCallback(
    async (cmd: object) => {
      const out = await post(actPath, { scope: "club", cmd });
      if (out.view) accept(out.view);
      if (!out.ok) say(out.error ?? "That didn't work.", true);
      return out.ok;
    },
    [accept, say, actPath],
  );
  const chatSend = useCallback(
    async (cmd: object) => {
      const out = await post("/api/badminton/chat", { cmd });
      if (out.view) accept(out.view);
      if (!out.ok) say(out.error ?? "That didn't work.", true);
      return out.ok;
    },
    [accept, say],
  );
  // The newest Clubhouse message this phone has read (kept on the phone).
  const [seen, setSeen] = useState<string | null>(null);
  const newest = view?.clubhouse?.messages.at(-1)?.id ?? null;
  useEffect(() => {
    if (!view?.me || newest === null) return;
    if (tab === "clubhouse") {
      localStorage.setItem(SEEN_KEY, newest);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors a value kept in localStorage
      setSeen(newest);
    } else if (seen === null) {
      // First time on this phone: start from where the room is now, so
      // nobody opens to a "47 unread" they never had a chance to read.
      const was = localStorage.getItem(SEEN_KEY);
      const start = was ?? newest;
      if (was === null) localStorage.setItem(SEEN_KEY, newest);
      setSeen(start);
    }
  }, [tab, newest, seen, view?.me]);
  const unread = unreadCount(view, seen);
  const addSessions = useCallback(async () => {
    const out = await post("/api/badminton/act", { scope: "sessions" });
    if (out.view) accept(out.view);
    if (!out.ok) say(out.error ?? "That didn't work.", true);
    else say("The next club nights are on the calendar.");
    return out.ok;
  }, [accept, say]);

  if (notReady && !view)
    return (
      <Shell>
        <Card>
          <h1 className="text-2xl font-black">
            CourtQueue isn&apos;t switched on yet
          </h1>
          <p className="mt-2 text-white/70">
            The organizer is setting it up. Try again soon.
          </p>
          <p className="mt-4 text-xs text-white/40">{notReady.because}</p>
        </Card>
      </Shell>
    );
  if (!view)
    return (
      <Shell>
        <p className="mt-24 text-center text-white/60">Loading the courts…</p>
      </Shell>
    );
  if (!view.me)
    return (
      <Shell>
        <Welcome onDone={() => refresh(true)} />
      </Shell>
    );

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "tonight", label: "Home", icon: "🏸" },
    { id: "clubhouse", label: "Clubhouse", icon: "💬" },
    { id: "courts", label: "Courts", icon: "▦" },
    { id: "schedule", label: "Schedule", icon: "▤" },
    { id: "me", label: "Me", icon: "☺︎" },
    ...(view.me.organizer
      ? [{ id: "organizer" as Tab, label: "Organize", icon: "⚙︎" }]
      : []),
  ];
  const called = view.night?.me?.state === "called";
  const game = view.night?.me?.game ?? null;
  const takeover = called && game && hidden !== game.id;
  return (
    <Shell>
      {!online && (
        <div
          role="status"
          className="sticky top-0 z-40 -mx-4 mb-3 bg-amber-400 px-4 py-2 text-center text-sm font-bold text-slate-950"
        >
          Reconnecting… what you see may be a moment old.
        </div>
      )}
      {takeover && (
        <UpTakeover
          night={view.night!}
          meId={view.me.id}
          act={act}
          onFinish={() => setFinishing(true)}
          onHide={() => setHidden(game!.id)}
        />
      )}
      {game && (
        <FinishSheet
          key={game.id}
          open={finishing}
          onClose={() => setFinishing(false)}
          g={game}
          act={act}
        />
      )}
      {called && tab !== "tonight" && (
        <button
          onClick={() => setTab("tonight")}
          className="sticky top-0 z-40 -mx-4 mb-3 block w-[calc(100%+2rem)] bg-lime-400 px-4 py-3 text-center font-black text-slate-950"
        >
          You&apos;re up on court {view.night!.me!.game!.court}! Tap here
        </button>
      )}
      <main className="pb-28">
        {tab === "tonight" && (
          <Tonight
            view={view}
            act={act}
            offset={offset}
            onFinish={() => setFinishing(true)}
            onRequest={() => setTab("challenge")}
            alerts={alerts}
          />
        )}
        {tab === "clubhouse" && view.clubhouse && (
          <Clubhouse view={view} send={chatSend} act={act} seen={seen} />
        )}
        {tab === "schedule" && <Schedule view={view} clubAct={clubAct} />}
        {tab === "courts" && <Courts view={view} offset={offset} />}
        {tab === "challenge" && <ChallengeTab view={view} act={act} />}
        {tab === "me" && (
          <Me
            view={view}
            clubAct={clubAct}
            refresh={() => refresh(true)}
            alerts={alerts}
          />
        )}
        {tab === "organizer" && view.organizer && (
          <Organizer
            view={view}
            act={act}
            clubAct={clubAct}
            addSessions={addSessions}
            focus={focus}
            setFocus={setFocus}
          />
        )}
      </main>
      {toast && (
        <div
          role="alert"
          className={cx(
            "fixed inset-x-4 bottom-24 z-50 rounded-xl px-4 py-3 text-center font-semibold shadow-xl",
            toast.bad ? "bg-rose-500 text-white" : "bg-lime-400 text-slate-950",
          )}
        >
          {toast.text}
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-lg">
          {tabs.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cx(
                  "flex w-full flex-col items-center py-2 text-xs",
                  tab === t.id ? "text-lime-300" : "text-white/60",
                )}
              >
                <span className="relative text-lg leading-none" aria-hidden>
                  {t.icon}
                  {t.id === "clubhouse" &&
                    unread > 0 &&
                    tab !== "clubhouse" && (
                      <span className="absolute -top-1.5 -right-3 min-w-4 rounded-full bg-lime-400 px-1 text-center text-[10px] leading-4 font-black text-slate-950">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                </span>
                {t.label}
                {t.id === "clubhouse" && unread > 0 && tab !== "clubhouse" && (
                  <span className="sr-only"> ({unread} new)</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {children}
    </div>
  );
}

const SEEN_KEY = "cq_clubhouse_seen";

function Welcome({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"register" | "sign-in">("register");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const out = await post(
      "/api/badminton/me",
      mode === "register"
        ? { action: "register", name, pin }
        : { action: "sign-in", name, pin },
    );
    setBusy(false);
    if (out.ok) onDone();
    else setError(out.error ?? "That didn't work.");
  };
  return (
    <div className="space-y-5 pb-10">
      <header className="pt-6 text-center">
        <p className="text-5xl" aria-hidden>
          🏸
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">CourtQueue</h1>
        <p className="text-lg font-semibold text-lime-300">Everybody Plays.</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-white/70">
          Everyone is welcome. Come play, meet people, and have fun! Tap PLAY,
          put your phone down, and we&apos;ll call you.
        </p>
      </header>
      <div className="flex rounded-xl bg-white/10 p-1">
        {(["register", "sign-in"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cx(
              "flex-1 rounded-lg py-2 font-bold",
              mode === m ? "bg-lime-400 text-slate-950" : "text-white/70",
            )}
          >
            {m === "register" ? "I'm new" : "Sign in"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-white/70">
            Your name (as people know you)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className="mt-1 w-full rounded-xl bg-white/10 p-3 text-lg"
          />
        </label>
        <label className="block">
          <span className="text-sm text-white/70">
            {mode === "register" ? "Choose a PIN (4–8 digits)" : "PIN"}
          </span>
          <input
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            inputMode="numeric"
            type="password"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
            className="mt-1 w-full rounded-xl bg-white/10 p-3 text-lg tracking-widest"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-500/20 p-3 text-sm text-rose-100"
          >
            {error}
          </p>
        )}
        <Btn
          type="submit"
          big
          disabled={busy || !name.trim() || pin.length < 4}
        >
          {mode === "register" ? "Join CourtQueue" : "Sign in"}
        </Btn>
        {mode === "sign-in" && (
          <p className="text-center text-xs text-white/50">
            Forgot your PIN? The organizer can set a new one.
          </p>
        )}
      </form>
    </div>
  );
}

/** When this phone's player is called, or invited, say so — in the app first. */
function useCalledAlert(
  view: LiveView | null,
  notify: ((t: string, b: string) => void) | null,
  say: (t: string) => void,
) {
  const prev = useRef<{
    state?: string;
    invites: Set<string>;
    roster: Record<string, string | null>;
  } | null>(null);
  useEffect(() => {
    if (!view?.me) return;
    const me = view.night?.me;
    const invites = new Set(
      (view.night?.challenges ?? [])
        .filter(
          (c) => c.status === "pending" && !c.accepted.includes(view.me!.id),
        )
        .map((c) => c.id),
    );
    const roster = Object.fromEntries(view.sessions.map((s) => [s.id, s.mine]));
    const was = prev.current;
    if (was) {
      if (me?.state === "called" && was.state !== "called") {
        const court = me.game?.court;
        say(`You're up — court ${court}!`);
        notify?.(
          `COURT ${court} — YOU'RE UP!`,
          "Head over and tap START GAME.",
        );
        navigator.vibrate?.([200, 100, 200]);
        beep();
      }
      for (const id of invites)
        if (!was.invites.has(id)) {
          say("You've got a game invite!");
          notify?.("A game invite 🏸", "Someone would love a game with you.");
        }
      for (const s of view.sessions)
        if (was.roster[s.id] === "waitlist" && s.mine === "confirmed")
          say(`You're in for ${s.label}!`);
    }
    prev.current = { state: me?.state, invites, roster };
  }, [view, notify, say]);
}

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {
    // Sound is a nicety.
  }
}
