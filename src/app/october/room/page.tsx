import type { Metadata } from "next";
import { SecretRoom } from "@/components/october/room/SecretRoom";

export const metadata: Metadata = { title: "The Room — October" };

/**
 * `/october/room` — the Secret Room.
 *
 * A real puzzle with a real answer, built on what `Another Way Out` found out
 * about the room (October is mild, the door is lit from the other side, and a
 * real exit was always in there). That prototype is untouched at
 * `/october/secret-room/another-way-out`.
 *
 * No explanation before the room. You start inside it.
 */
export default function Page() {
  return <SecretRoom />;
}
