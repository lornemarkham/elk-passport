"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, useMotionValue } from "framer-motion";
import { toast } from "sonner";
import { selectActiveExperiences } from "@/domain/discovery/selectors";
import type { Experience as DomainExperience } from "@/domain/experience/types";
import { logDiscoveryEvent } from "@/domain/discovery/interactions";
import {
  clearStoredActiveBoardId,
  getStoredActiveBoardId,
  setStoredActiveBoardId,
} from "@/lib/data/activeBoardStorage";
import {
  createBoard,
  deleteBoard,
  listBoardItems,
  listBoards,
  removeExperienceFromBoard,
  renameBoard,
  saveExperienceToBoard,
  type Board,
} from "@/lib/data/boards-repo";
import { DeleteBoardDialog } from "./DeleteBoardDialog";
import { DiscoveryCard } from "./DiscoveryCard";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { DiscoveryInspectSheet } from "./DiscoveryInspectSheet";
import { toFieldExperience } from "./fieldPresentation";
import { MoodBoard } from "./MoodBoard";
import { SaveToBoardDialog } from "./SaveToBoardDialog";
import { usePeripheralTemptation } from "./temptation/usePeripheralTemptation";
import { usePrefersReducedMotion } from "./temptation/usePrefersReducedMotion";
import { useDiscoveryEngine } from "./useDiscoveryEngine";
import type { Experience, FieldExperience } from "./types";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export interface DiscoverySpaceProps {
  /** The catalogue to render — a renderer, not a data source (see module
   * doc below). Callers own where this comes from: the product route
   * fetches real Atlas experiences; the labs route still passes the
   * hand-authored seed set for experimentation. */
  experiences: DomainExperience[];
}

/**
 * A renderer, not a data source: every experience it shows comes in as a
 * prop. This component has no opinion on and no import of where that
 * catalogue came from — Atlas, seed data, anything else with the same
 * shape.
 */
export function DiscoverySpace({ experiences }: DiscoverySpaceProps) {
  const engine = useDiscoveryEngine();
  const { state } = engine;

  // Every experience mapped to its Discovery presentation, computed once
  // per `experiences` prop — stable across renders and across filter
  // changes, so filtering only ever changes *which* cards are visible,
  // never where a still-visible card sits (IMP-002 §11: "must not create
  // new random positions").
  const allFieldExperiences = useMemo<FieldExperience[]>(
    () =>
      experiences
        .map(toFieldExperience)
        .filter((experience): experience is FieldExperience =>
          Boolean(experience),
        ),
    [experiences],
  );

  const availableMoods = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.moods)),
    [experiences],
  );
  const availableActivities = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.activities)),
    [experiences],
  );
  const availableSeasons = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.seasons)),
    [experiences],
  );
  const availableCompanions = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.companions)),
    [experiences],
  );

  function toField(experience: DomainExperience): FieldExperience | null {
    return allFieldExperiences.find((f) => f.id === experience.id) ?? null;
  }

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inspecting, setInspecting] = useState<Experience | null>(null);
  // Which experience is mid-save and waiting on a board choice (only used
  // when 2+ boards exist — see handleSaveRequest), and which board id a
  // save request is currently in flight for (guards against firing the
  // same save twice while awaiting Atlas).
  const [savingExperience, setSavingExperience] = useState<Experience | null>(
    null,
  );
  const [savingBoardId, setSavingBoardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Atlas is the source of truth for both which boards exist and which
  // items each one holds. `boards` is every board this session knows
  // about (drives the switcher); `board` is the active one, whose items
  // back the Mood Board. Which board is active persists across reloads
  // via localStorage (see activeBoardStorage.ts) — falling back to
  // whichever board Atlas's list returns first if nothing's stored yet,
  // or the stored id no longer exists.
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  // True once the initial boards fetch has settled at least once —
  // distinguishes "still loading" from "loaded, zero boards remain"
  // (reachable now that a board can be deleted), both of which otherwise
  // look identical from `board === null` alone.
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [confirmingDeleteBoard, setConfirmingDeleteBoard] = useState(false);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);

  // On load: resolve the active board (persisted choice, or Atlas's
  // first) and reconcile its real, persisted items into local state, so
  // a returning visitor's Mood Board reflects what's actually saved for
  // *that* board. Uses the same authoritative replace as switchToBoard
  // below, not an additive merge — an additive merge would let stale
  // localStorage ids from a *different* board bleed into whichever board
  // happens to load first, which is exactly what happened before this
  // fix (see the Boards MVP session notes).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allBoards = await listBoards();
        if (cancelled) return;
        setBoards(allBoards);
        setBoardsLoaded(true);
        const storedId = getStoredActiveBoardId();
        const resolved =
          (storedId && allBoards.find((b) => b.id === storedId)) ||
          allBoards[0];
        if (!resolved) return;
        const items = await listBoardItems(resolved.id);
        if (cancelled) return;
        setBoard(resolved);
        setStoredActiveBoardId(resolved.id);
        engine.switchBoard(items.map((item) => item.experienceId));
      } catch (error) {
        console.error("Failed to load boards from Atlas:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately run-once: this reconciles local state against Atlas's
    // state as it stood at mount, not on every subsequent state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared by both create and switch: point `board` at a different board,
  // persist that choice, and replace local saved/shelved/rejected/filter
  // state with a fresh session for it (see BOARD_SWITCHED — this
  // deliberately does NOT merge with whatever was previously saved, since
  // that belonged to the *old* board). Atlas-first: fetching items
  // happens before any local state changes, so a failed switch leaves the
  // previous board's view intact instead of half-updating.
  async function switchToBoard(target: Board) {
    try {
      const items = await listBoardItems(target.id);
      setBoard(target);
      setStoredActiveBoardId(target.id);
      engine.switchBoard(items.map((item) => item.experienceId));
    } catch (error) {
      console.error(`Failed to switch to board ${target.id}:`, error);
    }
  }

  async function handleCreateBoard(name: string) {
    try {
      const created = await createBoard(name);
      setBoards((prev) => [...prev, created]);
      await switchToBoard(created);
    } catch (error) {
      console.error(`Failed to create board "${name}":`, error);
    }
  }

  function handleSwitchBoard(boardId: string) {
    const target = boards.find((candidate) => candidate.id === boardId);
    if (!target) {
      console.error(
        `Cannot switch to board ${boardId} — not in the loaded boards list.`,
      );
      return;
    }
    switchToBoard(target);
  }

  function handleRequestDeleteBoard() {
    setConfirmingDeleteBoard(true);
  }

  // Atlas-first: the board only disappears from local state once Atlas
  // confirms it's actually gone. On success, hands off to whichever
  // board naturally comes next — switchToBoard if one remains, or a
  // clean "no boards" reset if that was the last one — rather than
  // leaving `board` pointing at something that no longer exists.
  async function handleConfirmDeleteBoard() {
    if (!board) return;
    const deletedId = board.id;
    setIsDeletingBoard(true);
    try {
      await deleteBoard(deletedId);
      const remaining = boards.filter(
        (candidate) => candidate.id !== deletedId,
      );
      setBoards(remaining);
      setConfirmingDeleteBoard(false);
      if (remaining.length > 0) {
        await switchToBoard(remaining[0]);
      } else {
        setBoard(null);
        clearStoredActiveBoardId();
        engine.switchBoard([]);
      }
      toast.success("Board deleted.");
    } catch (error) {
      console.error(`Failed to delete board ${deletedId}:`, error);
      toast.error("Couldn't delete this board. Please try again.");
    } finally {
      setIsDeletingBoard(false);
    }
  }

  // The one pure Compass call (IMP-002 §4/§11, extended by IMP-004): filters
  // + query + save/reject/shelf state all collapse to "what's active right
  // now" through a single selector, so no consumer re-derives this itself.
  const activeExperiences = useMemo(
    () => selectActiveExperiences(experiences, state),
    [experiences, state],
  );

  const field = useMemo(
    () =>
      activeExperiences
        .map(toField)
        .filter((experience): experience is FieldExperience =>
          Boolean(experience),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeExperiences, allFieldExperiences],
  );

  // Looked up from the *unfiltered* full field, not the filtered one — a
  // saved or shelved card must never disappear from the Mood Board just
  // because a later filter would have excluded it (IMP-002 §10/§14,
  // preserved by IMP-004's "Mood Board is separate from the current result
  // set" architecture decision).
  const savedFieldExperiences = state.savedExperienceIds
    .map((id) => allFieldExperiences.find((e) => e.id === id))
    .filter((e): e is FieldExperience => Boolean(e));
  const shelvedFieldExperiences = state.shelvedExperienceIds
    .map((id) => allFieldExperiences.find((e) => e.id === id))
    .filter((e): e is FieldExperience => Boolean(e));

  // Peripheral Temptation (Discovery Lab v0.4): a self-contained layer that
  // occasionally lets one eligible, unhovered, non-saved card run one brief
  // environmental event. Rejected/shelved cards are never in `field`, so
  // they're naturally excluded here too. See
  // temptation/usePeripheralTemptation.ts for the full scheduler.
  const activeTemptation = usePeripheralTemptation({
    cards: field,
    hoveredCardId,
    moodBoardCardIds: state.savedExperienceIds,
    enabled: true,
  });

  // Cursor position as a percentage of the field — the same coordinate
  // space each card's own top/left layout already lives in, so individual
  // cards can measure their own distance to the pointer with no DOM reads.
  const pointerXPercent = useMotionValue(-1000);
  const pointerYPercent = useMotionValue(-1000);

  // Result count is a learning signal on its own (IMP-004 "Analytics and
  // Learning Signals"). Logged from here, not the engine, since the engine
  // is intentionally catalogue-agnostic.
  useEffect(() => {
    logDiscoveryEvent({
      type: "result_count_changed",
      sessionId: state.sessionId,
      occurredAt: new Date().toISOString(),
      count: activeExperiences.length,
    });
  }, [activeExperiences.length, state.sessionId]);

  function focusStableAnchor() {
    // A card leaving the DOM after a save/reject/shelf action would
    // otherwise drop keyboard focus to <body> with no warning (IMP-004
    // "Focus must move predictably when cards leave the active set").
    filtersButtonRef.current?.focus();
  }

  // Atlas-first: local state (the thing that actually drives what the
  // Mood Board displays) only changes once Atlas confirms the write, and
  // only when the save targets the *active* board — saving to a
  // different board must not make the card vanish from a field it's
  // still active in. A failed request must not leave the UI claiming a
  // durable save that never happened, so on failure this deliberately
  // does not call `engine.save()`.
  //
  // Duplicate saves to the same board are already safe at the Atlas
  // layer — SupabaseAtlasStore upserts on the (board_id, experience_id)
  // unique constraint, so re-saving is a harmless no-op there. The only
  // thing left to guard here is firing the same request twice while one
  // is already in flight (savingBoardId).
  async function performSave(experience: Experience, targetBoard: Board) {
    if (savingBoardId) return;
    setSavingBoardId(targetBoard.id);
    try {
      await saveExperienceToBoard(targetBoard.id, experience.id);
      if (targetBoard.id === board?.id) {
        engine.save(experience.id);
        focusStableAnchor();
      }
      toast.success(`Saved to ${targetBoard.name}.`);
    } catch (error) {
      console.error(
        `Failed to save "${experience.id}" to board ${targetBoard.id}:`,
        error,
      );
      toast.error("Couldn't save that experience. Please try again.");
    } finally {
      setSavingBoardId(null);
      setSavingExperience(null);
    }
  }

  // Entry point for both the field card's Save button and the inspect
  // sheet's. A single board saves immediately — no picker, no extra
  // click. 2+ boards opens SaveToBoardDialog instead of guessing which
  // one the user meant.
  function handleSaveRequest(experience: Experience) {
    if (!board) {
      console.error(
        `Cannot save "${experience.id}" — no board has loaded from Atlas yet.`,
      );
      toast.error("Your boards haven't loaded yet. Please try again shortly.");
      return;
    }
    if (boards.length > 1) {
      // Close the inspect sheet first if that's where Save was clicked —
      // this dialog is a sibling, not nested inside it (see
      // SaveToBoardDialog's doc comment for why).
      setInspecting(null);
      setSavingExperience(experience);
      return;
    }
    performSave(experience, board);
  }

  function handleChooseBoardForSave(boardId: string) {
    const target = boards.find((candidate) => candidate.id === boardId);
    if (!target || !savingExperience) return;
    performSave(savingExperience, target);
  }
  // Atlas-first, same pattern as performSave: MoodBoard's title reflects
  // `board.name`, which only changes once Atlas confirms the rename. On
  // failure this deliberately does not call `setBoard`, so MoodBoard's
  // inline input re-syncs to the old name instead of showing a rename
  // that never actually persisted.
  async function handleRenameBoard(name: string) {
    if (!board) {
      console.error(
        "Cannot rename board — no board has loaded from Atlas yet.",
      );
      return;
    }
    try {
      const renamedBoard = await renameBoard(board.id, name);
      setBoard(renamedBoard);
    } catch (error) {
      console.error(`Failed to rename board ${board.id}:`, error);
    }
  }
  // Atlas-first, same pattern as performSave/handleRenameBoard: Atlas is
  // the source of truth reconciled on every mount (see the effect above),
  // so a local-only removal would silently come back on the next reload
  // if Atlas never actually deleted the row. Only calls engine.removeSaved
  // once the delete is confirmed.
  async function handleRemoveSaved(experienceId: string) {
    if (!board) {
      console.error(
        `Cannot remove "${experienceId}" — no board has loaded from Atlas yet.`,
      );
      return;
    }
    try {
      await removeExperienceFromBoard(board.id, experienceId);
      engine.removeSaved(experienceId);
      focusStableAnchor();
    } catch (error) {
      console.error(
        `Failed to remove "${experienceId}" from board ${board.id}:`,
        error,
      );
    }
  }
  function handleReject(experience: Experience) {
    engine.reject(experience.id);
    focusStableAnchor();
  }
  function handleShelf(experience: Experience) {
    engine.shelf(experience.id);
    focusStableAnchor();
  }
  function handleInspect(experience: Experience) {
    engine.inspect(experience.id);
    setInspecting(experience);
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={(event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        pointerXPercent.set(((event.clientX - rect.left) / rect.width) * 100);
        pointerYPercent.set(((event.clientY - rect.top) / rect.height) * 100);
      }}
      onPointerLeave={() => {
        pointerXPercent.set(-1000);
        pointerYPercent.set(-1000);
      }}
      className="fixed inset-0 h-dvh w-dvw overflow-hidden bg-[#0b0b0b]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.05), transparent 45%), radial-gradient(circle at 82% 75%, rgba(255,255,255,0.04), transparent 40%)",
        }}
      />
      <DiscoveryFilters
        ref={filtersButtonRef}
        filters={state.filters}
        onChange={engine.setFilters}
        query={state.query}
        onQueryChange={engine.setQuery}
        resultCount={activeExperiences.length}
        isOpen={filtersOpen}
        onToggleOpen={() => setFiltersOpen((prev) => !prev)}
        availableMoods={availableMoods}
        availableActivities={availableActivities}
        availableSeasons={availableSeasons}
        availableCompanions={availableCompanions}
      />
      <LayoutGroup>
        <div className="relative h-full w-full">
          {field.map((experience) => (
            <DiscoveryCard
              key={experience.id}
              experience={experience}
              layout={experience.layout}
              dragConstraintsRef={containerRef}
              onInspect={handleInspect}
              onSave={handleSaveRequest}
              onReject={handleReject}
              onShelf={handleShelf}
              pointerXPercent={pointerXPercent}
              pointerYPercent={pointerYPercent}
              activeTemptation={activeTemptation}
              onHoverChange={(hovering) =>
                setHoveredCardId((prev) => {
                  if (hovering) return experience.id;
                  return prev === experience.id ? null : prev;
                })
              }
            />
          ))}
        </div>
        <MoodBoard
          savedExperiences={savedFieldExperiences}
          shelvedExperiences={shelvedFieldExperiences}
          onRemoveSaved={handleRemoveSaved}
          onReturnShelved={(id) => engine.restore(id)}
          rejectedCount={state.rejectedExperienceIds.length}
          hasActiveFilters={
            Object.values(state.filters).some((value) =>
              Array.isArray(value) ? value.length > 0 : value !== undefined,
            ) || state.query.trim().length > 0
          }
          onRestoreRejected={() => engine.broaden("restore-rejected")}
          onClearFilters={() => engine.broaden("clear-filters")}
          boardName={board?.name}
          boardsLoaded={boardsLoaded}
          onRenameBoard={handleRenameBoard}
          boards={boards}
          activeBoardId={board?.id}
          onSwitchBoard={handleSwitchBoard}
          onCreateBoard={handleCreateBoard}
          onRequestDeleteBoard={handleRequestDeleteBoard}
        />
      </LayoutGroup>

      <DiscoveryInspectSheet
        experience={inspecting}
        onOpenChange={(open) => !open && setInspecting(null)}
        onSave={(experience) => handleSaveRequest(experience)}
        onReject={(experience) => handleReject(experience)}
        onShelf={(experience) => handleShelf(experience)}
      />

      <SaveToBoardDialog
        experience={savingExperience}
        boards={boards}
        savingBoardId={savingBoardId}
        onOpenChange={(open) => !open && setSavingExperience(null)}
        onChooseBoard={handleChooseBoardForSave}
      />

      <DeleteBoardDialog
        boardName={confirmingDeleteBoard ? (board?.name ?? null) : null}
        isDeleting={isDeletingBoard}
        onOpenChange={(open) => !open && setConfirmingDeleteBoard(false)}
        onConfirm={handleConfirmDeleteBoard}
      />

      {state.lastRemoved && !prefersReducedMotion && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[1000] -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-[#0b0b0b]/90 px-4 py-2 text-xs text-white/70 backdrop-blur-md">
            <span>
              {state.lastRemoved.action === "reject"
                ? "Marked not interested."
                : "Shelved for later."}
            </span>
            <button
              type="button"
              onClick={() => engine.restoreLastRemoved()}
              className="font-medium text-white/90 underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
