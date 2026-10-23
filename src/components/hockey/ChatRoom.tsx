"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Send, SmilePlus } from "lucide-react";
import { Avatar, personColor } from "@/experience-lab/ui/atoms";
import type { LiveExperience } from "@/experience-lab/core/engine";
import type { Moment, Participant } from "@/experience-lab/core/types";
import { CHIRP_BOT, type BotLine, type ChirpRoom } from "@/domain/hockey/chirp";
import { ChirpSomeone } from "./ChirpSomeone";
import { FanTag } from "./FanTag";

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
  slug,
  chirp,
  isHost = false,
  onLook,
  onSetChirp,
}: {
  live: LiveExperience;
  onSay: (text: string) => void;
  onReact: (momentId: string, emoji: string) => void;
  /** The night's id, for asking Chirp Bot for chirps. */
  slug?: string;
  /** Chirp Bot's lines and everybody's team (`domain/hockey/chirp.ts`). */
  chirp?: ChirpRoom;
  isHost?: boolean;
  /** Opened the chat — Chirp Bot may have a pregame question due. */
  onLook?: () => void;
  onSetChirp?: (on: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [chirping, setChirping] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const person = (id?: string) =>
    id ? live.participants.find((p) => p.id === id) : undefined;
  const bot = Boolean(chirp?.available && chirp.on);
  const others = live.participants.filter((p) => p.id !== live.me?.id);

  // Once per visit to the chat, not per poll.
  const looked = useRef(false);
  useEffect(() => {
    if (looked.current || !bot || !live.me || !onLook) return;
    looked.current = true;
    onLook();
  }, [bot, live.me, onLook]);

  // People's moments and Chirp Bot's lines, newest first, one conversation.
  const timeline: (
    | { readonly bot: false; readonly moment: Moment }
    | { readonly bot: true; readonly line: BotLine }
  )[] = [
    ...live.moments.map((moment) => ({ bot: false as const, moment })),
    ...(bot ? (chirp?.lines ?? []) : []).map((line) => ({
      bot: true as const,
      line,
    })),
  ]
    .sort((a, b) =>
      (b.bot ? b.line.at : b.moment.at).localeCompare(
        a.bot ? a.line.at : a.moment.at,
      ),
    )
    .slice(0, 40);

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
            ref={input}
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

      {live.me && bot && slug && others.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setChirping(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#ff5a36]/15 px-4 text-[15px] font-bold text-[#ffb59f] ring-1 ring-[#ff5a36]/50 transition active:scale-95"
          >
            🔥 Chirp Someone
          </button>
          <span className="text-[13px] text-white/50">
            Chirp Bot writes three. You pick one — or none.
          </span>
        </div>
      )}

      {chirping && slug && live.me && (
        <ChirpSomeone
          slug={slug}
          people={others}
          onChoose={(text) => {
            setDraft(text);
            setChirping(false);
            requestAnimationFrame(() => input.current?.focus());
          }}
          onClose={() => setChirping(false)}
        />
      )}

      {timeline.length === 0 && (
        <p className="rounded-2xl bg-white/[0.06] px-4 py-4 text-[15px] text-white/75">
          Nobody&apos;s said anything yet. Somebody has to be first. Make it
          count.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {timeline.map((item) =>
          item.bot ? (
            <BotLineView
              key={item.line.id}
              line={item.line}
              me={live.me}
              people={live.participants}
              onReact={onReact}
            />
          ) : (
            <Line
              key={item.moment.id}
              moment={item.moment}
              who={person(item.moment.by)}
              me={live.me}
              people={live.participants}
              onReact={onReact}
            />
          ),
        )}
      </ul>

      {isHost && chirp?.available && onSetChirp && (
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-white/55">
          {chirp.on
            ? "Chirp Bot is in the chat."
            : "Chirp Bot is out of the chat tonight."}
          <button
            type="button"
            onClick={() => onSetChirp(!chirp.on)}
            className="min-h-11 rounded-full px-4 text-white/80 ring-1 ring-white/20"
          >
            {chirp.on ? "Kick Chirp Bot out" : "Let Chirp Bot back in"}
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * **Chirp Bot's line** — never mistaken for a person's: its own mic badge,
 * a striped bubble, BOT on the name, and what kind of thing it is saying
 * (a joke, or an opinion question). A fact, when a question leans on one,
 * sits apart from the joke with its source and the day it was checked.
 */
function BotLineView({
  line,
  me,
  people,
  onReact,
}: {
  line: BotLine;
  me: Participant | null;
  people: readonly Participant[];
  onReact: (momentId: string, emoji: string) => void;
}) {
  return (
    <li className="flex gap-3" data-chirp-bot={line.kind}>
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[repeating-linear-gradient(135deg,#ffd84d_0_5px,#0b1220_5px_10px)] text-[17px] ring-2 ring-[#ffd84d]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b1220]">
          {CHIRP_BOT.emoji}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-dashed border-[#ffd84d]/60 bg-[#ffd84d]/[0.07] px-4 py-2.5">
          <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-[#ffd84d]">
            {CHIRP_BOT.name}
            <span className="rounded bg-[#ffd84d] px-1 text-[10.5px] leading-[16px] tracking-wider text-[#0b1220]">
              BOT
            </span>
            <span className="text-[11.5px] font-semibold tracking-wide text-white/50 uppercase">
              {line.tone === "opinion" ? "Hot take · opinion" : "Satire"}
            </span>
          </p>
          <p className="text-[16px] leading-snug [overflow-wrap:anywhere] text-white">
            {line.text}
          </p>
          {line.fact && (
            <p className="mt-2 border-t border-white/10 pt-2 text-[13.5px] leading-snug text-white/75">
              <span className="mr-1 font-bold tracking-wide text-white/90 uppercase">
                Fact
              </span>
              {line.fact.text}{" "}
              <a
                href={line.fact.url}
                target="_blank"
                rel="noreferrer"
                className="text-white/60 underline underline-offset-2"
              >
                {line.fact.source}, checked{" "}
                {new Date(
                  `${line.fact.verifiedOn}T12:00:00Z`,
                ).toLocaleDateString("en-CA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </a>
            </p>
          )}
        </div>
        <Reactions
          momentId={line.id}
          reactions={line.reactions}
          me={me}
          people={people}
          onReact={onReact}
        />
      </div>
    </li>
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
              className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-bold"
              style={{ color: personColor(who.hue, 0.8) }}
            >
              <span className="truncate">{who.name}</span>
              <FanTag personId={who.id} />
            </p>
          )}
          <p className="text-[16px] leading-snug [overflow-wrap:anywhere] text-white">
            {moment.kind === "photo" && (
              <Camera className="mr-1.5 inline h-4 w-4 text-white/60" />
            )}
            {moment.text}
          </p>
        </div>
        <Reactions
          momentId={moment.id}
          reactions={moment.reactions ?? {}}
          me={me}
          people={people}
          onReact={onReact}
        />
      </div>
    </li>
  );
}

/** The reactions under a line, and the five to add — people's and Chirp Bot's alike. */
function Reactions({
  momentId,
  reactions: all,
  me,
  people,
  onReact,
}: {
  momentId: string;
  reactions: Readonly<Record<string, readonly string[]>>;
  me: Participant | null;
  people: readonly Participant[];
  onReact: (momentId: string, emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const reactions = Object.entries(all).filter(([, ids]) => ids.length > 0);
  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {reactions.map(([emoji, ids]) => (
          <button
            key={emoji}
            type="button"
            disabled={!me}
            aria-pressed={Boolean(me && ids.includes(me.id))}
            onClick={() => onReact(momentId, emoji)}
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
                onReact(momentId, emoji);
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
    </>
  );
}
