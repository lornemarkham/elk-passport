"use client";

import { useEffect, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
import type { Participant } from "@/experience-lab/core/types";
import { relativeTime } from "@/experience-lab/core/phase";
import type { DramaItem } from "@/domain/hockey/cup";
import { CHIRP_BOT, type BotLine } from "@/domain/hockey/chirp";
import { FanAvatar } from "../FanTag";
import styles from "../hockey.module.css";

/** Chirp Bot's lines that belong in PLAY's story, not just the chat's. */
const PLAY_KINDS = new Set([
  "chal",
  "took",
  "oracle",
  "ruled",
  "worst",
  "welcome",
  "lead",
  "final",
  "mission",
]);

/**
 * **The latest drama.** What the others did since you last looked —
 * challenges thrown and taken, verdicts, prophecies, reactions to teams,
 * missions pulled off, and what Chirp Bot said about it — with what's new
 * marked. Every item is a row somebody wrote; nothing here is invented.
 */
export function Drama({
  items,
  bot,
  people,
  slug,
  now,
  onOpenChat,
  max = 14,
}: {
  /** During the game the page is a glance: fewer items. */
  max?: number;
  items: readonly DramaItem[];
  bot: readonly BotLine[];
  people: readonly Participant[];
  slug: string;
  now: Date;
  onOpenChat?: () => void;
}) {
  const seenKey = `hockey:play-seen:${slug}`;
  // When this person last looked, read once per visit (it is only written
  // when they leave, so it holds still while they're here).
  const seen = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return window.localStorage.getItem(seenKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  useEffect(() => {
    // What's new is new for this visit; the next visit starts from now.
    return () => {
      try {
        window.localStorage.setItem(seenKey, new Date().toISOString());
      } catch {
        // private mode: everything is new every time, which is fine
      }
    };
  }, [seenKey]);

  const lines = bot
    .filter((l) => PLAY_KINDS.has(l.kind))
    .map((l) => ({
      id: `bot:${l.id}`,
      at: l.at,
      emoji: CHIRP_BOT.emoji,
      text: l.text,
      bot: true as const,
    }));
  const all = [...items.map((i) => ({ ...i, bot: false as const })), ...lines]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, max);
  const fresh = seen ? all.filter((i) => i.at > seen).length : 0;

  return (
    <section aria-labelledby="drama-title">
      <div className="flex items-end justify-between gap-3">
        <h2
          id="drama-title"
          className={`${styles.display} text-[34px] leading-[0.9] text-white`}
        >
          The latest drama
        </h2>
        {fresh > 0 && (
          <span className="mb-1 rounded-full bg-[#ffd84d] px-2.5 py-0.5 text-[12.5px] font-extrabold text-[#0b1220]">
            {fresh} new since you looked
          </span>
        )}
      </div>
      {all.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white/[0.05] px-4 py-4 text-[15px] text-white/70">
          Nothing yet. Somebody has to start something — and it may as well be
          you.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {all.map((item) => {
            const by =
              !item.bot && item.by
                ? people.find((p) => p.id === item.by)
                : undefined;
            const isNew = seen !== null && item.at > seen;
            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${item.bot ? "bg-[#ffd84d]/[0.08] ring-1 ring-[#ffd84d]/25" : "bg-white/[0.05]"}`}
              >
                {by ? (
                  <FanAvatar person={by} size={34} />
                ) : (
                  <span
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#0b1220] text-[18px] ring-1 ring-white/15"
                    aria-hidden
                  >
                    {item.emoji}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {item.bot && (
                    <p className="text-[11.5px] font-extrabold tracking-[0.14em] text-[#ffd84d] uppercase">
                      {CHIRP_BOT.name}
                    </p>
                  )}
                  <p className="text-[15px] leading-snug text-white">
                    {!item.bot && <span aria-hidden>{item.emoji} </span>}
                    {item.text}
                    {!item.bot && "points" in item && item.points ? (
                      <span className="ml-1.5 rounded-full bg-[#ffd84d] px-1.5 text-[12px] font-extrabold text-[#0b1220]">
                        +{item.points}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/50">
                    {relativeTime(new Date(item.at), now)}
                    {isNew && (
                      <span className="ml-2 font-bold text-[#ffd84d]">NEW</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {onOpenChat && (
        <button
          type="button"
          onClick={onOpenChat}
          className="mt-3 min-h-11 rounded-full px-4 text-[14px] font-bold text-white ring-1 ring-white/20"
        >
          Say something in the chat →
        </button>
      )}
    </section>
  );
}
