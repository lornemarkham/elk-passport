"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Experience } from "@/domain/experience/types";

interface ExperienceRowProps {
  experience: Experience;
  completed: boolean;
  onToggle: () => void;
  /** Present only in Ordered mode — Flexible has no user-defined sequence. */
  sequence?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Present only in Scheduled mode — its date/time control. Generic
   * rather than a dedicated prop so this row doesn't need to know what
   * Scheduled mode is, the same way it doesn't know about Ordered's move
   * buttons beyond rendering them. */
  trailing?: ReactNode;
}

/** The one checkbox-row look shared by every Flexible list (Up Next,
 * Completed), Ordered's single sequenced list, and Scheduled's grouped
 * lists — sequence number, move buttons, and a trailing control are all
 * opt-in via props so no caller has to know about the others' modes. */
export function ExperienceRow({
  experience,
  completed,
  onToggle,
  sequence,
  onMoveUp,
  onMoveDown,
  trailing,
}: ExperienceRowProps) {
  const showMoveControls = onMoveUp !== undefined || onMoveDown !== undefined;

  return (
    <motion.div
      layout
      className="flex items-start gap-3 rounded-xl border p-4 transition-colors"
      style={{
        borderColor: completed ? "rgba(138,90,36,0.35)" : "rgba(43,32,21,0.12)",
        backgroundColor: completed ? "#f0e2c0" : "#f7ecd3",
      }}
    >
      {sequence !== undefined && (
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2b2015]/[0.06] text-xs font-semibold text-[#8a5a24] tabular-nums">
          {sequence}
        </span>
      )}

      <motion.label
        whileTap={{ scale: 0.98 }}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
      >
        <span
          className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
          style={{
            borderColor: completed ? "#b5651d" : "rgba(43,32,21,0.25)",
            backgroundColor: completed ? "#b5651d" : "transparent",
          }}
        >
          <input
            type="checkbox"
            checked={completed}
            onChange={onToggle}
            aria-label={`Mark "${experience.title}" as completed`}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {completed && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
            >
              <Check className="h-3.5 w-3.5 text-[#f7ecd3]" strokeWidth={3} />
            </motion.span>
          )}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-sm font-semibold transition-colors",
              completed ? "text-[#2b2015]/45 line-through" : "text-[#2b2015]",
            )}
          >
            {experience.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-[#2b2015]/60">
            {experience.shortDescription}
          </p>
        </div>
      </motion.label>

      {showMoveControls && (
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            aria-label={`Move "${experience.title}" up`}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#8a5a24]/20 text-[#8a5a24] transition-colors hover:bg-[#2b2015]/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            aria-label={`Move "${experience.title}" down`}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#8a5a24]/20 text-[#8a5a24] transition-colors hover:bg-[#2b2015]/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {trailing && <div className="flex shrink-0 items-start">{trailing}</div>}
    </motion.div>
  );
}
