"use client";

import Link from "next/link";
import { ANSWER_WORDS, type Answer } from "@/domain/conference-plans/types";
import { clock, dayWords } from "@/domain/conference-plans/time";
import type { PlansBoard } from "@/lib/conference-plans/service";
import { AvatarStack, EmptyNote, Pill } from "@/components/conference/kit";
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
      <EmptyNote
        title="No plans with colleagues yet."
        action={{
          href: `/conferences/${conferenceId}/plans?kind=dinner`,
          label: "Suggest a dinner",
        }}
      >
        A walk before the first session, lunch away from the venue, a drink
        after. Somebody has to go first.
      </EmptyNote>
    );

  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-testid="up-next">
      {next.map((p) => {
        const o = p.next!;
        const at = new Date(o.startsAt);
        const where = p.meeting?.label ?? p.venue?.name;
        const names = o.going.map((g) => (g.you ? "You" : g.name));
        return (
          <li
            key={p.id}
            className="border-cf-line hover:border-cf-ink/20 flex flex-col rounded-2xl border bg-white p-5 transition"
            data-plan={p.title}
          >
            <Link
              href={`/conferences/${conferenceId}/plans#plan-${p.id}`}
              className="block flex-1"
            >
              <span className="cf-eyebrow text-cf-mist flex items-center gap-2">
                {p.kindLabel} · {dayWords(at, tz, now)} · {clock(at, tz)}
                {o.status === "soon" || o.status === "now" ? (
                  <Pill tone="live" dot>
                    {o.status === "now" ? "Now" : "Soon"}
                  </Pill>
                ) : null}
              </span>
              <span className="cf-serif text-cf-ink mt-2 block text-[19px] leading-snug">
                {p.title}
              </span>
              <span className="text-cf-slate mt-1 block text-[13px]">
                {where ? where : "Place to be decided"}
                {p.occurrences.length > 1
                  ? ` · ${p.occurrences.length} days`
                  : ""}
                {p.votes && !p.venue && p.options.length
                  ? ` · ${p.options.length} ${p.options.length === 1 ? "place" : "places"} suggested`
                  : ""}
              </span>
              <span className="text-cf-slate mt-3 flex items-center gap-2 text-[13px]">
                {names.length ? (
                  <AvatarStack
                    names={names}
                    more={o.unnamed}
                    size={24}
                    max={4}
                  />
                ) : null}
                {o.counts.in} going
              </span>
            </Link>
            <div
              className="bg-cf-paper mt-4 grid grid-cols-[1fr_1fr_1.35fr] gap-1 rounded-full p-1"
              role="group"
              aria-label={`Your answer for ${p.title}`}
            >
              {(["in", "maybe", "out"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={o.mine === a}
                  onClick={() => answer(p.id, o.id, o.mine === a ? null : a)}
                  className={`min-h-9 rounded-full px-1.5 text-[13px] font-semibold whitespace-nowrap transition ${
                    o.mine === a
                      ? a === "in"
                        ? "bg-cf-ink text-white shadow-sm"
                        : "text-cf-ink bg-white shadow-sm"
                      : "text-cf-slate hover:text-cf-ink"
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
