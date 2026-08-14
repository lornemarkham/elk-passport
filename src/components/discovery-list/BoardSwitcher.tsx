"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Board } from "@/lib/data/boards-repo";

interface BoardSwitcherProps {
  boards: Board[];
  activeBoardId?: string;
  onSwitchBoard: (boardId: string) => void;
  onCreateBoard: (name: string) => void;
}

/**
 * Switch/create, light-themed equivalent of
 * labs/discovery-space/MoodBoard.tsx's BoardSwitcher — same boards-repo
 * calls, same "let the caller own the actual request" split, but no
 * framer-motion: List mode is deliberately plain and fast (see
 * ExperienceListRow's "no motion" note), not a re-skin of the immersive
 * field's chrome.
 */
export function BoardSwitcher({
  boards,
  activeBoardId,
  onSwitchBoard,
  onCreateBoard,
}: BoardSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  // Enter unmounts this input, which fires a native blur that would
  // otherwise re-run submitCreate with a stale draft and create the board
  // twice — same one-shot guard as the immersive BoardSwitcher.
  const hasSubmittedRef = useRef(false);

  function openCreate() {
    hasSubmittedRef.current = false;
    setIsCreating(true);
  }

  function submitCreate() {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    const trimmed = draft.trim();
    if (trimmed) onCreateBoard(trimmed);
    setDraft("");
    setIsCreating(false);
    setIsOpen(false);
  }

  function close() {
    setIsOpen(false);
    setIsCreating(false);
    setDraft("");
  }

  // Standard dropdown dismissal: outside click or Escape closes it,
  // whether it's showing the board list or the create-board input.
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Switch board"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#8a5a24]/20 text-[#2b2015]/50 transition-colors hover:border-[#8a5a24]/40 hover:text-[#2b2015]"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl border border-[#8a5a24]/20 bg-[#fbf5e6] p-1.5 shadow-lg">
          {boards.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-[#2b2015]/40">
              No boards yet.
            </p>
          ) : (
            boards.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => {
                  if (board.id !== activeBoardId) onSwitchBoard(board.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                  board.id === activeBoardId
                    ? "bg-[#8a5a24]/10 text-[#2b2015]"
                    : "text-[#2b2015]/60 hover:bg-[#8a5a24]/5 hover:text-[#2b2015]",
                )}
              >
                {board.name}
              </button>
            ))
          )}

          <div className="mt-1 border-t border-[#8a5a24]/15 pt-1">
            {isCreating ? (
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={submitCreate}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitCreate();
                  // Escape is handled globally (see the effect above) so
                  // it closes the whole picker, not just the create step.
                }}
                placeholder="Board name"
                aria-label="New board name"
                className="w-full rounded-lg border border-[#8a5a24]/25 bg-white/70 px-2.5 py-1.5 text-xs text-[#2b2015] outline-none focus:border-[#8a5a24]/50"
              />
            ) : (
              <button
                type="button"
                onClick={openCreate}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#2b2015]/60 transition-colors hover:bg-[#8a5a24]/5 hover:text-[#2b2015]"
              >
                + New board
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
