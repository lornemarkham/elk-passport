"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * **Two devices, one temporary night.**
 *
 * The smallest mechanism the stack already has: a Supabase Realtime
 * *broadcast* channel. No table, no row, no migration, no account. Two
 * browsers join `witching-hour:{code}` and pass small messages; when the last
 * one leaves, nothing remains anywhere. That is exactly the lifetime a paired
 * séance should have.
 *
 * The desktop is the director and the phone is a prop. Cues flow down; what the
 * phone *notices* flows back up, and that is the whole point — the phone
 * reporting "they picked me up" is what lets the desktop change the world
 * while nobody is looking at it.
 *
 * `code` is six characters from an alphabet with no ambiguous glyphs, because a
 * person will occasionally type it.
 */
export type Cue =
  | { type: "phone-joined" }
  | { type: "face-down" }
  | { type: "wake"; line: string }
  | { type: "phone-face-down" }
  | { type: "phone-picked-up" }
  | { type: "release" };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export interface Pairing {
  send: (cue: Cue) => void;
  close: () => void;
}

export function joinPairing(code: string, onCue: (cue: Cue) => void): Pairing {
  const channel: RealtimeChannel = supabaseBrowser()
    .channel(`witching-hour:${code}`, {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "cue" }, ({ payload }) => onCue(payload as Cue))
    .subscribe();

  return {
    send: (cue) => {
      void channel.send({ type: "broadcast", event: "cue", payload: cue });
    },
    close: () => {
      void supabaseBrowser().removeChannel(channel);
    },
  };
}
