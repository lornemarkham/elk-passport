"use client";

import { useEffect, useState } from "react";
import type { ChatLevel, LiveView, NotifyPrefs } from "@/lib/courtqueue/view";
import { Avatar, Btn, Card, Toggle, cx, plural } from "./bits";
import { post } from "./api";
import type { Alerts } from "./notify";

interface Stats {
  me: {
    attended: number;
    games: number;
    minutes: number;
    partners: number;
    kudos: number;
  };
}

export function Me({
  view,
  clubAct,
  refresh,
  alerts,
}: {
  view: LiveView;
  clubAct: (cmd: object) => Promise<boolean>;
  refresh: () => void;
  alerts: Alerts;
}) {
  const me = view.me!;
  const [stats, setStats] = useState<Stats | null>(null);
  const [name, setName] = useState(me.name);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/badminton/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, [view.version]);

  const upload = async (file: File) => {
    const dataUrl = await shrink(file);
    const out = await post("/api/badminton/photo", { dataUrl });
    setMsg(out.ok ? "Picture saved." : (out.error ?? "Couldn't save that."));
    refresh();
  };

  const s = stats?.me;
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-4">
        <label className="relative cursor-pointer">
          <Avatar p={me} size={72} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <span className="absolute -right-1 -bottom-1 rounded-full bg-lime-400 px-1.5 text-xs font-bold text-slate-950">
            📷
          </span>
        </label>
        <div className="min-w-0">
          <p className="truncate text-2xl font-black">{me.name}</p>
          {me.organizer && (
            <span className="ml-2 text-xs font-bold text-amber-300">
              ORGANIZER
            </span>
          )}
        </div>
      </Card>
      {msg && <p className="text-sm text-lime-300">{msg}</p>}

      {s && (
        <Card>
          <h2 className="mb-1 font-bold">Your badminton</h2>
          <p className="mb-3 text-xs text-white/50">
            Just for you — nobody else sees these, and there&apos;s nothing to
            beat.
          </p>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat n={s.attended} label="nights" />
            <Stat n={s.games} label="games" />
            <Stat n={s.minutes} label="minutes" />
            <Stat n={s.partners} label="people played with" />
          </dl>
          {s.kudos > 0 && (
            <p className="mt-3 text-sm text-white/70">
              {plural(s.kudos, "thank-you")} from other players 👏
            </p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-bold">Settings</h2>
        <label className="block">
          <span className="text-sm text-white/70">Name</span>
          <div className="mt-1 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl bg-white/10 p-3"
            />
            <Btn
              kind="ghost"
              disabled={name.trim() === me.name}
              onClick={() => clubAct({ type: "profile", name })}
            >
              Save
            </Btn>
          </div>
        </label>
        <Toggle
          label="I'm happy to help newer players"
          on={me.mentor}
          onChange={(v) => clubAct({ type: "profile", mentor: v })}
        />
        <p className="text-xs text-white/50">
          Now and then you may be matched with someone newer, so they meet a
          friendly face. Never required, and not every game. You can also pick{" "}
          <b>Happy to Help</b> for a single night.
        </p>
      </Card>

      <NotificationsCard alerts={alerts} prefs={view.notify} />

      {!me.organizer && (
        <Card>
          <details>
            <summary className="cursor-pointer text-sm text-white/70">
              Organizer?
            </summary>
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Organizer code"
                className="min-w-0 flex-1 rounded-xl bg-white/10 p-3"
              />
              <Btn
                kind="ghost"
                onClick={async () => {
                  const out = await post("/api/badminton/me", {
                    action: "organizer",
                    code,
                  });
                  setMsg(
                    out.ok ? "You're an organizer now." : (out.error ?? "No."),
                  );
                  refresh();
                }}
              >
                Unlock
              </Btn>
            </div>
            <button
              className="mt-3 text-sm text-white/70 underline"
              onClick={async () => {
                const out = await post("/api/badminton/me", {
                  action: "organizer",
                });
                setMsg(
                  out.ok ? "You're an organizer now." : (out.error ?? "No."),
                );
                refresh();
              }}
            >
              I&apos;m signed in to Passport as an administrator
            </button>
          </details>
        </Card>
      )}

      <Btn
        kind="ghost"
        className="w-full"
        onClick={async () => {
          await post("/api/badminton/me", { action: "sign-out" });
          refresh();
        }}
      >
        Sign out
      </Btn>
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-2">
      <dd className="text-2xl font-black tabular-nums">{n}</dd>
      <dt className="text-[11px] text-white/60">{label}</dt>
    </div>
  );
}

/** A square 192px JPEG, small enough to store and quick to load. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const size = 192;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const side = Math.min(img.width, img.height);
    canvas
      .getContext("2d")!
      .drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      );
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Turning on real notifications, with the iPhone steps spelled out. */
export function NotificationsCard({
  alerts,
  prefs,
}: {
  alerts: Alerts;
  prefs?: NotifyPrefs;
}) {
  return (
    <Card>
      <h2 className="mb-1 font-bold">Notifications</h2>
      <p className="mb-3 text-sm text-white/70">
        Your phone tells you when sign-up opens, when you&apos;re off the
        waitlist and when your court is ready — even locked. The screen here
        always shows the same thing, so nothing depends on it.
      </p>
      {alerts.state === "on" && (
        <div className="space-y-2">
          <p className="font-semibold text-lime-300">On for this phone ✓</p>
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={alerts.test}>
              Send me a test
            </Btn>
            <Btn kind="ghost" onClick={alerts.disable}>
              Turn off
            </Btn>
          </div>
        </div>
      )}
      {(alerts.state === "off" || alerts.state === "busy") && (
        <Btn
          className="w-full"
          disabled={alerts.state === "busy"}
          onClick={alerts.enable}
        >
          Turn on notifications
        </Btn>
      )}
      {prefs && <NotifyChoices prefs={prefs} />}
      {alerts.state === "denied" && (
        <p className="text-sm text-amber-200">
          Notifications are blocked for CourtQueue. Allow them in your
          phone&apos;s Settings → Notifications → CourtQueue, then come back.
        </p>
      )}
      {alerts.state === "needs-home-screen" && (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-white/80">
          <li>
            Tap <b>Share</b> (the square with the arrow) in Safari.
          </li>
          <li>
            Choose <b>Add to Home Screen</b>, then <b>Add</b>.
          </li>
          <li>
            Open <b>CourtQueue</b> from your Home Screen and sign in.
          </li>
          <li>
            Come back here and tap <b>Turn on notifications</b>.
          </li>
        </ol>
      )}
      {alerts.state === "unsupported" && (
        <p className="text-sm text-white/60">
          This browser can&apos;t show notifications. Keep CourtQueue open — it
          calls you on screen, with a sound and a buzz.
        </p>
      )}
    </Card>
  );
}

const CHAT_CHOICES: { id: ChatLevel; label: string; help: string }[] = [
  {
    id: "off",
    label: "Off",
    help: "Read the Clubhouse when you open the app.",
  },
  {
    id: "mine",
    label: "Just me",
    help: "Only when someone @mentions you.",
  },
  {
    id: "all",
    label: "Every message",
    help: "Anything said in the Clubhouse.",
  },
];

/**
 * Two separate switches: the courts (your game being ready, sign-up opening)
 * and the Clubhouse. Turning the chat down never costs you a court call.
 */
function NotifyChoices({ prefs }: { prefs: NotifyPrefs }) {
  const [courts, setCourts] = useState(prefs.courts);
  const [chat, setChat] = useState(prefs.chat);
  // Follow the server when it changes (another phone, a refresh).
  const [seen, setSeen] = useState(prefs);
  if (seen !== prefs) {
    setSeen(prefs);
    setCourts(prefs.courts);
    setChat(prefs.chat);
  }
  const save = (next: Partial<NotifyPrefs>) =>
    post("/api/badminton/push", { action: "prefs", prefs: next });
  return (
    <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
      <Toggle
        label="Court-ready & game-night alerts"
        on={courts}
        onChange={(v) => {
          setCourts(v);
          void save({ courts: v });
        }}
      />
      <fieldset>
        <legend className="mb-1 text-sm text-white/80">
          Clubhouse chat alerts
        </legend>
        <div className="flex rounded-xl bg-white/10 p-1">
          {CHAT_CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={chat === c.id}
              onClick={() => {
                setChat(c.id);
                void save({ chat: c.id });
              }}
              className={cx(
                "flex-1 rounded-lg py-2 text-sm font-bold",
                chat === c.id ? "bg-lime-400 text-slate-950" : "text-white/70",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-white/50">
          {CHAT_CHOICES.find((c) => c.id === chat)!.help} These two settings are
          independent.
        </p>
      </fieldset>
    </div>
  );
}
