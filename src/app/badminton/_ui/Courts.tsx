"use client";

import { useMemo, useState } from "react";
import { SKILL_NAMES } from "@/lib/courtqueue/model";
import type { LiveView } from "@/lib/courtqueue/view";
import { Btn, Card, Elapsed, Person, SkillTag, clock, cx } from "./bits";
import { Teams, type Act } from "./Tonight";

export function Courts({ view, offset }: { view: LiveView; offset: number }) {
  const night = view.night;
  const meId = view.me!.id;
  if (!night) return <Card>No session tonight.</Card>;
  return (
    <div className="space-y-3">
      {[...night.courts].reverse().map((c) => (
        <Card key={c.id} className={cx(c.closed && "opacity-50")}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-black">
              Court {c.id} · {c.name}
            </h2>
            <span className="text-sm font-semibold">
              {c.closed ? (
                "Closed"
              ) : !c.game ? (
                <span className="text-lime-300">Available</span>
              ) : c.game.status === "called" ? (
                "Called"
              ) : (
                "Occupied"
              )}
            </span>
          </div>
          <p className="text-sm text-white/60">{c.where}</p>
          {c.game && (
            <>
              <Teams g={c.game} meId={meId} />
              <p className="mt-2 text-sm text-white/70">
                {c.game.status === "playing" ? (
                  <>
                    Started {clock(c.game.startedAt!)} ·{" "}
                    <Elapsed from={c.game.startedAt!} offset={offset} />
                  </>
                ) : (
                  <>Called {clock(c.game.calledAt)} · waiting for START</>
                )}
                {c.game.source === "challenge" ? " · challenge" : ""}
              </p>
            </>
          )}
        </Card>
      ))}
      {night.recent.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Results tonight</h2>
          <ul className="divide-y divide-white/10">
            {night.recent.map((g) => (
              <li key={g.id} className="py-2 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>
                    Court {g.court} · {clock(g.finishedAt!)} · {g.minutes} min
                  </span>
                  <span>
                    {g.score ? `${g.score[0]}–${g.score[1]}` : "no score"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span
                    className={cx(
                      "truncate",
                      g.winner === 0 && "font-bold text-lime-300",
                    )}
                  >
                    {g.slots[0]?.name} & {g.slots[1]?.name}
                  </span>
                  <span
                    className={cx(
                      "truncate text-right",
                      g.winner === 1 && "font-bold text-lime-300",
                    )}
                  >
                    {g.slots[2]?.name} & {g.slots[3]?.name}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function ChallengeTab({ view, act }: { view: LiveView; act: Act }) {
  const night = view.night;
  const meId = view.me!.id;
  const [partner, setPartner] = useState("");
  const [o1, setO1] = useState("");
  const [o2, setO2] = useState("");
  const others = useMemo(
    () => night?.present.filter((p) => p.id !== meId) ?? [],
    [night, meId],
  );
  if (!night || night.status !== "live")
    return (
      <Card>
        Challenges open once tonight&apos;s session starts and you&apos;ve
        checked in.
      </Card>
    );
  if (!night.present.some((p) => p.id === meId))
    return <Card>Check in first, then challenge your friends.</Card>;
  const pick = (
    value: string,
    set: (v: string) => void,
    label: string,
    taken: string[],
  ) => (
    <label className="block">
      <span className="text-sm text-white/70">{label}</span>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded-xl bg-white/10 p-3 text-base"
      >
        <option value="">Choose…</option>
        {others
          .filter((p) => !taken.includes(p.id) || p.id === value)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {SKILL_NAMES[p.skill]}
            </option>
          ))}
      </select>
    </label>
  );
  const ready = partner && o1 && o2;
  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-2xl font-black">Friendly challenge</h1>
        <p className="mt-1 text-sm text-white/70">
          Pick your partner and two opponents. All four must accept. Then it
          waits for a court the matchup is allowed on — and never ahead of
          anyone still waiting for their first game.
        </p>
        <div className="mt-4 space-y-3">
          {pick(partner, setPartner, "Your partner", [o1, o2])}
          {pick(o1, setO1, "Opponent", [partner, o2])}
          {pick(o2, setO2, "Their partner", [partner, o1])}
        </div>
        <Btn
          className="mt-4 w-full"
          disabled={!ready}
          onClick={() =>
            act({ type: "challenge", slots: [meId, partner, o1, o2] }).then(
              (ok) => {
                if (ok) {
                  setPartner("");
                  setO1("");
                  setO2("");
                }
              },
            )
          }
        >
          Send challenge
        </Btn>
      </Card>
      <Card>
        <h2 className="font-bold">Who&apos;s here ({night.present.length})</h2>
        <ul className="mt-2 space-y-1.5">
          {night.present.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <Person p={p} me={meId} small />
              <span className="flex items-center gap-1">
                {p.mentor && (
                  <span className="text-xs text-white/60">mentor</span>
                )}
                <SkillTag skill={p.skill} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-bold">Court rules tonight</h2>
        <ul className="mt-2 space-y-1 text-sm text-white/70">
          {night.courts.map((c) => (
            <li key={c.id}>
              <span className="font-semibold text-white">{c.name}:</span>{" "}
              {c.rule}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
