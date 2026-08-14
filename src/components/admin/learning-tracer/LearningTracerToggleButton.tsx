"use client";

import { GraduationCap } from "lucide-react";
import { useTrace } from "./TraceContext";

/**
 * Curator Workbench v2 — a DevTools-style floating launcher, not a header
 * button. The Learning Tracer is a development helper, not an Atlas
 * capability: it should be invisible until asked for, live in a fixed
 * corner regardless of scroll position, and never claim any of the page's
 * own width or layout — `fixed` positioning means this is true whether the
 * panel is open or closed, unlike a header button that permanently costs
 * horizontal space just by existing.
 *
 * The small dot mirrors the same "something happened, look when you're
 * ready" affordance real browser DevTools use for console warnings — it
 * never forces the panel open itself (`TraceContext.record` no longer does
 * that either), it just answers "did anything happen while this was
 * closed?"
 */
export function LearningTracerToggleButton() {
  const { toggleOpen, open, hasUnseen } = useTrace();
  return (
    <button
      type="button"
      onClick={toggleOpen}
      aria-label={open ? "Close Learning Tracer" : "Open Learning Tracer"}
      aria-pressed={open}
      className="border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 fixed right-4 bottom-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors"
    >
      <GraduationCap className="h-5 w-5" />
      {hasUnseen && !open && (
        <span className="bg-primary ring-background absolute top-1 right-1 h-2 w-2 rounded-full ring-2" />
      )}
    </button>
  );
}
