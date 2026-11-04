"use client";

import { useEffect, useRef, useState } from "react";
import { personName } from "@/domain/snow/day";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, btn, field } from "./kit";

/** The crew's group chat. Only a day shared between phones has one. */
export function ChatCard({ day, me, act }: TabProps) {
  const [text, setText] = useState("");
  const end = useRef<HTMLLIElement>(null);
  const last = day.chat.at(-1)?.id;
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [last]);

  return (
    <Card className="space-y-3" data-testid="chat">
      <h2 className="text-xl font-extrabold">Crew chat</h2>
      <ul
        className="max-h-72 space-y-2 overflow-y-auto"
        aria-live="polite"
        aria-label="Messages"
        data-testid="chat-messages"
      >
        {day.chat.length === 0 && (
          <li className="text-sm text-[var(--sn-frost)]">
            Nothing yet. Say hi to the crew.
          </li>
        )}
        {day.chat.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border border-[var(--sn-line)] p-2.5 text-sm ${m.by === me.id ? "ml-8" : "mr-8"}`}
          >
            <p className="text-xs font-semibold text-[var(--sn-frost)]">
              {m.by === me.id ? "You" : personName(day, m.by)}
            </p>
            <p>{m.text}</p>
          </li>
        ))}
        <li ref={end} aria-hidden="true" />
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (act({ type: "say", id: newId(), by: me.id, text })) setText("");
        }}
      >
        <input
          className={`${field} flex-1`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the crew"
          aria-label="Message the crew"
          maxLength={200}
        />
        <button className={btn} type="submit">
          Send
        </button>
      </form>
    </Card>
  );
}
