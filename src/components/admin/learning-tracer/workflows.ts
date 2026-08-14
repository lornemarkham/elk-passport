/**
 * SUPERSEDED — not imported anywhere.
 *
 * This file held the original `WorkflowTrace`/`ArchitectureStep` model
 * (workflow-specific rendering, one bespoke object per traced action).
 * It was replaced by the generic, event-driven model in `traceActions.ts`
 * (`TraceEvent`/`TraceAction`), which `LearningTracerPanel.tsx` now renders
 * uniformly with no per-action branches.
 *
 * Left in place, empty, rather than deleted — this workspace's tooling
 * couldn't remove the file directly. Safe to delete by hand; nothing
 * references it.
 */
export {};
