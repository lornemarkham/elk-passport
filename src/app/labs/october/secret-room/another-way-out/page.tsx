import type { Metadata } from "next";
import { AnotherWayOut } from "./AnotherWayOut";

export const metadata: Metadata = {
  title: "Another way out",
  robots: { index: false, follow: false },
};

/**
 * `/labs/october/secret-room/another-way-out`
 *
 * One of the Secret Room's exits, built to find out whether it is fun. The
 * route names the scene and then the exit, because the interesting discovery
 * is that a room can have *many* ways out — trivia, drawing, memory, a little
 * arcade game, October's choice — and those would be siblings of this, not
 * revisions of it.
 *
 * No explanation before the room. You start inside it.
 */
export default function Page() {
  return <AnotherWayOut />;
}
