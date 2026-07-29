/**
 * Interaction signal log (IMP-004 "Analytics and Learning Signals"). Product
 * learning events only — filter/save/reject/shelf/restore/broaden/session
 * activity — recorded locally so this and future IMPs can answer questions
 * like "how often are rejected items restored?" without wiring a real
 * analytics backend yet. Explicitly not a personalization system: nothing
 * here changes discovery behaviour on its own (see Open Question 9 in the
 * IMP and the completion report — using these signals for cross-session
 * personalization is deferred to a follow-up IMP).
 */
export type ExperienceInteractionAction =
  "view" | "save" | "reject" | "shelf" | "restore";

export interface ExperienceInteraction {
  experienceId: string;
  action: ExperienceInteractionAction;
  sessionId: string;
  occurredAt: string;
  source: "touch" | "mouse" | "keyboard" | "filter" | "text" | "voice";
}

export type DiscoveryLearningEvent =
  | { type: "filter_applied"; sessionId: string; occurredAt: string }
  | { type: "filter_removed"; sessionId: string; occurredAt: string }
  | {
      type: "result_count_changed";
      sessionId: string;
      occurredAt: string;
      count: number;
    }
  | { type: "mood_board_opened"; sessionId: string; occurredAt: string }
  | {
      type: "mood_board_item_removed";
      sessionId: string;
      occurredAt: string;
      experienceId: string;
    }
  | {
      type: "discovery_broadened";
      sessionId: string;
      occurredAt: string;
      strategy: string;
    }
  | { type: "session_reset"; sessionId: string; occurredAt: string };

export type DiscoveryEvent = ExperienceInteraction | DiscoveryLearningEvent;

const STORAGE_KEY = "elk-passport:discovery-space:events";
const MAX_EVENTS = 500;

function readLog(): DiscoveryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DiscoveryEvent[]) : [];
  } catch {
    return [];
  }
}

/**
 * Appends one event to a capped local log. Fire-and-forget by design — a
 * logging failure must never break discovery itself.
 */
export function logDiscoveryEvent(event: DiscoveryEvent): void {
  if (typeof window === "undefined") return;
  try {
    const next = [...readLog(), event].slice(-MAX_EVENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
}

export function readDiscoveryEventLog(): DiscoveryEvent[] {
  return readLog();
}
