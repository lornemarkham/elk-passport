"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FieldExperience } from "./types";

type BoardTab = "saved" | "shelved";

export interface BoardSummary {
  id: string;
  name: string;
}

interface MoodBoardProps {
  savedExperiences: FieldExperience[];
  shelvedExperiences: FieldExperience[];
  onRemoveSaved: (id: string) => void;
  onReturnShelved: (id: string) => void;
  rejectedCount: number;
  hasActiveFilters: boolean;
  onRestoreRejected: () => void;
  onClearFilters: () => void;
  /** Current board's display name. Optional so today's single-board caller
   * can keep working unchanged; falls back to a generic label. */
  boardName?: string;
  /** Every board available to switch to. Omitted/empty renders the
   * switcher as a "more boards coming soon" placeholder. */
  boards?: BoardSummary[];
  activeBoardId?: string;
  /** Fired with the submitted name once the user confirms a rename. The
   * caller owns persistence — this component only reflects `boardName`
   * once the parent's state actually changes. */
  onRenameBoard?: (name: string) => void;
  /** Placeholder seam: real board switching is wired up by the caller. */
  onSwitchBoard?: (boardId: string) => void;
  /** Placeholder seam: real board creation is wired up by the caller. */
  onCreateBoard?: (name: string) => void;
}

function BoardTitle({
  name,
  onRename,
}: {
  name: string;
  onRename?: (name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [syncedName, setSyncedName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter commits, then unmounts the input (isEditing -> false), which
  // makes the browser fire a native blur on it synchronously — re-running
  // onBlur's `commit` a second time with a stale closure. This guard makes
  // commit a one-shot per edit session regardless of which path fires
  // first, instead of relying on event-ordering that isn't guaranteed.
  const hasCommittedRef = useRef(false);

  // Adjusted during render, not an effect: `name` can change from outside
  // (a confirmed rename, or switching to a different board entirely) and
  // `draft` should track it whenever the user isn't mid-edit. Doing this
  // in an effect would cost an extra render pass for no benefit.
  if (name !== syncedName && !isEditing) {
    setSyncedName(name);
    setDraft(name);
  }

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  function startEditing() {
    hasCommittedRef.current = false;
    setIsEditing(true);
  }

  function commit() {
    if (hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    const trimmed = draft.trim();
    setIsEditing(false);
    if (trimmed && trimmed !== name) {
      onRename?.(trimmed);
    } else {
      setDraft(name);
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            hasCommittedRef.current = true;
            setDraft(name);
            setIsEditing(false);
          }
        }}
        aria-label="Board name"
        className="font-heading w-full rounded-md border border-white/20 bg-white/[0.06] px-2 py-1 text-lg text-white/90 outline-none focus:border-white/40"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex items-center gap-1.5 text-left"
      aria-label="Rename board"
    >
      <h2 className="font-heading text-lg text-white/90">{name}</h2>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0 text-white/0 transition-colors group-hover:text-white/40"
        fill="none"
      >
        <path
          d="M11.3 2.3a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-7 7-2.7.7.7-2.7 7-7Z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function BoardSwitcher({
  boards,
  activeBoardId,
  onSwitchBoard,
  onCreateBoard,
}: {
  boards: BoardSummary[];
  activeBoardId?: string;
  onSwitchBoard?: (boardId: string) => void;
  onCreateBoard?: (name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState("");
  // Same one-shot guard as BoardTitle's commit — Enter unmounts this input,
  // and the resulting native blur would otherwise re-run submitCreate with
  // a stale draft, creating the same board twice.
  const hasSubmittedRef = useRef(false);

  function openCreate() {
    hasSubmittedRef.current = false;
    setIsCreating(true);
  }

  function submitCreate() {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    const trimmed = draft.trim();
    if (trimmed) onCreateBoard?.(trimmed);
    setDraft("");
    setIsCreating(false);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Switch board"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/45 transition-colors hover:border-white/30 hover:text-white/80"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#111]/95 p-1.5 shadow-xl backdrop-blur-xl"
          >
            {boards.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-white/40">
                Multiple boards are coming soon.
              </p>
            ) : (
              boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => {
                    onSwitchBoard?.(board.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    board.id === activeBoardId
                      ? "bg-white/[0.08] text-white/90"
                      : "text-white/60 hover:bg-white/[0.05] hover:text-white/90",
                  )}
                >
                  {board.name}
                </button>
              ))
            )}

            <div className="mt-1 border-t border-white/10 pt-1">
              {isCreating ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={submitCreate}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitCreate();
                    if (event.key === "Escape") {
                      hasSubmittedRef.current = true;
                      setDraft("");
                      setIsCreating(false);
                    }
                  }}
                  placeholder="Board name"
                  aria-label="New board name"
                  className="w-full rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white/90 outline-none focus:border-white/30"
                />
              ) : (
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white/90"
                >
                  + New board
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BoardRow({
  experience,
  onAction,
  actionLabel,
}: {
  experience: FieldExperience;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <motion.button
      type="button"
      layoutId={experience.id}
      layout="position"
      onClick={onAction}
      initial={{ opacity: 0, rotate: experience.layout.rotate }}
      animate={{ opacity: 1, rotate: 0 }}
      exit={{
        opacity: 0,
        scale: 0.94,
        transition: { duration: 0.3, ease: "easeIn" },
      }}
      transition={{
        layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.45, delay: 0.25, ease: "easeOut" },
        rotate: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
      }}
      aria-label={`${actionLabel} ${experience.name}`}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left backdrop-blur-md"
    >
      <div
        className={cn(
          "absolute -inset-6 rounded-full bg-linear-to-br opacity-60 blur-2xl",
          experience.glow,
        )}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="font-heading text-sm text-white/90">
            {experience.name}
          </p>
          <p className="text-xs text-white/45">{experience.tagline}</p>
        </div>
        <span className="text-[11px] text-white/0 transition-colors duration-200 group-hover:text-white/40">
          {actionLabel}
        </span>
      </div>
    </motion.button>
  );
}

export function MoodBoard({
  savedExperiences,
  shelvedExperiences,
  onRemoveSaved,
  onReturnShelved,
  rejectedCount,
  hasActiveFilters,
  onRestoreRejected,
  onClearFilters,
  boardName = "My Board",
  boards = [],
  activeBoardId,
  onRenameBoard,
  onSwitchBoard,
  onCreateBoard,
}: MoodBoardProps) {
  const [tab, setTab] = useState<BoardTab>("saved");
  const canBroaden = hasActiveFilters || rejectedCount > 0;
  const visible = tab === "saved" ? savedExperiences : shelvedExperiences;

  return (
    <aside className="pointer-events-none fixed inset-y-0 right-0 z-40 w-full max-w-[30%] min-w-[280px] border-l border-white/[0.06] bg-[#0b0b0b]/70 backdrop-blur-xl">
      <div className="pointer-events-auto flex h-full flex-col gap-5 overflow-y-auto px-6 py-10 sm:px-8">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium tracking-[0.2em] text-white/35 uppercase">
              Your board
            </p>
            <BoardSwitcher
              boards={boards}
              activeBoardId={activeBoardId}
              onSwitchBoard={onSwitchBoard}
              onCreateBoard={onCreateBoard}
            />
          </div>
          <BoardTitle name={boardName} onRename={onRenameBoard} />
          <div className="flex gap-1.5" role="tablist" aria-label="Mood Board">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "saved"}
              onClick={() => setTab("saved")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                tab === "saved"
                  ? "border-white/30 bg-white/[0.08] text-white/90"
                  : "border-white/10 text-white/45 hover:text-white/70",
              )}
            >
              Saved ({savedExperiences.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "shelved"}
              onClick={() => setTab("shelved")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                tab === "shelved"
                  ? "border-white/30 bg-white/[0.08] text-white/90"
                  : "border-white/10 text-white/45 hover:text-white/70",
              )}
            >
              Shelved ({shelvedExperiences.length})
            </button>
          </div>
          <p className="font-heading text-sm text-white/60">
            {visible.length === 0
              ? tab === "saved"
                ? "Nothing yet — just look around."
                : "Nothing shelved. Shelf something interesting for later."
              : tab === "saved"
                ? `${savedExperiences.length} discover${savedExperiences.length === 1 ? "y" : "ies"} caught your eye`
                : `${shelvedExperiences.length} set aside for later`}
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-3">
          <AnimatePresence initial={false}>
            {visible.map((experience) =>
              tab === "saved" ? (
                <BoardRow
                  key={experience.id}
                  experience={experience}
                  onAction={() => onRemoveSaved(experience.id)}
                  actionLabel="Remove"
                />
              ) : (
                <BoardRow
                  key={experience.id}
                  experience={experience}
                  onAction={() => onReturnShelved(experience.id)}
                  actionLabel="Return to Discovery"
                />
              ),
            )}
          </AnimatePresence>
        </div>

        {canBroaden && (
          <footer className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
              Feeling boxed in?
            </p>
            <div className="flex flex-wrap gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Clear filters
                </button>
              )}
              {rejectedCount > 0 && (
                <button
                  type="button"
                  onClick={onRestoreRejected}
                  className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Bring back {rejectedCount} passed-on{" "}
                  {rejectedCount === 1 ? "idea" : "ideas"}
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    </aside>
  );
}
