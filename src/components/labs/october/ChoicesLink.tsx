"use client";

import { useEffect } from "react";
import { Heart } from "lucide-react";
import { seedTray, useTray, type TrayItem } from "./tray";

/**
 * **A quiet, permanent answer to "where did my choices go?".**
 *
 * The floating button in the corner works once you know it is there, and in
 * real use it was missed — somebody chose three things and had no idea the
 * count in the bottom-right was theirs. So the same state is also stated at
 * the top of the page, beside October's own name, where a person looks when
 * they want to know what they have.
 *
 * It is the **same store** the drawer reads and the same rows the database
 * holds. This adds no second notion of a saved thing: it is a label on the
 * one that already exists, and pressing it opens the drawer that was always
 * there rather than navigating anywhere.
 */
export function ChoicesLink({
  seed,
  signedIn,
}: {
  readonly seed: readonly TrayItem[];
  readonly signedIn: boolean;
}) {
  const items = useTray();

  // Either control may mount first, and seeding is guarded so whichever does
  // it is the one that does it.
  useEffect(() => {
    seedTray(seed);
  }, [seed]);

  if (!signedIn) return null;

  return (
    <button
      type="button"
      data-testid="choices-link"
      onClick={() =>
        document
          .querySelector<HTMLButtonElement>("[data-testid='choices-tray']")
          ?.click()
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e9e6da]/15 px-3 text-sm text-[#e9e6da]/60 transition-colors hover:border-[#d09a4e]/50 hover:text-[#e9e6da]"
    >
      <Heart className="h-3.5 w-3.5" aria-hidden />
      <span className="tracking-[0.12em] uppercase">Choices</span>
      <span className="text-[#f0c88a] tabular-nums">{items.length}</span>
    </button>
  );
}
