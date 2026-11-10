"use client";

import { useEffect, useState } from "react";
import { encouragement, LEVELS, type Level } from "@/lib/courtqueue/journey";
import {
  CHALLENGES,
  EXPLORE,
  LESSONS,
  TECHNIQUES,
  lessonOf,
} from "@/lib/courtqueue/learn";
import type { LiveView } from "@/lib/courtqueue/view";
import { Btn, Card, Toggle, cx } from "./bits";
import { Diagram } from "./LearnDiagrams";

type ClubAct = (cmd: object) => Promise<boolean>;

/**
 * **Grow.** The player's own corner: My Badminton Journey, and Learn. Nothing
 * here is shown to anyone else, scored, or required.
 */
export function Grow({
  view,
  clubAct,
  start = "journey",
}: {
  view: LiveView;
  clubAct: ClubAct;
  start?: "journey" | "learn";
}) {
  const [part, setPart] = useState<"journey" | "learn">(start);
  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 gap-2">
        {(
          [
            ["journey", "My Journey"],
            ["learn", "Learn"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={part === id}
            onClick={() => setPart(id)}
            className={cx(
              "rounded-xl py-3 font-bold",
              part === id ? "bg-lime-400 text-slate-950" : "bg-white/10",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {part === "journey" ? (
        <Journey
          view={view}
          clubAct={clubAct}
          onLearn={() => setPart("learn")}
        />
      ) : (
        <Learn view={view} clubAct={clubAct} />
      )}
    </div>
  );
}

/** "Where are you in your badminton journey?" Optional, one tap, asked once. */
export function JourneyIntro({
  view,
  clubAct,
}: {
  view: LiveView;
  clubAct: ClubAct;
}) {
  const [help, setHelp] = useState(false);
  if (view.me!.journey.asked) return null;
  const choose = (level: Level | null) =>
    clubAct({ type: "journey", level, wantsHelp: help });
  return (
    <Card className="mb-4">
      <h2 className="text-lg font-black">
        Where are you in your badminton journey?
      </h2>
      <p className="mt-1 text-sm text-white/70">
        These are just optional guides to help suggest games. Nobody else sees
        your answer, and you can change it any time.
      </p>
      <div className="mt-3 grid gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => choose(l.id)}
            className="rounded-xl bg-white/10 p-3 text-left ring-1 ring-white/10 active:scale-[0.99]"
          >
            <span className="block font-bold">{l.label}</span>
            <span className="block text-sm text-white/60">{l.blurb}</span>
          </button>
        ))}
      </div>
      <Toggle
        label="I'd love a friendly partner who can show me a few things"
        on={help}
        onChange={setHelp}
      />
      <button
        className="mt-1 text-sm text-white/60 underline"
        onClick={() => choose(null)}
      >
        Not now — I&apos;d rather just play
      </button>
    </Card>
  );
}

function Journey({
  view,
  clubAct,
  onLearn,
}: {
  view: LiveView;
  clubAct: ClubAct;
  onLearn: () => void;
}) {
  const j = view.me!.journey;
  const [goal, setGoal] = useState("");
  const [stats, setStats] = useState<{
    attended: number;
    games: number;
    partners: number;
  } | null>(null);
  useEffect(() => {
    fetch("/api/badminton/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setStats(o.me))
      .catch(() => {});
  }, [view.version]);
  const toggle = (key: "practising" | "done", id: string) =>
    clubAct({
      type: "journey",
      [key]: j[key].includes(id)
        ? j[key].filter((x) => x !== id)
        : [...j[key], id],
    });
  const level = LEVELS.find((l) => l.id === j.level);
  const lines = encouragement(
    j,
    stats ?? { attended: 0, games: 0, partners: 0 },
  );

  return (
    <div className="space-y-4">
      <Card tone="calm">
        <h2 className="text-xl font-black">My Badminton Journey</h2>
        <p className="mt-1 text-sm text-white/70">
          Just for you. Nobody else sees this, and there are no scores or
          rankings — only the next fun thing to try.
        </p>
        <ul className="mt-3 space-y-1">
          {lines.map((t) => (
            <li key={t} className="text-lime-200">
              ✓ {t}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-bold">Where I am</h3>
        <div
          className="mt-2 grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label="Where are you in your badminton journey?"
        >
          {LEVELS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={j.level === l.id}
              onClick={() => clubAct({ type: "journey", level: l.id })}
              className={cx(
                "rounded-xl px-1 py-3 text-sm font-bold ring-1",
                j.level === l.id
                  ? "bg-lime-400 text-slate-950 ring-lime-300"
                  : "bg-white/10 ring-white/10",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-white/60">
          {level
            ? `${level.blurb} A guide for suggesting games — not a label.`
            : "Not sure, or would rather not say? That's fine too."}
        </p>
        {j.level && (
          <button
            className="mt-1 text-sm text-white/60 underline"
            onClick={() => clubAct({ type: "journey", level: null })}
          >
            Clear this
          </button>
        )}
        <Toggle
          label="I'd love a friendly partner who can show me a few things"
          on={!!j.wantsHelp}
          onChange={(v) => clubAct({ type: "journey", wantsHelp: v })}
        />
      </Card>

      <Card>
        <h3 className="font-bold">Skills to explore</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-white/80">
          {EXPLORE[j.level ?? "beginner"].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {!j.level && (
          <p className="mt-2 text-sm text-white/50">
            Showing ideas for getting started. Pick where you are above for
            ideas that fit.
          </p>
        )}
      </Card>

      <Card>
        <h3 className="font-bold">Techniques to practise</h3>
        <p className="text-sm text-white/60">
          Tick the ones you&apos;d like to work on. Tap a name to read about it.
        </p>
        <ul className="mt-2 space-y-1">
          {TECHNIQUES.map((t) => (
            <li key={t.id} className="flex items-center gap-3">
              <label className="flex flex-1 cursor-pointer items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={j.practising.includes(t.id)}
                  onChange={() => toggle("practising", t.id)}
                  className="h-5 w-5 accent-lime-400"
                />
                <span>{t.label}</span>
              </label>
              <button
                className="text-sm text-lime-300 underline"
                onClick={onLearn}
                aria-label={`Learn about ${lessonOf(t.lesson)?.title}`}
              >
                Learn
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-bold">My goals</h3>
        <ul className="mt-2 space-y-2">
          {j.goals.map((g) => (
            <li
              key={g}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/5 p-3"
            >
              <span>{g}</span>
              <button
                className="text-sm text-white/60 underline"
                onClick={() =>
                  clubAct({
                    type: "journey",
                    goals: j.goals.filter((x) => x !== g),
                  })
                }
                aria-label={`Remove goal ${g}`}
              >
                Done / remove
              </button>
            </li>
          ))}
        </ul>
        {j.goals.length < 3 && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!goal.trim()) return;
              clubAct({ type: "journey", goals: [...j.goals, goal] });
              setGoal("");
            }}
          >
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={80}
              placeholder="e.g. Rally for twenty hits"
              aria-label="A goal of mine"
              className="min-w-0 flex-1 rounded-xl bg-white/10 p-3"
            />
            <Btn type="submit" kind="ghost" disabled={!goal.trim()}>
              Add
            </Btn>
          </form>
        )}
      </Card>

      <Card>
        <h3 className="font-bold">Optional challenges</h3>
        <p className="text-sm text-white/60">
          Playful and private. Skip them all if you like.
        </p>
        <ul className="mt-2 space-y-1">
          {CHALLENGES.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-start gap-3 py-2">
                <input
                  type="checkbox"
                  checked={j.done.includes(c.id)}
                  onChange={() => toggle("done", c.id)}
                  className="mt-1 h-5 w-5 accent-lime-400"
                />
                <span>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Learn({ view, clubAct }: { view: LiveView; clubAct: ClubAct }) {
  const j = view.me!.journey;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Card tone="calm">
        <h2 className="text-xl font-black">Learn badminton</h2>
        <p className="mt-1 text-sm text-white/70">
          Six short lessons. Read one between games, try one thing, and have fun
          with it.
        </p>
      </Card>
      {LESSONS.map((l) => {
        const isOpen = open === l.id;
        const practising = TECHNIQUES.filter(
          (t) => t.lesson === l.id && j.practising.includes(t.id),
        );
        return (
          <Card key={l.id}>
            <button
              className="flex w-full items-start justify-between gap-3 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : l.id)}
            >
              <span>
                <span className="block text-lg font-bold">{l.title}</span>
                <span className="block text-sm text-white/60">{l.gist}</span>
              </span>
              <span aria-hidden className="text-2xl text-lime-300">
                {isOpen ? "–" : "+"}
              </span>
            </button>
            {isOpen && (
              <div className="mt-3 space-y-3">
                <Diagram id={l.diagram} />
                {l.id === "grip-serve" && <Diagram id="serve" />}
                <ol className="list-decimal space-y-2 pl-5 text-white/85">
                  {l.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
                <p className="rounded-xl bg-lime-400/10 p-3 text-lime-100 ring-1 ring-lime-300/30">
                  <b>Try this: </b>
                  {l.tryThis}
                </p>
                {TECHNIQUES.filter((t) => t.lesson === l.id).map((t) => (
                  <Toggle
                    key={t.id}
                    label={`I'm practising: ${t.label}`}
                    on={practising.some((x) => x.id === t.id)}
                    onChange={(v) =>
                      clubAct({
                        type: "journey",
                        practising: v
                          ? [...j.practising, t.id]
                          : j.practising.filter((x) => x !== t.id),
                      })
                    }
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
