"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CornerDownRight,
  Megaphone,
  Reply,
  Send,
  SmilePlus,
  X,
} from "lucide-react";
import { personColor } from "@/experience-lab/ui/atoms";
import type { LiveExperience } from "@/experience-lab/core/engine";
import type { Moment, Participant } from "@/experience-lab/core/types";
import {
  CHIRP_BOT,
  CHIRP_LEVELS,
  type BotLine,
  type ChirpLevel,
  type ChirpRoom,
} from "@/domain/hockey/chirp";
import {
  announcementsOf,
  quoteOf,
  type Announcement,
} from "@/domain/hockey/announce";
import { AnnouncementCard } from "./Announcements";
import { ChirpSomeone } from "./ChirpSomeone";
import { FanAvatar as Avatar, FanTag } from "./FanTag";
import styles from "./hockey.module.css";

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
 *
 * Since 2026-11-01: **reply** to one line (↩ on any line; the reply quotes
 * it), every line carries its time, and the host's **announcements** are
 * cards in the conversation as well as the banner over the page
 * (`announce.ts`).
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
  announceOn = false,
  onAnnounce,
  onRetract,
}: {
  live: LiveExperience;
  onSay: (text: string, replyTo?: string) => void;
  onReact: (momentId: string, emoji: string) => void;
  /** The night's id, for asking Chirp Bot for chirps. */
  slug?: string;
  /** Chirp Bot's lines and everybody's team (`domain/hockey/chirp.ts`). */
  chirp?: ChirpRoom;
  isHost?: boolean;
  /** Opened the chat — Chirp Bot may have a pregame question due. */
  onLook?: () => void;
  onSetChirp?: (on: boolean, level?: ChirpLevel) => void;
  /** Announcements are on (announce-migration.sql); the host may post one. */
  announceOn?: boolean;
  onAnnounce?: () => void;
  onRetract?: (momentId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [chirping, setChirping] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const announcements = announcementsOf(live.moments, live.participants);
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

  // Anything on the page a reply can point at: people's lines and Chirp Bot's.
  const quotable = (id: string) => {
    const m = live.moments.find((x) => x.id === id);
    if (m) {
      return {
        name: person(m.by)?.name ?? "Somebody",
        text: m.kind === "photo" ? "📷 a photo" : m.text,
      };
    }
    const b = (chirp?.lines ?? []).find((x) => x.id === id);
    return b ? { name: CHIRP_BOT.name, text: b.text } : undefined;
  };
  const reply = (id: string) => {
    setReplyTo(id);
    requestAnimationFrame(() => input.current?.focus());
  };
  const replying = replyTo ? quotable(replyTo) : undefined;

  return (
    <div className="flex flex-col gap-5">
      {live.me && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSay(draft, replyTo ?? undefined);
            setDraft("");
            setReplyTo(null);
          }}
        >
          {replying && (
            <div
              data-replying
              className="flex items-center gap-2 rounded-2xl bg-white/[0.06] px-3.5 py-2 text-[13.5px] text-white/75 ring-1 ring-white/10"
            >
              <CornerDownRight className="h-4 w-4 shrink-0 text-[#ffd84d]" />
              <span className="min-w-0 flex-1 truncate">
                Replying to{" "}
                <strong className="text-white">{replying.name}</strong>
                {replying.text ? ` — ${quoteOf(replying.text, 60)}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Stop replying"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              placeholder={
                replying
                  ? `Reply to ${replying.name}`
                  : "Say something to the group"
              }
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
          </div>
        </form>
      )}

      {live.me && isHost && announceOn && onAnnounce && (
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAnnounce}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#ffd84d]/15 px-4 text-[15px] font-bold text-[#ffd84d] ring-1 ring-[#ffd84d]/50 transition active:scale-95"
          >
            <Megaphone className="h-4 w-4" />
            Announce a change
          </button>
          <span className="text-[13px] text-white/50">
            Venue, meeting spot, time. Stays up until everyone&apos;s seen it.
          </span>
        </div>
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
        {timeline.map((item) => {
          if (item.bot)
            return (
              <BotLineView
                key={item.line.id}
                line={item.line}
                me={live.me}
                people={live.participants}
                onReact={onReact}
                onReply={live.me ? () => reply(item.line.id) : undefined}
              />
            );
          const a: Announcement | undefined =
            item.moment.kind === "announce"
              ? announcements.find((x) => x.id === item.moment.id)
              : undefined;
          if (a)
            return (
              <AnnouncementCard
                key={a.id}
                a={a}
                me={live.me}
                people={live.participants}
                isHost={isHost}
                onAck={(id) => onReact(id, "✅")}
                onRetract={onRetract}
              />
            );
          return (
            <Line
              key={item.moment.id}
              moment={item.moment}
              who={person(item.moment.by)}
              me={live.me}
              people={live.participants}
              onReact={onReact}
              onReply={live.me ? () => reply(item.moment.id) : undefined}
              quoted={
                item.moment.replyTo ? quotable(item.moment.replyTo) : undefined
              }
            />
          );
        })}
      </ul>

      {isHost && chirp?.available && onSetChirp && (
        <div className="flex flex-col gap-2 text-[13.5px] text-white/55">
          <p className="flex flex-wrap items-center gap-2">
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
          {chirp.on && (
            <div
              role="group"
              aria-label="How much Chirp Bot talks"
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="mr-1">How much it talks:</span>
              {CHIRP_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={(chirp.level ?? "normal") === level}
                  onClick={() => onSetChirp(true, level)}
                  title={LEVEL_HINT[level]}
                  className={`min-h-10 rounded-full px-3.5 font-semibold capitalize transition ${
                    (chirp.level ?? "normal") === level
                      ? "bg-[#ffd84d] text-[#0b1220]"
                      : "text-white/80 ring-1 ring-white/20"
                  }`}
                >
                  {level}
                </button>
              ))}
              <span className="basis-full text-[12.5px] text-white/45">
                {LEVEL_HINT[chirp.level ?? "normal"]}
              </span>
            </div>
          )}
        </div>
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
  onReply,
}: {
  line: BotLine;
  me: Participant | null;
  people: readonly Participant[];
  onReact: (momentId: string, emoji: string) => void;
  onReply?: () => void;
}) {
  return (
    <li className={`${styles.pop} flex gap-3`} data-chirp-bot={line.kind}>
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
            <Stamp at={line.at} />
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
          onReply={onReply}
        />
      </div>
    </li>
  );
}

/** The time a line was said, small, in the phone's own zone. */
function Stamp({ at }: { at: string }) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <time
      dateTime={at}
      className="ml-auto text-[11.5px] font-medium text-white/40 tabular-nums"
    >
      {d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
    </time>
  );
}

function Line({
  moment,
  who,
  me,
  people,
  onReact,
  onReply,
  quoted,
}: {
  moment: Moment;
  who?: Participant;
  me: Participant | null;
  people: readonly Participant[];
  onReact: (momentId: string, emoji: string) => void;
  onReply?: () => void;
  /** The line this one answers, when it is still on the page. */
  quoted?: { name: string; text?: string };
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
              <Stamp at={moment.at} />
            </p>
          )}
          {quoted && (
            <p
              data-quote
              className="mt-1 mb-1.5 flex items-start gap-1.5 rounded-xl border-l-2 border-[#ffd84d]/70 bg-white/[0.05] px-2.5 py-1.5 text-[13.5px] leading-snug text-white/70"
            >
              <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffd84d]/80" />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <strong className="text-white/85">{quoted.name}</strong>
                {quoted.text ? ` ${quoteOf(quoted.text)}` : ""}
              </span>
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
          onReply={onReply}
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
  onReply,
}: {
  momentId: string;
  reactions: Readonly<Record<string, readonly string[]>>;
  me: Participant | null;
  people: readonly Participant[];
  onReact: (momentId: string, emoji: string) => void;
  onReply?: () => void;
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
        {me && onReply && (
          <button
            type="button"
            onClick={onReply}
            aria-label="Reply"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 ring-1 ring-white/15 transition hover:text-white"
          >
            <Reply className="h-4 w-4" />
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

const LEVEL_HINT: Readonly<Record<ChirpLevel, string>> = {
  quiet:
    "Only the big moments: welcomes, picks sealed, missions pulled off, Cup lead changes, the final verdict.",
  normal: "The moments, plus a heckle now and then and a pregame question.",
  rowdy: "Heckles every few minutes. You asked for this.",
};
