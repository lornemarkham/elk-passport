"use client";

import Link from "next/link";
import { ANSWER_WORDS, type Answer } from "@/domain/conference-plans/types";
import { clock, dayWords } from "@/domain/conference-plans/time";
import type { PlansBoard } from "@/lib/conference-plans/service";
import { send, usePoll } from "./usePoll";

/**
 * **What's happening, what can I join, where are we meeting** — the next
 * few plans on the conference home, each answerable in one tap for its next
 * occurrence. The full plan (other days, the vote, the thread) is one tap
 * further, on Plans.
 */
export function UpNext({
  conferenceId,
  initial,
  limit = 4,
}: {
  conferenceId: string;
  initial: PlansBoard;
  limit?: number;
}) {
  const api = `/api/conferences/${conferenceId}/plans`;
  const {
    data: board,
    setData,
    refresh,
  } = usePoll(api, (j) => j.board as PlansBoard, initial, 15_000);
  const now = new Date(board.at);
  const next = board.plans.filter((p) => p.next).slice(0, limit);
  const tz = board.timeZone;

  const answer = async (
    planId: string,
    occurrenceId: string,
    a: Answer | null,
  ) => {
    setData({
      ...board,
      plans: board.plans.map((p) =>
        p.id !== planId
          ? p
          : {
              ...p,
              next:
                p.next && p.next.id === occurrenceId
                  ? { ...p.next, mine: a }
                  : p.next,
            },
      ),
    });
    await send(api, { action: "answer", planId, occurrenceId, answer: a });
    await refresh();
  };

  if (!next.length)
    return (
      <div className="rounded-2xl bg-black/[0.04] p-5">
        <p className="text-[17px] font-bold">Nothing planned yet.</p>
        <p className="mt-1 text-[15px] text-black/60">
          A walk before the first session, lunch away from the venue, a drink
          after. Somebody has to go first.
        </p>
        <Link
          href={`/conferences/${conferenceId}/plans?kind=coffee`}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-black px-4 text-[15px] font-bold text-white"
        >
          + Make a plan
        </Link>
      </div>
    );

  return (
    <ul className="flex flex-col gap-3" data-testid="up-next">
      {next.map((p) => {
        const o = p.next!;
        const at = new Date(o.startsAt);
        const where = p.meeting?.label ?? p.venue?.name;
        return (
          <li
            key={p.id}
            className="rounded-2xl border border-black/10 p-4"
            data-plan={p.title}
          >
            <Link
              href={`/conferences/${conferenceId}/plans#plan-${p.id}`}
              className="block"
            >
              <span className="text-[13px] font-bold tracking-[0.1em] text-black/50 uppercase">
                {p.emoji} {dayWords(at, tz, now)} · {clock(at, tz)}
                {o.status === "soon"
                  ? " · soon"
                  : o.status === "now"
                    ? " · now"
                    : ""}
                {p.occurrences.length > 1
                  ? ` · ${p.occurrences.length} days`
                  : ""}
              </span>
              <span className="mt-0.5 block text-[19px] leading-tight font-black">
                {p.title}
              </span>
              <span className="mt-0.5 block text-[14px] text-black/60">
                {where ? `📍 ${where} · ` : ""}
                {o.counts.in} going
                {o.going.length
                  ? ` — ${o.going
                      .slice(0, 3)
                      .map((g) => (g.you ? "you" : g.name))
                      .join(", ")}${o.counts.in > 3 ? "…" : ""}`
                  : ""}
              </span>
            </Link>
            <div
              className="mt-3 grid grid-cols-3 gap-2"
              role="group"
              aria-label={`Your answer for ${p.title}`}
            >
              {(["in", "maybe", "out"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={o.mine === a}
                  onClick={() => answer(p.id, o.id, o.mine === a ? null : a)}
                  className={`min-h-11 rounded-xl border px-2 text-[14px] font-bold ${
                    o.mine === a
                      ? a === "in"
                        ? "border-black bg-black text-white"
                        : "border-black bg-black/10"
                      : "border-black/15"
                  }`}
                >
                  {ANSWER_WORDS[a]}
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
