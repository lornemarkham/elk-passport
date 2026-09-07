import type { ExperienceState } from "./types";

/**
 * Persistence — deliberately the smallest possible thing behind a seam.
 *
 * The lab stores what a group did in this browser and nowhere else. That is a
 * real limitation and it is stated in the UI rather than hidden: two people
 * on two phones are not in the same experience yet.
 *
 * What matters architecturally is the *shape*. Everything above this file
 * already talks in terms of "a participant id did a thing at a time", and
 * reads through a subscribe/snapshot interface rather than by touching
 * storage. Swapping `localStorage` for a server — and `emit()` for a
 * websocket — is a change to this file only. That is the whole reason it
 * exists as a store rather than as a `useState` in a component.
 */

const VERSION = 1;
const key = (slug: string) => `passport-experience-lab:v${VERSION}:${slug}`;

export function emptyState(slug: string): ExperienceState {
  return {
    slug,
    meId: null,
    joinedIds: [],
    responses: [],
    moments: [],
    addedOptions: [],
    addedPrompts: [],
    reactions: {},
    lurking: false,
    brief: null,
    myEdge: null,
    cues: [],
    consented: [],
    declined: [],
    nowOverride: null,
  };
}

export interface Snapshot {
  readonly state: ExperienceState;
  /** False until storage has actually been read. The server always sees false. */
  readonly hydrated: boolean;
}

function read(slug: string): ExperienceState {
  if (typeof window === "undefined") return emptyState(slug);
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return emptyState(slug);
    const parsed = JSON.parse(raw) as Partial<ExperienceState>;
    return { ...emptyState(slug), ...parsed, slug };
  } catch {
    return emptyState(slug);
  }
}

function write(state: ExperienceState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(state.slug), JSON.stringify(state));
  } catch {
    // A full or blocked storage must never take the page down with it.
  }
}

class ExperienceStore {
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private readonly server: Snapshot;

  constructor(private readonly slug: string) {
    this.server = { state: emptyState(slug), hydrated: false };
    this.snapshot = this.server;
  }

  getSnapshot = (): Snapshot => this.snapshot;
  /** Constant identity, so server and first client render agree exactly. */
  getServerSnapshot = (): Snapshot => this.server;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.snapshot.hydrated) {
      this.snapshot = { state: read(this.slug), hydrated: true };
      // The subscriber that triggered hydration has not been told yet.
      queueMicrotask(() => this.emit());
    }
    return () => {
      this.listeners.delete(listener);
    };
  };

  update = (change: (state: ExperienceState) => ExperienceState): void => {
    const next = change(this.snapshot.state);
    if (next === this.snapshot.state) return;
    this.snapshot = { state: next, hydrated: true };
    write(next);
    this.emit();
  };

  reset = (): void => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key(this.slug));
      } catch {
        // As above.
      }
    }
    this.snapshot = { state: emptyState(this.slug), hydrated: true };
    this.emit();
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

const stores = new Map<string, ExperienceStore>();

/** One store per experience, shared by every component that reads it. */
export function experienceStore(slug: string): ExperienceStore {
  const existing = stores.get(slug);
  if (existing) return existing;
  const created = new ExperienceStore(slug);
  stores.set(slug, created);
  return created;
}

export type { ExperienceStore };
