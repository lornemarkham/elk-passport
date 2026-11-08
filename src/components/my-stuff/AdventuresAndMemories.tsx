"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { livedHere } from "@/lib/adventures/lived";
import { DO_IT_AGAIN, NO_MEMORIES } from "@/lib/voice";

export interface AdventureEntry {
  readonly id: string;
  readonly title: string;
  /** Its dates are over (`adventureStatus` → done). */
  readonly over: boolean;
  /** The card, drawn on the server. */
  readonly card: React.ReactNode;
}

/**
 * **Adventures, then Memories** — My Stuff's second half (owner brief,
 * 2026-11-08, P3: _"ADVENTURES — planned days, weekends and trips. MEMORIES —
 * completed adventures and their memories."_).
 *
 * An adventure is a memory once its dates are over, or once the day has been
 * finished on this phone (`lived.ts`) — which is why the split is made here,
 * in the browser, where that mark lives. Before the phone has been read the
 * dates decide, so nothing jumps for most people.
 */
export function AdventuresAndMemories({
  entries,
  signedIn,
}: {
  readonly entries: readonly AdventureEntry[];
  readonly signedIn: boolean;
}) {
  const [lived, setLived] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this device, after hydration
    setLived(livedHere());
  }, []);

  const isMemory = (e: AdventureEntry) => e.over || lived.has(e.id);
  const planned = entries.filter((e) => !isMemory(e));
  const memories = entries.filter(isMemory);

  return (
    <>
      <section
        id="adventures"
        aria-labelledby="adventures-heading"
        data-testid="my-stuff-adventures"
        className="mt-16 scroll-mt-24"
      >
        <SectionTitle id="adventures-heading" count={planned.length}>
          Adventures
        </SectionTitle>
        <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
          Days, weekends and trips you&apos;re planning.
        </p>
        {planned.length > 0 ? (
          <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {planned.map((e) => (
              <li key={e.id}>{e.card}</li>
            ))}
          </ul>
        ) : (
          <Empty>
            {signedIn
              ? "Nothing planned yet. Pick a few ideas and make a day of it."
              : "Sign in and the days you plan will be here, on any device."}
          </Empty>
        )}
      </section>

      <section
        id="memories"
        aria-labelledby="memories-heading"
        data-testid="my-stuff-memories"
        className="mt-16 scroll-mt-24"
      >
        <SectionTitle id="memories-heading" count={memories.length}>
          Memories
        </SectionTitle>
        <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
          Days you&apos;ve had. {memories.length > 0 ? DO_IT_AGAIN : ""}
        </p>
        {memories.length > 0 ? (
          <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {memories.map((e) => (
              <li key={e.id} data-testid="memory" className="space-y-2">
                {e.card}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/adventures/${encodeURIComponent(e.id)}/recap`}
                    data-testid="memory-recap"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--gh-ink)] px-4 text-sm font-semibold text-white"
                  >
                    How it went · do it again
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{NO_MEMORIES}</Empty>
        )}
      </section>
    </>
  );
}

export function SectionTitle({
  id,
  count,
  children,
}: {
  readonly id: string;
  readonly count?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="ghad-display flex items-baseline gap-3 text-3xl font-extrabold tracking-[-0.03em] text-[var(--gh-ink)] sm:text-4xl"
    >
      {children}
      {count !== undefined && (
        <span className="text-lg font-semibold text-[var(--gh-ink-soft)]">
          {count}
        </span>
      )}
    </h2>
  );
}

export function Empty({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded-3xl bg-[var(--gh-cream)] px-6 py-8 text-base text-[var(--gh-ink-soft)]">
      {children}
    </p>
  );
}
