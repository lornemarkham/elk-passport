"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Search, Share2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Experience } from "@/domain/experience/types";
import type { OctoberThing } from "@/lib/october/types";
import { isOctoberKind } from "@/lib/october/types";
import { removeExperienceFromBoard } from "@/lib/data/boards-repo";
import { forget, wantToDo } from "@/lib/october/october-repo";
import { useHere } from "@/lib/location/useHere";
import { PossibilityCard } from "@/components/discovery-list/PossibilityCard";
import { PlanFromSaved } from "./PlanFromSaved";

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
 *
 * ## Where saving leads: a day, or an adventure
 *
 * *Plan with these* lets somebody choose cards and either make a day out of
 * them in Go Have a Day or add them to an adventure (`PlanFromSaved`). That
 * is not the missing rung above: it writes to the adventure, never to My
 * October's `starts_at`, and leaves what each thing is on Saved unchanged.
 */
export function SavedReview({
  boardId,
  boardName,
  experiences,
  unresolved,
  october,
  back,
  readOnly = false,
  adventure,
}: {
  /** An adventure being added to (`/saved?adventure=`): start choosing. */
  readonly adventure?: string | undefined;
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
  const [choosing, setChoosing] = useState(Boolean(adventure));
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const choose = (id: string) =>
    setChosen((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

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
  // **Find one again** — by name, and by what kind of thing it is. Filtering
  // narrows what is shown; it never changes what is saved.
  const [find, setFind] = useState("");
  const [kind, setKind] = useState<string>("all");
  const kinds = useMemo(
    () => [...new Set(showing.map((e) => e.kind))].sort(),
    [showing],
  );
  const shown = useMemo(() => {
    const words = find.trim().toLowerCase();
    return showing.filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (!words ||
          [e.title, e.subtype, e.venue?.name, e.shortDescription]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(words)),
    );
  }, [showing, find, kind]);
  const small =
    "pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <div data-testid="saved-review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-[var(--gh-ink-soft)]">
          {total} {total === 1 ? "possibility" : "possibilities"} in {boardName}
          {readOnly ? " · shared with you to look at" : ""}
        </p>
        {showing.length > 0 && !choosing && (
          <button
            type="button"
            data-testid="saved-plan"
            onClick={() => setChoosing(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--gh-ink)] px-5 text-base font-semibold text-white hover:bg-black"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Plan with these
          </button>
        )}
      </div>

      {showing.length > 3 && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block sm:w-80">
            <span className="sr-only">Find a saved place</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--gh-ink-soft)]"
              aria-hidden
            />
            <input
              type="search"
              data-testid="saved-find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Find a saved place"
              className="block min-h-12 w-full rounded-full border-2 border-[var(--gh-line)] bg-white pr-4 pl-11 text-base outline-none focus:border-[var(--gh-ink)]"
            />
          </label>
          {kinds.length > 1 && (
            <div
              role="group"
              aria-label="Show"
              className="flex flex-wrap gap-2"
            >
              {["all", ...kinds].map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`inline-flex min-h-11 items-center rounded-full border-2 px-4 text-sm font-semibold ${kind === k ? "border-[var(--gh-ink)] bg-[var(--gh-ink)] text-white" : "border-[var(--gh-line)] bg-white text-[var(--gh-ink)] hover:border-[var(--gh-ink)]/40"}`}
                >
                  {KIND_WORDS[k] ?? k}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Never silently dropped — see `loadBoardWithExperiences`. */}
      {unresolved.length > 0 && (
        <p
          data-testid="saved-unresolved"
          className="mt-4 rounded-2xl border border-dashed border-[var(--gh-line)] bg-white px-4 py-3 text-sm text-[var(--gh-ink-soft)]"
        >
          {unresolved.length} saved {unresolved.length === 1 ? "item" : "items"}{" "}
          {unresolved.length === 1 ? "is" : "are"} still here but can&apos;t be
          shown right now — Passport could not reach what Atlas knows about{" "}
          {unresolved.length === 1 ? "it" : "them"}.
        </p>
      )}

      {showing.length === 0 && unresolved.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-[var(--gh-cream)] px-6 py-12 text-center">
          <p className="ghad-display text-2xl font-extrabold text-[var(--gh-ink)]">
            Nothing saved yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-base text-[var(--gh-ink-soft)]">
            Save anything that looks interesting while you browse, and it will
            be here — raw material for your next adventure.
          </p>
          <Link
            href={back}
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[var(--gh-ink)] px-6 text-base font-semibold text-white"
          >
            Back to discovering
          </Link>
        </div>
      ) : shown.length === 0 && showing.length > 0 ? (
        <p className="mt-6 text-base text-[var(--gh-ink-soft)]">
          Nothing saved matches that.{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-4"
            onClick={() => {
              setFind("");
              setKind("all");
            }}
          >
            Show everything
          </button>
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((experience) => {
            const isChosen = chosen.includes(experience.id);
            return (
              <PossibilityCard
                key={experience.id}
                experience={experience}
                {...(at ? { origin: at } : {})}
                saved
                saving={false}
                onSave={() => {}}
                className={
                  isChosen
                    ? "rounded-2xl ring-4 ring-[var(--gh-forest)] ring-offset-4"
                    : ""
                }
                actions={
                  choosing ? (
                    <button
                      type="button"
                      data-testid="saved-choose"
                      aria-pressed={isChosen}
                      aria-label={`Choose ${experience.title}`}
                      onClick={() => choose(experience.id)}
                      className={`${small} border-2 ${isChosen ? "border-[var(--gh-forest)] bg-[var(--gh-forest)] text-white" : "border-[var(--gh-ink)]/20 bg-white text-[var(--gh-ink)] hover:border-[var(--gh-ink)]/50"}`}
                    >
                      {isChosen ? (
                        <>
                          <Check className="h-4 w-4" aria-hidden />
                          Chosen
                        </>
                      ) : (
                        "Choose"
                      )}
                    </button>
                  ) : readOnly ? (
                    <span className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--gh-ink-soft)]">
                      <Check className="h-4 w-4" aria-hidden />
                      Saved
                    </span>
                  ) : (
                    <>
                      {wanted.has(experience.id) ? (
                        <span
                          data-testid="saved-wanted"
                          className="ghad-accent-text inline-flex min-h-11 items-center rounded-full bg-[var(--gh-cream)] px-4 text-sm font-semibold"
                        >
                          In My October
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-testid="saved-want"
                          disabled={busy === experience.id}
                          onClick={() => void want(experience)}
                          className={`${small} ghad-accent-text border-2 border-[var(--gh-line)] bg-white hover:border-[var(--gh-ink)]/40`}
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
                        className={`${small} text-[var(--gh-ink-soft)] hover:bg-[var(--gh-cream)] hover:text-[var(--gh-ink)]`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </button>
                    </>
                  )
                }
              />
            );
          })}
        </ul>
      )}

      {choosing && (
        <PlanFromSaved
          chosen={chosen}
          titles={Object.fromEntries(showing.map((e) => [e.id, e.title]))}
          preselect={adventure}
          onClear={() => {
            setChosen([]);
            setChoosing(false);
          }}
        />
      )}

      {/* Sharing is real and kept — just not above the things somebody came
          here to look at. One link, at the end, for the person who wants it. */}
      {!readOnly && (
        <div className="mt-12 border-t border-[var(--gh-line)] pt-6">
          <Link
            href={`/boards/${boardId}`}
            data-testid="share-this"
            className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--gh-ink)] underline-offset-4 hover:underline"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share this collection, or manage it as a board
          </Link>
        </div>
      )}
    </div>
  );
}

/** Atlas's kinds, in a person's words. */
const KIND_WORDS: Readonly<Record<string, string>> = {
  all: "Everything",
  Place: "Places",
  Event: "Events",
  Organization: "Food & business",
  Activity: "Things to do",
  Experience: "Experiences",
};
