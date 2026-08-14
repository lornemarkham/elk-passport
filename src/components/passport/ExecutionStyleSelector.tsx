"use client";

import { motion } from "framer-motion";
import { CalendarClock, ListOrdered, Shuffle } from "lucide-react";

export type ExecutionStyle = "flexible" | "ordered" | "scheduled";

interface StyleOption {
  id: ExecutionStyle;
  label: string;
  description: string;
  examples: string;
  icon: typeof Shuffle;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: "flexible",
    label: "Flexible",
    description: "Complete experiences whenever you have time.",
    examples: "Summer bucket list, coffee shops, hiking goals, bird watching",
    icon: Shuffle,
  },
  {
    id: "ordered",
    label: "Ordered",
    description: "Complete experiences in a specific sequence.",
    examples: "Road trips, wine tours, bachelor weekends",
    icon: ListOrdered,
  },
  {
    id: "scheduled",
    label: "Scheduled",
    description: "Assign experiences to dates and times.",
    examples: "Vacation, long weekend, family visit",
    icon: CalendarClock,
  },
];

interface ExecutionStyleSelectorProps {
  selected: ExecutionStyle;
  onSelect: (style: ExecutionStyle) => void;
}

/** Which execution style is active — controlled by the parent
 * (PassportWorkspace) since it now gates which workspace renders, not
 * just how this control looks. Page-level UI state only — nothing here
 * is persisted or sent to Atlas yet. */
export function ExecutionStyleSelector({
  selected,
  onSelect,
}: ExecutionStyleSelectorProps) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-3 text-sm font-medium text-[#2b2015]/70">
        How do you want to work through this board?
      </legend>
      <div
        role="radiogroup"
        aria-label="Execution style"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {STYLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(option.id)}
              className="relative overflow-hidden rounded-xl border p-4 text-left transition-colors"
              style={{
                borderColor: isSelected
                  ? "rgba(138,90,36,0.45)"
                  : "rgba(43,32,21,0.12)",
                backgroundColor: isSelected ? "#f7ecd3" : "transparent",
              }}
            >
              {isSelected && (
                <motion.span
                  layoutId="execution-style-highlight"
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{
                    boxShadow: "0 0 0 1px rgba(181,101,29,0.25) inset",
                    background:
                      "radial-gradient(circle at 20% 15%, rgba(181,101,29,0.10), transparent 60%)",
                  }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <motion.div
                className="relative flex items-start gap-3"
                animate={{ scale: isSelected ? 1 : 0.98 }}
                whileTap={{ scale: 0.96 }}
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isSelected
                      ? "#b5651d"
                      : "rgba(43,32,21,0.06)",
                    color: isSelected ? "#f7ecd3" : "#8a5a24",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2b2015]">
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[#2b2015]/60">
                    {option.description}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#2b2015]/40">
                    {option.examples}
                  </p>
                </div>
              </motion.div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
