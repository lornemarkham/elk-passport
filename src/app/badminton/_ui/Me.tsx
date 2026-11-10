"use client";

import { useEffect, useState } from "react";
import { SKILL_NAMES, type Skill } from "@/lib/courtqueue/model";
import type { LiveView } from "@/lib/courtqueue/view";
import { Avatar, Btn, Card, SkillTag, Toggle, plural } from "./bits";
import { post } from "./api";

interface Stats {
  me: {
    attended: number;
    games: number;
    minutes: number;
    wins: number;
    losses: number;
    winPct: number | null;
    partners: number;
    mentoredGames: number;
    kudos: number;
    awards: number;
    points: number;
    skillHistory: {
      at: number;
      from: number | null;
      to: Skill;
      reason: string;
    }[];
  };
  board: {
    person: {
      id: string;
      name: string;
      skill: Skill;
      photo: boolean;
      mentor: boolean;
    };
    private: boolean;
    points: number;
    attended: number;
    games: number;
    minutes: number;
    winPct: number | null;
    partners: number;
    hint: string | null;
  }[];
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
  alerts: { supported: boolean; on: boolean; enable: () => void };
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
          <SkillTag skill={me.skill} />
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
          <h2 className="mb-3 font-bold">Your badminton</h2>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat n={s.points} label="points" />
            <Stat n={s.attended} label="nights" />
            <Stat n={s.games} label="games" />
            <Stat n={s.minutes} label="minutes" />
            <Stat
              n={`${s.wins}–${s.losses}`}
              label={s.winPct === null ? "won–lost" : `won–lost · ${s.winPct}%`}
            />
            <Stat n={s.partners} label="partners" />
          </dl>
          {(s.mentoredGames > 0 || s.kudos > 0) && (
            <p className="mt-3 text-sm text-white/70">
              {s.mentoredGames > 0
                ? `${plural(s.mentoredGames, "game")} mentoring · `
                : ""}
              {plural(s.kudos, "shout-out")} from other players
            </p>
          )}
          <p className="mt-3 text-xs text-white/50">
            Points are for taking part — showing up, playing, new partners,
            helping beginners, being a good sport. They say nothing about skill.
          </p>
          {s.skillHistory.length > 1 && (
            <div className="mt-3">
              <p className="text-sm font-semibold">Level history</p>
              <ul className="text-sm text-white/70">
                {s.skillHistory.map((h) => (
                  <li key={h.at}>
                    {new Date(h.at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                    })}
                    : {SKILL_NAMES[h.to]} — {h.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {stats && stats.board.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Club board</h2>
          <p className="mb-2 text-xs text-white/50">
            {me.organizer
              ? "Everyone (private players marked)."
              : "Players who share their stats."}{" "}
            Sorted by participation points.
          </p>
          <ol className="space-y-2">
            {stats.board.map((r, i) => (
              <li
                key={r.person.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-right text-white/50">{i + 1}</span>
                  <Avatar p={r.person} size={26} />
                  <span className="truncate">
                    {r.person.name}
                    {r.private ? " 🔒" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-white/70">
                  {r.points} pts · {r.games} games
                  {r.winPct !== null ? ` · ${r.winPct}%` : ""}
                  {r.hint && (
                    <span className="block text-xs text-amber-300">
                      {r.hint}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
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
          label="Share my stats on the club board"
          on={me.statsPublic}
          onChange={(v) => clubAct({ type: "profile", statsPublic: v })}
        />
        <Toggle
          label="I'm happy to mentor beginners"
          on={me.mentor}
          onChange={(v) => clubAct({ type: "profile", mentor: v })}
        />
        <p className="text-xs text-white/50">
          Mentors are sometimes matched with newer players on the Intermediate
          Court — not every game.
        </p>
        <p className="mt-3 text-sm text-white/70">
          Your level ({SKILL_NAMES[me.skill]}) is set by the organizer after
          your first night.
        </p>
        {alerts.supported && (
          <div className="mt-3">
            {alerts.on ? (
              <p className="text-sm text-lime-300">
                Alerts are on for when you&apos;re called.
              </p>
            ) : (
              <Btn kind="ghost" onClick={alerts.enable}>
                Alert me when I&apos;m up
              </Btn>
            )}
            <p className="mt-1 text-xs text-white/50">
              Optional. The app works without it. On iPhone, add CourtQueue to
              your Home Screen first (Share → Add to Home Screen).
            </p>
          </div>
        )}
      </Card>

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
