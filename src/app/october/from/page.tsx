import type { Metadata } from "next";
import { FromOctoberDoors } from "@/components/october/from/FromOctober";

export const metadata: Metadata = { title: "From October" };

/**
 * `/october/from` — the doors.
 *
 * The product is what October knows about the world; this is what October
 * keeps for itself. Nothing here explains either place.
 */
export default function FromOctoberPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 pt-12 pb-24 sm:px-6">
      <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
        From October
      </p>
      <h1 className="font-heading mt-3 text-4xl leading-tight text-[#f3efe4] sm:text-5xl">
        Not everything I keep is on a list.
      </h1>
      <FromOctoberDoors />
      <p className="mt-12 text-sm text-[#e9e6da]/35">
        Both are best with the sound on, and the lights off.
      </p>
    </main>
  );
}
