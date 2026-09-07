"use client";

import { useSyncExternalStore } from "react";
import { History } from "lucide-react";
import { receiptsFrom } from "../core/lineage";
import { experienceStore } from "../core/store";
import type { ExperienceDefinition } from "../core/types";

/**
 * **What the last one is still holding over everybody.**
 *
 * The half of "run it back" that makes it a tradition rather than a repeat:
 * the second edition opens carrying the first one's receipts, read live from
 * the previous edition's own stored state. Nothing is copied across and
 * nothing is authored — if you go back and change what happened last time,
 * this changes too.
 *
 * Points are deliberately not inherited. A defending champion is funny; a head
 * start is not.
 */
export function InheritedMemory({
  previous,
  now,
}: {
  previous: ExperienceDefinition;
  now: Date;
}) {
  const store = experienceStore(previous.slug);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  if (!snapshot.hydrated) return null;

  const lineage = receiptsFrom(previous, snapshot.state, now);
  if (!lineage) return null;

  const champion = previous.participants.find(
    (p) => p.id === lineage.defendingChampionId,
  );

  return (
    <section className="mx-auto max-w-2xl px-5 pt-2">
      <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
        <p className="flex items-center gap-2 text-[12px] tracking-wide text-white/40 uppercase">
          <History className="h-3.5 w-3.5" />
          Last time
        </p>
        {champion && (
          <p className="mt-2 text-[15px] font-semibold text-white">
            {champion.emoji} {champion.name} is defending.
          </p>
        )}
        {(lineage.receipts ?? []).length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-white/15 pl-3">
            {(lineage.receipts ?? []).map((line) => (
              <li
                key={line}
                className="text-[13.5px] leading-snug text-white/60"
              >
                {line}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11.5px] text-white/30">
          Carried over from the last one. Points were not.
        </p>
      </div>
    </section>
  );
}
