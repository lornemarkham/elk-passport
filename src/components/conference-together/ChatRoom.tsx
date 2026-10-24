"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { primary, Problem } from "@/components/conference/ui";
import { MESSAGE_MAX, REACTIONS } from "@/domain/conference-chat/chat";
import type { RoomView } from "@/lib/conference-chat/service";
import { send, usePoll } from "./usePoll";

/**
 * **The group's conversation.** Hockey Night's chat, for a conference: the
 * newest at the bottom like any messenger, reactions as a tap, a thread per
 * plan, and new messages arriving every few seconds while the page is open.
 */
export function ChatRoom({
  conferenceId,
  initial,
  rooms,
}: {
  conferenceId: string;
  initial: RoomView;
  rooms: readonly { id: string | null; title: string }[];
}) {
  const roomParam = initial.room
    ? `?room=${encodeURIComponent(initial.room)}`
    : "";
  const api = `/api/conferences/${conferenceId}/chat`;
  const { data: room, refresh } = usePoll(
    `${api}${roomParam}`,
    (j) => j.room as RoomView,
    initial,
    4000,
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [reacting, setReacting] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = room.messages.length;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await send(api, { action: "say", body: text, planId: room.room });
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setText("");
    setProblem("");
    await refresh();
  };

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-40 *:max-w-[820px] sm:px-8">
      {rooms.length > 1 ? (
        <nav aria-label="Rooms" className="-mx-5 mt-4 overflow-x-auto px-5">
          <ul className="flex gap-2">
            {rooms.map((r) => {
              const here = r.id === room.room;
              return (
                <li key={r.id ?? "main"} className="shrink-0">
                  <Link
                    href={`/conferences/${conferenceId}/chat${r.id ? `?room=${r.id}` : ""}`}
                    aria-current={here ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 text-[14px] ${
                      here
                        ? "border-cf-ink bg-cf-ink font-bold text-white"
                        : "border-cf-line"
                    }`}
                  >
                    {r.id ? `💬 ${r.title}` : "Everyone"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {room.title ? (
        <p className="text-cf-mist mt-4 text-[14px]">
          The thread for <strong>{room.title}</strong>. Only people who can see
          the plan can read it.
        </p>
      ) : null}

      <ol
        className="mt-4 flex flex-col gap-3"
        data-testid="messages"
        aria-live="polite"
      >
        {room.messages.length === 0 ? (
          <li className="bg-cf-sand text-cf-slate rounded-2xl p-4 text-[15px]">
            Quiet so far. Ask the thing everyone&apos;s wondering: where&apos;s
            good for lunch?
          </li>
        ) : null}
        {room.messages.map((m) => (
          <li
            key={m.id}
            className={`flex flex-col ${m.by.you ? "items-end" : "items-start"}`}
            data-testid="message"
          >
            <span className="text-cf-mist px-1 text-[12px] font-semibold">
              {m.by.name} ·{" "}
              {new Date(m.at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <button
              type="button"
              onClick={() => setReacting(reacting === m.id ? null : m.id)}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-left text-[16px] whitespace-pre-wrap ${
                m.by.you ? "bg-cf-ink text-white" : "bg-cf-sand"
              }`}
              aria-label={`Message from ${m.by.name}: ${m.body}. Tap to react.`}
            >
              {m.body}
            </button>
            {m.reactions.length ? (
              <span className="mt-1 flex gap-1">
                {m.reactions.map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    aria-pressed={r.mine}
                    onClick={async () => {
                      await send(api, {
                        action: "react",
                        room: room.room,
                        messageId: m.id,
                        emoji: r.emoji,
                      });
                      await refresh();
                    }}
                    className={`min-h-8 rounded-full border px-2 text-[13px] ${
                      r.mine ? "border-cf-ink/60 bg-cf-sand" : "border-cf-line"
                    }`}
                  >
                    {r.emoji} {r.count}
                  </button>
                ))}
              </span>
            ) : null}
            {reacting === m.id ? (
              <span
                className="mt-1 flex flex-wrap items-center gap-1"
                role="group"
                aria-label="React"
              >
                {REACTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="bg-cf-sand h-11 w-11 rounded-full text-[20px]"
                    aria-label={`React ${e}`}
                    onClick={async () => {
                      setReacting(null);
                      await send(api, {
                        action: "react",
                        room: room.room,
                        messageId: m.id,
                        emoji: e,
                      });
                      await refresh();
                    }}
                  >
                    {e}
                  </button>
                ))}
                {m.canDelete ? (
                  <button
                    type="button"
                    className="min-h-11 px-2 text-[13px] text-[#b42318] underline"
                    onClick={async () => {
                      setReacting(null);
                      await send(api, {
                        action: "unsay",
                        room: room.room,
                        messageId: m.id,
                      });
                      await refresh();
                    }}
                  >
                    {m.by.you ? "Delete" : "Take down"}
                  </button>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <div ref={end} />

      <div className="border-cf-line fixed inset-x-0 bottom-16 z-20 !max-w-none border-t bg-white/95 backdrop-blur md:bottom-0 md:pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-[1180px] px-5 py-3 *:max-w-[820px] sm:px-8">
          {room.you.canPost ? (
            <form onSubmit={post} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="say">
                Message
              </label>
              <textarea
                id="say"
                value={text}
                maxLength={MESSAGE_MAX}
                rows={1}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void post(e);
                  }
                }}
                placeholder={
                  room.title
                    ? `About ${room.title}…`
                    : "Say something to everyone…"
                }
                className="border-cf-line focus:border-cf-ink/50 max-h-32 min-h-11 flex-1 resize-none rounded-xl border px-3 py-2.5 text-[16px] outline-none"
              />
              <button className={primary} disabled={busy || !text.trim()}>
                Send
              </button>
            </form>
          ) : (
            <p className="text-cf-slate text-[14px]">
              You&apos;re reading quietly. To post, choose a name and to be seen
              on the{" "}
              <Link
                href={`/conferences/${conferenceId}#you`}
                className="underline"
              >
                conference page
              </Link>
              .
            </p>
          )}
          <Problem>{problem}</Problem>
        </div>
      </div>
    </div>
  );
}
