"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

interface BoardTitleProps {
  name: string;
  onRename: (name: string) => void | Promise<void>;
}

/**
 * Click-to-rename board title, light-themed equivalent of
 * labs/discovery-space/MoodBoard.tsx's BoardTitle — same optimistic
 * commit/revert-on-failure behavior. Enter and blur both call commit()
 * directly (not Enter-triggers-blur-triggers-commit): relying on
 * `.blur()` to indirectly fire onBlur made Enter feel unreliable — it
 * only visibly took effect once something else blurred the field. The
 * one-shot guard keeps that safe even when both fire for the same edit.
 */
export function BoardTitle({ name, onRename }: BoardTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [syncedName, setSyncedName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasCommittedRef = useRef(false);

  // Adjusted during render, not an effect: `name` can change from outside
  // (a confirmed rename, or switching to a different board) and `draft`
  // should track it whenever the user isn't mid-edit.
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
      // Optimistic: renders `draft`, not `name`, so the new name shows up
      // immediately. Reverts to the last confirmed name if Atlas rejects
      // the rename, rather than leaving the display stuck on a value that
      // was never actually saved.
      Promise.resolve(onRename(trimmed)).catch(() => {
        setDraft(name);
        setSyncedName(name);
      });
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
        className="w-full rounded-md border border-black/30 bg-white px-2 py-1 text-xl text-[#111] outline-none focus:border-black/50"
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
      {/* `draft`, not `name`: once a rename commits, `draft` already holds
       * the new value optimistically, while `name` only catches up once
       * Atlas confirms. */}
      <span className="text-xl text-[#111]">{draft}</span>
      <Pencil className="h-3 w-3 shrink-0 text-black/0 transition-colors group-hover:text-black/35" />
    </button>
  );
}
