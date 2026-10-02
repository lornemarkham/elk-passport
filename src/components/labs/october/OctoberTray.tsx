"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, X } from "lucide-react";
import { seedTray, useTray, type TrayItem } from "./tray";

/**
 * **The corner that says what you have got so far.**
 *
 * It exists to answer one question without a navigation: *how many have I
 * found, and what were they called again?* Four is a session that worked;
 * zero after five minutes is a prototype that did not.
 *
 * Closed it is a count. Open it is the list, each row still removable, and a
 * link to the real My October — which is not replaced by this and is still
 * where a person plans. It never covers the page's own controls: it sits in
 * the bottom corner, above the fold's content rather than across it, and the
 * drawer is capped so a long list scrolls inside itself.
 */
export function OctoberTray({
  seed,
  signedIn,
  title = "My October",
}: {
  readonly seed: readonly TrayItem[];
  readonly signedIn: boolean;
  /** Experiment D calls this *Choices*; the drawer is otherwise identical. */
  readonly title?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = useTray();

  useEffect(() => {
    seedTray(seed);
  }, [seed]);

  if (!signedIn) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#e9e6da]/15 bg-[#14110f] shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-[#e9e6da]/10 px-4 py-3">
            <p className="text-[11px] tracking-[0.2em] text-[#d09a4e] uppercase">
              {title}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#e9e6da]/50 hover:bg-[#e9e6da]/10 hover:text-[#e9e6da]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[#e9e6da]/45">
              Nothing yet. Keep something and it lands here.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-[#e9e6da]/[0.07] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <p className="text-sm leading-snug text-[#e9e6da]">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-[0.14em] text-[#e9e6da]/35 uppercase">
                    {item.when}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/october/mine"
            className="block border-t border-[#e9e6da]/10 px-4 py-3 text-sm text-[#e9e6da]/55 hover:bg-[#e9e6da]/[0.04] hover:text-[#e9e6da]"
          >
            Open My October →
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        data-testid="choices-tray"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d09a4e]/40 bg-[#14110f]/95 px-4 py-2.5 text-sm text-[#f0c88a] shadow-lg shadow-black/50 backdrop-blur transition-colors hover:border-[#d09a4e]"
      >
        <Heart className="h-4 w-4" aria-hidden />
        <span className="tracking-[0.14em] uppercase">{title}</span>
        <span className="tabular-nums">{items.length}</span>
      </button>
    </div>
  );
}
