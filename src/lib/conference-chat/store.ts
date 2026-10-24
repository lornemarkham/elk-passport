import type {
  Message,
  MessageReaction,
  Reaction,
} from "@/domain/conference-chat/chat";
import { ROOM_SIZE } from "@/domain/conference-chat/chat";
import { conferenceSetup } from "@/lib/conference/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseChat } from "./supabaseStore";

/**
 * **Where the chat lives**, keyed on `(conferenceId, memberId)`. Memory for
 * development and tests; `supabaseChat` under row level security otherwise.
 * `room` is `null` for the conference's room, or a plan id for its thread.
 */
export interface ChatStore {
  room(conferenceId: string, room: string | null): Promise<Message[]>;
  say(message: Message): Promise<void>;
  unsay(conferenceId: string, messageId: string): Promise<void>;
  reactions(
    conferenceId: string,
    messageIds: readonly string[],
  ): Promise<MessageReaction[]>;
  react(conferenceId: string, r: MessageReaction, on: boolean): Promise<void>;
  /** The newest message in each room, for "what's new" on the home page. */
  latest(conferenceId: string, limit: number): Promise<Message[]>;
  forgetMember(conferenceId: string, memberId: string): Promise<void>;
  forgetConference(conferenceId: string): Promise<void>;
}

export function memoryChat(): ChatStore {
  const messages = new Map<string, Message[]>();
  const reacts = new Map<string, MessageReaction[]>();
  const of = <T>(m: Map<string, T[]>, c: string) => m.get(c) ?? [];
  return {
    async room(c, room) {
      return of(messages, c)
        .filter((m) => m.planId === room)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, ROOM_SIZE);
    },
    async say(m) {
      messages.set(m.conferenceId, [...of(messages, m.conferenceId), m]);
    },
    async unsay(c, id) {
      messages.set(
        c,
        of(messages, c).filter((m) => m.id !== id),
      );
      reacts.set(
        c,
        of(reacts, c).filter((r) => r.messageId !== id),
      );
    },
    async reactions(c, ids) {
      return of(reacts, c).filter((r) => ids.includes(r.messageId));
    },
    async react(c, r, on) {
      const same = (x: MessageReaction) =>
        x.messageId === r.messageId &&
        x.memberId === r.memberId &&
        x.emoji === (r.emoji as Reaction);
      const rest = of(reacts, c).filter((x) => !same(x));
      reacts.set(c, on ? [...rest, r] : rest);
    },
    async latest(c, limit) {
      return of(messages, c)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, limit);
    },
    async forgetMember(c, memberId) {
      const gone = new Set(
        of(messages, c)
          .filter((m) => m.memberId === memberId)
          .map((m) => m.id),
      );
      messages.set(
        c,
        of(messages, c).filter((m) => !gone.has(m.id)),
      );
      reacts.set(
        c,
        of(reacts, c).filter(
          (r) => r.memberId !== memberId && !gone.has(r.messageId),
        ),
      );
    },
    async forgetConference(c) {
      messages.delete(c);
      reacts.delete(c);
    },
  };
}

const g = globalThis as unknown as { __chatStore?: ChatStore };

export const chatStore = (): ChatStore => {
  const setup = conferenceSetup();
  if (setup.open && setup.config.store === "supabase")
    return supabaseChat(createSupabaseServerClient);
  return (g.__chatStore ??= memoryChat());
};
