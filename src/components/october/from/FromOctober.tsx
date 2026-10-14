"use client";

import Link from "next/link";
import { usePassage } from "@/components/october/passage/usePassage";
import type { Passage } from "@/domain/october/passage";
import { useThreshold } from "@/components/october/room/RoomThreshold";
import { doorLine, type Threshold } from "@/domain/october/threshold";

/**
 * **From October** — the way into the strange part.
 *
 * October has two faces and, until now, only one of them had a door. The rooms
 * under `/labs/october` were reachable by typing a URL; the product was the
 * only October anyone could find. This is a door, and it is deliberately not a
 * menu: two places, each described by one line that sounds like a person said
 * it, and a little of what you have already carried between them.
 *
 * Two shapes of one thing. `band` is the strip on Discover — quiet enough to
 * leave Discover being Discover, plain enough to be found. `doors` is the page
 * it opens.
 */

export interface Door {
  readonly href: string;
  readonly id: "room" | "store";
  readonly name: string;
  /** What it says before you have been. */
  readonly line: string;
  /** What it says once you have. Only ever true things. */
  readonly after: (p: Passage) => string | null;
}

export const DOORS: readonly Door[] = [
  {
    href: "/october/room",
    id: "room",
    name: "The Room",
    line: "Somebody left the light on under the door.",
    after: (p) =>
      p.played
        ? "You watched the tape. The door is still open."
        : p.escaped
          ? "You got out. It's still there."
          : null,
  },
  {
    href: "/october/store",
    id: "store",
    name: "The Video Store",
    line: "Open late. Nobody at the counter.",
    after: (p) =>
      p.escaped
        ? "It's different now. Try the obvious tape."
        : p.tape
          ? "You took something off the bottom shelf."
          : null,
  },
];

/**
 * Which door's line to say, given what has been carried — and, for the Room,
 * how many nights are left before it opens. A door that is not open yet says
 * so in the Room's own words, and nothing else about it.
 */
export function lineFor(
  door: Door,
  passage: Passage,
  threshold?: Threshold | null,
): string {
  if (door.id === "room" && threshold) {
    const shut = doorLine(threshold);
    if (shut) return shut;
  }
  return door.after(passage) ?? door.line;
}

/** Is any of the Room's light showing under its door yet? */
function roomLit(passage: Passage, threshold: Threshold | null): boolean {
  if (threshold && threshold.kind !== "open") {
    return threshold.kind === "light" || threshold.kind === "counting";
  }
  return !!passage.escaped;
}

/** A door seen from a dark room: a frame, and the light underneath it. */
function DoorGlyph({ lit }: { readonly lit: boolean }) {
  return (
    <span
      aria-hidden
      className="relative block h-12 w-8 shrink-0 rounded-t-[3px] border border-[#e9e6da]/15 bg-[#1a1519]"
    >
      <span
        className={`absolute inset-x-0.5 bottom-0 h-[2px] rounded-full bg-[#ffcf8a] transition-opacity ${
          lit ? "opacity-90" : "opacity-40"
        }`}
        style={{ boxShadow: "0 0 8px 1px rgba(255,207,138,0.55)" }}
      />
      <span className="absolute top-[52%] right-1 h-[3px] w-[3px] rounded-full bg-[#c9b58c]/50" />
    </span>
  );
}

/** The strip on Discover. */
export function FromOctoberBand() {
  const passage = usePassage();
  const threshold = useThreshold();
  const shut = threshold ? doorLine(threshold) : null;
  return (
    <div className="mx-auto max-w-4xl px-5 pt-5 sm:px-6">
      <Link
        href="/october/from"
        data-testid="from-october"
        className="group flex items-center gap-4 rounded-xl border border-[#e9e6da]/10 bg-[#120f12] px-4 py-3 transition-colors hover:border-[#d09a4e]/50 hover:bg-[#161216]"
      >
        <DoorGlyph lit={roomLit(passage, threshold)} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
            From October
          </span>
          <span className="font-heading mt-0.5 block text-base leading-snug text-[#f3efe4]">
            {shut
              ? `A door that says “${shut}” A video store that's still open.`
              : passage.escaped
                ? "The door is open. There's a shop behind it."
                : "A room with a locked door. A video store that's still open."}
          </span>
        </span>
        <span
          aria-hidden
          className="text-[#e9e6da]/40 transition-transform group-hover:translate-x-0.5 group-hover:text-[#d09a4e]"
        >
          →
        </span>
      </Link>
    </div>
  );
}

/** The page it opens. */
export function FromOctoberDoors() {
  const passage = usePassage();
  const threshold = useThreshold();
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2">
      {DOORS.map((door) => (
        <li key={door.id}>
          <Link
            href={door.href}
            data-testid={`door-${door.id}`}
            className="group flex h-full flex-col gap-6 rounded-2xl border border-[#e9e6da]/10 bg-[#120f12] p-6 transition-colors hover:border-[#d09a4e]/50 hover:bg-[#161216]"
          >
            <DoorGlyph
              lit={
                door.id === "room"
                  ? roomLit(passage, threshold)
                  : !!passage.tape
              }
            />
            <span>
              <span className="font-heading block text-2xl text-[#f3efe4]">
                {door.name}
              </span>
              <span
                data-testid={`door-${door.id}-line`}
                className="mt-2 block text-base leading-relaxed text-[#e9e6da]/60"
              >
                {lineFor(door, passage, threshold)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
