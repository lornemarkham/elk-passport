"use client";

import { useState, useSyncExternalStore } from "react";
import { ExternalLink, Megaphone, X } from "lucide-react";
import type { Participant } from "@/experience-lab/core/types";
import {
  ACK,
  ANNOUNCE_EMOJI,
  ANNOUNCE_LABEL,
  ANNOUNCE_TAGS,
  ackLine,
  hrefSchema,
  type AnnounceTag,
  type Announcement,
} from "@/domain/hockey/announce";
import styles from "./hockey.module.css";

/**
 * **The host's word, in front of everything.**
 *
 * An announcement sits above the tabs on every room, and above "put your
 * phone away" in a period, until this person taps **Got it!** or puts it
 * away on this phone. The host sees who has and hasn't, and can take it
 * down. In the chat the same announcement is a card in the conversation, so
 * it is also there later, in order, with everybody's reactions.
 */

const EVENT = "hockey:announce-dismissed";
const subscribe = (fn: () => void) => {
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(EVENT, fn);
  };
};

/** Announcements put away on this device only; a new phone sees them again, which is right. */
export function useDismissed(
  slug: string,
): [ReadonlySet<string>, (id: string) => void] {
  const key = `hockey:${slug}:announcements-dismissed`;
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? "",
    () => "",
  );
  const set = new Set(raw.split(",").filter(Boolean));
  const dismiss = (id: string) => {
    const next = new Set(set);
    next.add(id);
    window.localStorage.setItem(key, [...next].slice(-50).join(","));
    window.dispatchEvent(new Event(EVENT));
  };
  return [set, dismiss];
}

export function AnnouncementBanner({
  pending,
  me,
  people,
  onAck,
  onDismiss,
}: {
  pending: readonly Announcement[];
  me: Participant | null;
  people: readonly Participant[];
  onAck: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const top = pending[0];
  if (!top || !me) return null;
  const who = people.find((p) => p.id === top.by);
  return (
    <section
      aria-label="Announcement from the host"
      role="status"
      aria-live="polite"
      data-announcement={top.tag}
      className={`${styles.pop} relative overflow-hidden rounded-[22px] bg-[#ffd84d] text-[#0b1220] shadow-[0_18px_50px_-20px_rgba(255,216,77,0.7)] ring-2 ring-[#0b1220]/10`}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b1220] text-[18px]"
        >
          {ANNOUNCE_EMOJI[top.tag]}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${styles.wide} text-[22px] leading-none`}>
            {top.headline}
          </p>
          <p className="mt-1.5 text-[16px] leading-snug font-medium [overflow-wrap:anywhere]">
            {top.text}
          </p>
          <p className="mt-1 text-[12.5px] text-[#0b1220]/65">
            {who?.name ?? "The host"} · {ANNOUNCE_LABEL[top.tag]}
            {pending.length > 1 && ` · ${pending.length - 1} more after this`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(top.id)}
          aria-label="Put this away on this phone"
          className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0b1220]/60 hover:bg-[#0b1220]/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 border-t border-[#0b1220]/15 px-4 py-2.5">
        {top.href && (
          <a
            href={top.href}
            target={top.href.startsWith("/") ? undefined : "_blank"}
            rel="noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#0b1220]/10 px-4 text-[15px] font-bold"
          >
            View location
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onAck(top.id)}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#0b1220] px-4 text-[15px] font-bold text-white transition active:scale-[0.98]"
        >
          Got it!
        </button>
      </div>
    </section>
  );
}

/** The same announcement, in the conversation — everybody's, with its receipts. */
export function AnnouncementCard({
  a,
  me,
  people,
  isHost,
  onAck,
  onRetract,
}: {
  a: Announcement;
  me: Participant | null;
  people: readonly Participant[];
  isHost: boolean;
  onAck: (id: string) => void;
  onRetract?: (id: string) => void;
}) {
  const who = people.find((p) => p.id === a.by);
  const mine = me?.id === a.by;
  const acked = Boolean(me && a.ackedBy.includes(me.id));
  const [sure, setSure] = useState(false);
  return (
    <li
      data-announcement-card={a.tag}
      className="overflow-hidden rounded-[20px] ring-2 ring-[#ffd84d]/70"
    >
      <div className="flex items-start gap-3 bg-[#ffd84d]/[0.12] px-4 pt-3 pb-2.5">
        <span aria-hidden className="text-[22px] leading-none">
          {ANNOUNCE_EMOJI[a.tag]}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`${styles.wide} text-[19px] leading-none text-[#ffd84d]`}
          >
            {a.headline}
          </p>
          <p className="mt-1.5 text-[16px] leading-snug [overflow-wrap:anywhere] text-white">
            {a.text}
          </p>
          <p className="mt-1 text-[12.5px] text-white/55">
            {who?.name ?? "The host"} · {ANNOUNCE_LABEL[a.tag]} ·{" "}
            {new Date(a.at).toLocaleTimeString("en-CA", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 bg-white/[0.05] px-4 py-2.5 text-[13.5px]">
        {a.href && (
          <a
            href={a.href}
            target={a.href.startsWith("/") ? undefined : "_blank"}
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 font-bold text-white ring-1 ring-white/15"
          >
            View location
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {me && !mine && (
          <button
            type="button"
            onClick={() => !acked && onAck(a.id)}
            aria-pressed={acked}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 font-bold transition ${
              acked
                ? "bg-[#0f7a3d]/40 text-white ring-1 ring-[#0f7a3d]"
                : "bg-[#ffd84d] text-[#0b1220]"
            }`}
          >
            {acked ? `${ACK} You got it` : "Got it!"}
          </button>
        )}
        <span className="text-white/60">{ackLine(a, people)}</span>
        {isHost && mine && onRetract && (
          <span className="ml-auto">
            {sure ? (
              <span className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onRetract(a.id)}
                  className="min-h-10 rounded-full bg-[#ff7a7a] px-3 font-bold text-[#2a0a0a]"
                >
                  Yes, take it down
                </button>
                <button
                  type="button"
                  onClick={() => setSure(false)}
                  className="min-h-10 rounded-full px-3 text-white/70 ring-1 ring-white/20"
                >
                  Keep it
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSure(true)}
                className="min-h-10 rounded-full px-3 text-white/70 ring-1 ring-white/20"
              >
                Take it down
              </button>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * **The host writes one.** What kind of change, the words, and — optionally
 * — somewhere to tap: a place name becomes a map search (a search, not a
 * claim about the place), or paste any https link.
 */
export function AnnounceSheet({
  city,
  onSend,
  onClose,
}: {
  city?: string;
  onSend: (input: {
    tag: AnnounceTag;
    text: string;
    href?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onClose: () => void;
}) {
  const [tag, setTag] = useState<AnnounceTag>("venue");
  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const href = link.trim()
    ? link.trim()
    : place.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          city ? `${place.trim()} ${city}` : place.trim(),
        )}`
      : "";

  async function send() {
    setProblem(null);
    if (!text.trim()) {
      setProblem("Say what's changed.");
      return;
    }
    if (href && !hrefSchema.safeParse(href).success) {
      setProblem("A link starts with https://");
      return;
    }
    setSending(true);
    const result = await onSend({
      tag,
      text: text.trim(),
      ...(href ? { href } : {}),
    });
    setSending(false);
    if (result.ok) onClose();
    else setProblem(result.error);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announce-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className={`${styles.sheet} max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#101826] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white sm:rounded-[28px]`}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="announce-title"
            className={`${styles.wide} flex items-center gap-2 text-[26px] leading-none`}
          >
            <Megaphone className="h-6 w-6 text-[#ffd84d]" />
            Tell everyone
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 ring-1 ring-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[14px] text-white/65">
          It stays in front of everyone — on every tab, even with phones away —
          until they tap Got it!
        </p>

        <fieldset className="mt-4">
          <legend className="mb-2 text-[13px] text-white/55">
            What kind of change
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {ANNOUNCE_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(t)}
                className={`flex min-h-12 items-center gap-2 rounded-2xl px-3.5 text-left text-[15px] font-semibold transition ${
                  tag === t
                    ? "bg-[#ffd84d] text-[#0b1220]"
                    : "bg-white/[0.07] text-white ring-1 ring-white/15"
                }`}
              >
                <span aria-hidden>{ANNOUNCE_EMOJI[t]}</span>
                {ANNOUNCE_LABEL[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-[13px] text-white/55">
          What&apos;s changed
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            placeholder={
              tag === "venue"
                ? "Shark Club is packed. We're going to Boston Pizza instead."
                : tag === "meeting"
                  ? "Meet at Gate 10 instead — the Georgia St side."
                  : tag === "time"
                    ? "Pushing dinner to 5:45. Table's not ready."
                    : "Bring ID — they're checking at the door."
            }
            className="mt-1.5 block w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-[16px] text-white focus:border-white/50 focus:outline-none"
          />
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block text-[13px] text-white/55">
            Place to show on a map (optional)
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={80}
              placeholder="Boston Pizza"
              className="mt-1.5 block w-full rounded-full border border-white/20 bg-black/20 px-4 py-2.5 text-[16px] text-white focus:border-white/50 focus:outline-none"
            />
          </label>
          <label className="block text-[13px] text-white/55">
            Or paste a link
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              maxLength={300}
              inputMode="url"
              placeholder="https://"
              className="mt-1.5 block w-full rounded-full border border-white/20 bg-black/20 px-4 py-2.5 text-[16px] text-white focus:border-white/50 focus:outline-none"
            />
          </label>
        </div>
        {href && (
          <p className="mt-1.5 truncate text-[12.5px] text-white/45">
            View location opens: {href}
          </p>
        )}
        {tag === "meeting" || tag === "venue" ? (
          <p className="mt-2 text-[12.5px] text-white/45">
            This tells people. To change where the plan says you&apos;re
            meeting, use Override the meeting point under Plan too.
          </p>
        ) : null}

        {problem && (
          <p role="alert" className="mt-3 text-[14px] text-[#ffb4b4]">
            {problem}
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          className="mt-4 min-h-12 w-full rounded-full bg-[#ffd84d] text-[16px] font-bold text-[#0b1220] disabled:opacity-50"
        >
          {sending ? "Sending…" : "Announce it"}
        </button>
      </form>
    </div>
  );
}
