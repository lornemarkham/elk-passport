"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Experience } from "@/domain/experience/types";
import type { OctoberThing } from "@/lib/october/types";
import { isOctoberKind } from "@/lib/october/types";
import { removeExperienceFromBoard } from "@/lib/data/boards-repo";
import { forget, wantToDo } from "@/lib/october/october-repo";
import { useHere } from "@/lib/location/useHere";
import { PossibilityCard } from "@/components/discovery-list/PossibilityCard";

/**
 * **"What did I collect, and which of these do I actually want to do?"**
 *
 * What this replaced answered neither. It opened with *Who's on this board* —
 * a sharing panel above the things somebody had just saved — and then showed
 * a grid of small text cards with truncated descriptions. Sharing is real and
 * stays; it is simply not the first question anybody has about their own
 * collection.
 *
 * ## The same cards as Discovery, on purpose
 *
 * A saved possibility is the same possibility. Reusing `PossibilityCard` means
 * what a person recognised while browsing is what they see here — the
 * photograph, the venue and town, the date for a dated thing, the distance
 * where both positions are stated — rather than a second, worse rendering of
 * the same subject. It also means every improvement to one improves the other.
 *
 * ## Deciding happens here, not while browsing
 *
 * Discovery has one action now, because asking somebody to grade their
 * commitment before they have finished looking is the thing that made it
 * confusing. The ladder lives on this page instead:
 *
 * ```
 * Saved for later   on the board, and nothing more has been said
 * Want to do        also in My October, state "ahead"
 * ```
 *
 * **There is no "Let's do it" button here, deliberately.** The level above
 * *want to do* is a thing with a day on it, and `planThing` writes that day
 * into `starts_at` — the same column a dated Event's real start time lives in.
 * Shipping it would quietly overwrite the date of every saved Event somebody
 * committed to. That needs a decision about where a chosen day belongs, not a
 * button added under deadline, so it is reported rather than faked.
 */
export function SavedReview({
  boardId,
  boardName,
  experiences,
  unresolved,
  october,
  back,
  readOnly = false,
}: {
  readonly boardId: string;
  readonly boardName: string;
  readonly experiences: readonly Experience[];
  /** Saved ids nothing could name. Shown, never dropped. */
  readonly unresolved: readonly string[];
  readonly october: readonly OctoberThing[];
  readonly back: string;
  readonly readOnly?: boolean;
}) {
  // **Location is read the same way Discovery reads it** — asked once, held
  // for this visit, written nowhere. So a distance here means exactly what it
  // means there, and coming back from Discovery does not re-ask.
  const { at } = useHere();
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [wanted, setWanted] = useState<ReadonlySet<string>>(
    () => new Set(october.map((thing) => thing.entityId)),
  );
  const [busy, setBusy] = useState<string | null>(null);

  const showing = useMemo(
    () => experiences.filter((e) => !removed.has(e.id)),
    [experiences, removed],
  );

  async function remove(experience: Experience) {
    if (busy) return;
    setBusy(experience.id);
    try {
      await removeExperienceFromBoard(boardId, experience.id);
      setRemoved((prev) => new Set(prev).add(experience.id));
      // **Taken out of the collection, and out of October with it.** Leaving
      // an orphaned intention behind would be a thing somebody still means to
      // do that they can no longer see.
      if (wanted.has(experience.id)) {
        await forget(experience.id).catch(() => {});
        setWanted((prev) => {
          const next = new Set(prev);
          next.delete(experience.id);
          return next;
        });
      }
      toast.success("Removed.");
    } catch {
      toast.error("Couldn't remove that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function want(experience: Experience) {
    if (busy) return;
    if (!isOctoberKind(experience.kind)) {
      toast.error("My October can't hold this kind yet.");
      return;
    }
    setBusy(experience.id);
    try {
      await wantToDo({
        entityId: experience.id,
        entityKind: experience.kind,
        name: experience.title,
        startsAt: experience.startTime ?? null,
      });
      setWanted((prev) => new Set(prev).add(experience.id));
      toast.success("In My October.");
    } catch {
      toast.error("Couldn't keep that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const total = showing.length + unresolved.length;

  return (
    <div data-testid="saved-review">
      <p className="mt-1 text-sm text-black/60">
        {total} {total === 1 ? "possibility" : "possibilities"} in {boardName}
        {readOnly ? " · shared with you to look at" : ""}
      </p>

      {/* Never silently dropped — see `loadBoardWithExperiences`. */}
      {unresolved.length > 0 && (
        <p
          data-testid="saved-unresolved"
          className="mt-4 rounded-xl border border-dashed border-black/30 bg-white px-4 py-3 text-sm text-black/60"
        >
          {unresolved.length} saved {unresolved.length === 1 ? "item" : "items"}{" "}
          {unresolved.length === 1 ? "is" : "are"} still here but can&apos;t be
          shown right now — Passport could not reach what Atlas knows about{" "}
          {unresolved.length === 1 ? "it" : "them"}.
        </p>
      )}

      {showing.length === 0 && unresolved.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-black/30 bg-white px-5 py-12 text-center">
          <p className="text-lg text-[#111]">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-black/60">
            Save anything that looks interesting while you browse, and it will
            be here to look at together.
          </p>
          <Link
            href={back}
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#111] px-5 text-sm font-medium text-white"
          >
            Back to discovering
          </Link>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {showing.map((experience) => (
            <li key={experience.id} className="flex flex-col">
              <PossibilityCard
                experience={experience}
                {...(at ? { origin: at } : {})}
                saved
                saving={false}
                onSave={() => {}}
              />
              {!readOnly && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {wanted.has(experience.id) ? (
                    <span
                      data-testid="saved-wanted"
                      className="ghad-accent-text inline-flex min-h-9 items-center rounded-full bg-black/12 px-3 text-xs font-medium"
                    >
                      In My October
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid="saved-want"
                      disabled={busy === experience.id}
                      onClick={() => void want(experience)}
                      className="ghad-accent-text inline-flex min-h-9 items-center rounded-full border border-black/30 px-3 text-xs font-medium transition-colors hover:bg-black/10 disabled:opacity-50"
                    >
                      Want to do
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="saved-remove"
                    disabled={busy === experience.id}
                    onClick={() => void remove(experience)}
                    aria-label={`Remove ${experience.title}`}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-black/45 transition-colors hover:bg-[#111]/[0.06] hover:text-black/70 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Sharing is real and kept — just not above the things somebody came
          here to look at. One link, at the end, for the person who wants it. */}
      {!readOnly && (
        <div className="mt-10 border-t border-black/15 pt-6">
          <Link
            href={`/boards/${boardId}`}
            data-testid="share-this"
            className="ghad-accent-text inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:text-[#111]"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share this collection, or manage it as a board
          </Link>
        </div>
      )}
    </div>
  );
}
