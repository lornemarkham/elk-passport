"use client";

import { useEffect } from "react";
import { Check, Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import { useKeeping } from "@/components/october/save/keeping";
import type { Possibility } from "@/lib/labs/october/possibility";
import { addToTray, removeFromTray } from "./tray";

/**
 * **Keep it and carry on.**
 *
 * The production save control is right about everything except one thing for
 * these labs: it is designed to sit quietly in the corner of a card, and here
 * the whole experiment is that collecting is part of discovering. So this is
 * the same mechanism — `useKeeping`, same route, same row, nothing optimistic
 * — wearing a louder coat, and it tells the tray so the count in the corner
 * moves the instant the server agrees.
 *
 * Signed out it is a link to sign in that comes back here, exactly as every
 * other October control behaves. It is never hidden: a visitor who cannot see
 * that saving exists has no reason to sign in.
 */
/**
 * What the control calls itself. Experiment D is testing whether the generic
 * Passport word is *Choices*, so the word is a prop rather than a fork of the
 * control — the mechanism underneath must stay identical across the labs or
 * they stop being comparable.
 */
export interface KeepWords {
  readonly idle: string;
  readonly done: string;
  readonly signIn: string;
}

const DEFAULT_WORDS: KeepWords = {
  idle: "Keep this",
  done: "In My October",
  signIn: "Sign in to keep",
};

export function LabKeep({
  p,
  saved: initiallySaved,
  signedIn,
  returnTo,
  big = false,
  words = DEFAULT_WORDS,
}: {
  readonly p: Possibility;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly returnTo: string;
  readonly big?: boolean;
  readonly words?: KeepWords;
}) {
  const keepable = p.keepAs
    ? {
        entityId: p.id,
        entityKind: p.keepAs,
        name: p.title,
        startsAt: p.startsAt ?? null,
      }
    : undefined;

  if (!keepable) return null;
  return (
    <Keep
      keepable={keepable}
      label={p.availability.label}
      initiallySaved={initiallySaved}
      signedIn={signedIn}
      returnTo={returnTo}
      big={big}
      words={words}
    />
  );
}

function Keep({
  keepable,
  label,
  initiallySaved,
  signedIn,
  returnTo,
  big,
  words,
}: {
  readonly keepable: {
    entityId: string;
    entityKind: NonNullable<Possibility["keepAs"]>;
    name: string;
    startsAt: string | null;
  };
  readonly label: string;
  readonly initiallySaved: boolean;
  readonly signedIn: boolean;
  readonly returnTo: string;
  readonly big: boolean;
  readonly words: KeepWords;
}) {
  const { saved, state, toggle } = useKeeping(keepable, initiallySaved);

  // The tray follows the store rather than the click, so a save that failed
  // never shows up in the corner as though it worked.
  useEffect(() => {
    if (saved) {
      addToTray({ id: keepable.entityId, name: keepable.name, when: label });
    } else {
      removeFromTray(keepable.entityId);
    }
  }, [saved, keepable.entityId, keepable.name, label]);

  const size = big ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-xs";

  if (!signedIn) {
    return (
      <Link
        href={`/signin?returnTo=${encodeURIComponent(returnTo)}`}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e9e6da]/20 ${size} text-[#e9e6da]/60 transition-colors hover:border-[#d09a4e]/50 hover:text-[#e9e6da]`}
      >
        <Heart className="h-4 w-4" aria-hidden />
        {words.signIn}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border ${size} transition-colors ${
        saved
          ? "border-[#d09a4e]/60 bg-[#d09a4e]/15 text-[#f0c88a]"
          : "border-[#e9e6da]/20 text-[#e9e6da]/70 hover:border-[#d09a4e]/50 hover:text-[#e9e6da]"
      }`}
    >
      {state === "saving" ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : saved ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Heart className="h-4 w-4" aria-hidden />
      )}
      {state === "failed"
        ? "Didn't save — try again"
        : saved
          ? words.done
          : words.idle}
    </button>
  );
}
