"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SKILL_NAMES, type Skill } from "@/lib/courtqueue/model";
import type { LiveView } from "@/lib/courtqueue/view";
import { post, useLive } from "./api";
import { Btn, Card, Toggle, cx } from "./bits";
import { ChallengeTab, Courts } from "./Courts";
import { Me } from "./Me";
import { Organizer } from "./Organizer";
import { Tonight } from "./Tonight";

type Tab = "tonight" | "courts" | "challenge" | "me" | "organizer";

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
  const alerts = useAlerts();
  const say = useCallback((text: string, bad?: boolean) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), bad ? 4500 : 2500);
  }, []);
  useCalledAlert(view, alerts.notify, say);

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
  const addSessions = useCallback(async () => {
    const out = await post("/api/badminton/act", { scope: "sessions" });
    if (out.view) accept(out.view);
    if (!out.ok) say(out.error ?? "That didn't work.", true);
    else say("Next Monday and Thursday are on the calendar.");
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
    { id: "tonight", label: "Tonight", icon: "🏸" },
    { id: "courts", label: "Courts", icon: "▦" },
    { id: "challenge", label: "Challenge", icon: "⚔︎" },
    { id: "me", label: "Me", icon: "☺︎" },
    ...(view.me.organizer
      ? [{ id: "organizer" as Tab, label: "Organize", icon: "⚙︎" }]
      : []),
  ];
  const called = view.night?.me?.state === "called";
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
      {called && tab !== "tonight" && (
        <button
          onClick={() => setTab("tonight")}
          className="sticky top-0 z-40 -mx-4 mb-3 block w-[calc(100%+2rem)] bg-lime-400 px-4 py-3 text-center font-black text-slate-950"
        >
          You&apos;re up on court {view.night!.me!.game!.court}! Tap here
        </button>
      )}
      <main className="pb-28">
        {tab === "tonight" && <Tonight view={view} act={act} offset={offset} />}
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
                <span className="text-lg leading-none" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
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

const SKILL_HELP: Record<Skill, string> = {
  1: "New to badminton, or just getting rallies going",
  2: "Can rally; learning positions and serves",
  3: "Comfortable in doubles, consistent clears and drops",
  4: "Strong, quick, tactical; plays competitively",
  5: "Club-competitive; smashes, deception, the works",
};

function Welcome({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"register" | "sign-in">("register");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [skill, setSkill] = useState<Skill | null>(null);
  const [statsPublic, setStatsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const out = await post(
      "/api/badminton/me",
      mode === "register"
        ? { action: "register", name, pin, skill, statsPublic }
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
          Drop-in doubles, three courts, fair turns. Tap PLAY, put your phone
          down, we&apos;ll call you.
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
        {mode === "register" && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm text-white/70">
                How would you rate yourself?
              </legend>
              <div className="space-y-2">
                {([1, 2, 3, 4, 5] as Skill[]).map((k) => (
                  <label
                    key={k}
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1",
                      skill === k
                        ? "bg-lime-400/15 ring-lime-300"
                        : "bg-white/5 ring-white/10",
                    )}
                  >
                    <input
                      type="radio"
                      name="skill"
                      checked={skill === k}
                      onChange={() => setSkill(k)}
                      className="mt-1 accent-lime-400"
                    />
                    <span>
                      <span className="font-bold">{SKILL_NAMES[k]}</span>
                      <span className="block text-sm text-white/60">
                        {SKILL_HELP[k]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/50">
                The organizer may adjust it after seeing you play. It&apos;s for
                good matches, not ranking.
              </p>
            </fieldset>
            <Toggle
              label="Show my stats on the club board"
              on={statsPublic}
              onChange={setStatsPublic}
            />
          </>
        )}
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
          disabled={
            busy ||
            !name.trim() ||
            pin.length < 4 ||
            (mode === "register" && !skill)
          }
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

/** Optional system notifications. The app never depends on them. */
function useAlerts() {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const reg = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- what the browser supports is only knowable after mount
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker
      .register("/badminton/sw.js", { scope: "/badminton" })
      .then((r) => {
        reg.current = r;
      })
      .catch(() => {});
    setOn(Notification.permission === "granted");
  }, []);
  const enable = useCallback(async () => {
    const p = await Notification.requestPermission();
    setOn(p === "granted");
  }, []);
  const notify = useCallback((title: string, body: string) => {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    if (document.visibilityState === "visible") return;
    void reg.current?.showNotification(title, {
      body,
      tag: "courtqueue",
      icon: "/badminton/app-icon/192",
    });
  }, []);
  return { supported, on, enable, notify };
}

/** When this phone's player is called, or invited, say so — in the app first. */
function useCalledAlert(
  view: LiveView | null,
  notify: (t: string, b: string) => void,
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
        notify("You're up!", `Court ${court}. Head over and tap START GAME.`);
        navigator.vibrate?.([200, 100, 200]);
        beep();
      }
      for (const id of invites)
        if (!was.invites.has(id)) {
          say("You've been challenged!");
          notify("Challenge!", "Someone wants a game with you.");
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
