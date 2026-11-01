"use client";

import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { pickProgress } from "@/domain/hockey/reveal";
import {
  STAGE_COPY,
  daysLine,
  runupItems,
  runupStage,
  type Room,
} from "@/domain/hockey/runup";
import { zoneOr } from "@/domain/hockey/schedule";
import { promptsOf } from "./PlayTab";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

/**
 * **The week, one card.** What this stretch of the run-up is for and what
 * is still open — from what the group has actually done, never a reminder
 * on a timer (`domain/hockey/runup.ts`). Before the game only; on game day
 * the plan and the picks speak for themselves.
 */
export function RunUp({
  night,
  onGo,
}: {
  night: SharedNight;
  onGo: (room: Room, anchor?: string) => void;
}) {
  const { live, definition, role, chirp, play, modules } = night;
  if (!live.me) return null;
  const { stage, daysOut } = runupStage(
    live.now,
    definition.anchorAt,
    zoneOr(definition.timeZone),
  );
  if (stage === "gameday" || stage === "after") return null;
  const me = live.me.id;
  const members = live.participants.length;
  const declared = live.participants.filter((p) => chirp.fans[p.id]).length;
  const dinner = live.prompts.find((p) => p.prompt.id === "pregame-spot");
  const picksBlock = live.blocks.find((b) => b.id === "picks");
  const myPicks = picksBlock
    ? pickProgress(promptsOf(picksBlock, live.prompts, live.phase.id))
    : { mine: 0, total: 0, open: false };
  const open = play.challenges.filter(
    (c) => c.status === "open" || c.status === "accepted",
  );
  const items = runupItems(stage, {
    members,
    declared,
    myTeam: Boolean(chirp.fans[me]),
    dinnerVotes: dinner?.responses.length ?? 0,
    dinnerOn: modules.includes("dinner") && Boolean(dinner),
    myPicks: { mine: myPicks.mine, total: myPicks.total },
    picksOn: modules.includes("picks") && myPicks.total > 0,
    challengesOpen: open.length,
    myChallenges: open.filter(
      (c) => c.challenger_id === me || c.target_id === me,
    ).length,
    challengesOn: play.available,
    said: live.moments.filter((m) => m.kind === "note" && m.by).length,
    isHost: role === "host",
  });
  const copy = STAGE_COPY[stage];
  return (
    <section
      aria-labelledby="runup-title"
      data-runup={stage}
      className="rounded-[22px] bg-white/[0.06] px-4 pt-3.5 pb-2 ring-1 ring-white/10"
    >
      <p className="text-[12px] font-bold tracking-[0.16em] text-[#ffd84d] uppercase">
        {daysLine(daysOut)}
      </p>
      <h2
        id="runup-title"
        className={`${styles.wide} mt-1 text-[24px] leading-none text-white`}
      >
        {copy.title}
      </h2>
      <p className="mt-1.5 text-[14.5px] leading-snug text-white/75">
        {copy.line}
      </p>
      <ul className="mt-3 flex flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() =>
                onGo(item.room, item.id === "invite" ? "guest-list" : undefined)
              }
              className="flex min-h-11 w-full items-center gap-2.5 text-left text-[15px]"
            >
              {item.done ? (
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-[#0f7a3d]"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="h-5 w-5 shrink-0 text-white/35"
                  aria-hidden
                />
              )}
              <span
                className={`min-w-0 flex-1 ${item.done ? "text-white/55 line-through decoration-white/30" : "text-white"}`}
              >
                {item.label}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-white/40"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
