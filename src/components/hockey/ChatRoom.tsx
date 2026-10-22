"use client";

import { useState } from "react";
import { Camera, Send, SmilePlus } from "lucide-react";
import { Avatar, personColor } from "@/experience-lab/ui/atoms";
import type { LiveExperience } from "@/experience-lab/core/engine";
import type { Moment, Participant } from "@/experience-lab/core/types";

/** The lab's five, with the goal horn first. */
const REACTIONS = ["🚨", "😂", "🔥", "🙅", "❤️"];

/**
 * **The night's conversation, sized for a thumb.**
 *
 * The same moments, the same reactions and the same `say`/`react` actions
 * as the lab's feed (`FeedBlock`) — drawn for a phone in a loud room: 16 px
 * type (and a 16 px box, so an iPhone does not zoom when you tap it),
 * reactions you can hit, the goal horn one tap away. Passport's own lines
 * stay lines, never bubbles: it is the room, not a person in it.
 */
export function ChatRoom({
  live,
  onSay,
  onReact,
}: {
  live: LiveExperience;
  onSay: (text: string) => void;
  onReact: (momentId: string, emoji: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const person = (id?: string) =>
    id ? live.participants.find((p) => p.id === id) : undefined;

  return (
    <div className="flex flex-col gap-5">
      {live.me && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSay(draft);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            placeholder="Say something to the group"
            aria-label="Say something to the group"
            className="min-h-12 min-w-0 flex-1 rounded-full bg-white/[0.08] px-5 text-[16px] text-white ring-1 ring-white/15 outline-none placeholder:text-white/50 focus:ring-white/45"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ffd84d] text-[#0b1220] transition active:scale-95 disabled:opacity-35"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      )}

      {live.moments.length === 0 && (
        <p className="rounded-2xl bg-white/[0.06] px-4 py-4 text-[15px] text-white/75">
          Nobody&apos;s said anything yet. Somebody has to be first. Make it
          count.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {live.moments.slice(0, 40).map((moment) => (
          <Line
            key={moment.id}
            moment={moment}
            who={person(moment.by)}
            me={live.me}
            people={live.participants}
            onReact={onReact}
          />
        ))}
      </ul>
    </div>
  );
}

function Line({
  moment,
  who,
  me,
  people,
  onReact,
}: {
  moment: Moment;
  who?: Participant;
  me: Participant | null;
  people: readonly Participant[];
  onReact: (momentId: string, emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const reactions = Object.entries(moment.reactions ?? {}).filter(
    ([, ids]) => ids.length > 0,
  );

  if (moment.kind === "voice") {
    return (
      <li className="flex gap-2 text-[15px] leading-snug text-white/75 italic">
        <span aria-hidden className="not-italic">
          📣
        </span>
        {moment.text}
      </li>
    );
  }

  if (moment.kind === "join") {
    return (
      <li className="flex items-center gap-2 text-[14px] text-white/60">
        {who && <Avatar person={who} size={22} />}
        {who?.name} joined.
      </li>
    );
  }

  if (moment.kind === "result") {
    return (
      <li className="flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3">
        <span className="text-[22px]">{moment.emoji}</span>
        <span className="text-[16px] font-semibold text-white">
          {moment.text}
        </span>
      </li>
    );
  }

  const mine = me && who?.id === me.id;
  return (
    <li className="flex gap-3">
      {who ? (
        <Avatar person={who} size={36} />
      ) : (
        <span className="w-9" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div
          className={`rounded-2xl rounded-tl-md px-4 py-2.5 ${
            mine ? "bg-white/[0.12]" : "bg-[#101826] ring-1 ring-white/10"
          }`}
        >
          {who && (
            <p
              className="text-[13.5px] font-bold"
              style={{ color: personColor(who.hue, 0.8) }}
            >
              {who.name}
            </p>
          )}
          <p className="text-[16px] leading-snug [overflow-wrap:anywhere] text-white">
            {moment.kind === "photo" && (
              <Camera className="mr-1.5 inline h-4 w-4 text-white/60" />
            )}
            {moment.text}
          </p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {reactions.map(([emoji, ids]) => (
            <button
              key={emoji}
              type="button"
              disabled={!me}
              aria-pressed={Boolean(me && ids.includes(me.id))}
              onClick={() => onReact(moment.id, emoji)}
              className={`inline-flex min-h-8 min-w-8 items-center gap-1 rounded-full px-2.5 text-[14px] transition ${
                me && ids.includes(me.id)
                  ? "bg-[#ffd84d]/20 text-white ring-1 ring-[#ffd84d]/70"
                  : "bg-white/[0.06] text-white/80 ring-1 ring-white/10"
              }`}
            >
              {emoji}
              <span className="font-semibold tabular-nums">{ids.length}</span>
            </button>
          ))}
          {me && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="React"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 ring-1 ring-white/15 transition hover:text-white"
            >
              <SmilePlus className="h-4 w-4" />
            </button>
          )}
          {open &&
            REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(moment.id, emoji);
                  setOpen(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-[20px] transition active:scale-90"
              >
                {emoji}
              </button>
            ))}
        </div>
        {reactions.length > 0 && (
          <span className="sr-only">
            {reactions
              .map(
                ([emoji, ids]) =>
                  `${emoji} ${ids
                    .map((id) => people.find((p) => p.id === id)?.name ?? id)
                    .join(", ")}`,
              )
              .join("; ")}
          </span>
        )}
      </div>
    </li>
  );
}
