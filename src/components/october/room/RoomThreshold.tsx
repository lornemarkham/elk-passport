"use client";

import { useSyncExternalStore } from "react";
import { localDay } from "@/domain/experience/eventTime";
import { usePassage } from "@/components/october/passage/usePassage";
import { thresholdOn, type Threshold } from "@/domain/october/threshold";
import { SecretRoom } from "./SecretRoom";
import { ShutDoor } from "./ShutDoor";

const subscribeNothing = () => () => {};

/** The visitor's local calendar day. `null` on the server: the date is theirs. */
export function useToday(): string | null {
  return useSyncExternalStore(
    subscribeNothing,
    () => localDay(new Date()),
    () => null,
  );
}

/** The door's state for this person, today. `null` until the browser knows. */
export function useThreshold(): Threshold | null {
  const today = useToday();
  const passage = usePassage();
  return today === null ? null : thresholdOn(today, passage);
}

/**
 * Either the room or the shut door in front of it. Until the browser has said
 * what day it is and what this person carries, it is only dark: neither the
 * room nor the door is painted from a guess.
 */
export function RoomThreshold() {
  const threshold = useThreshold();
  if (!threshold) {
    return <div className="fixed inset-0 z-[60] bg-[#050407]" aria-hidden />;
  }
  return threshold.kind === "open" ? (
    <SecretRoom />
  ) : (
    <ShutDoor threshold={threshold} />
  );
}
