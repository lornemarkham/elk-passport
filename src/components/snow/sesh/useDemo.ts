"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { apply, type Action } from "@/domain/snow/sesh/actions";
import { DEMO_YOU, crowdVotes, demoWorld } from "@/domain/snow/sesh/demo";
import type { Viewer, World } from "@/domain/snow/sesh/model";
import { VOTING_MS, visibleTo } from "@/domain/snow/sesh/rules";

/**
 * **Demo Mode's memory: this phone only.**
 *
 * What's kept is tiny — when the demo began, how far the visitor has skipped
 * ahead, and the list of things they did — and the world is rebuilt from the
 * fictional seed by replaying that list through the real rules. Nothing goes
 * to a server, so the demo can never mix with real riders. After twelve
 * hours away it starts fresh, so the fictional mountain is always mid-sesh.
 */
const KEY = "passport.sesh-wars.demo.v1";
const STALE_MS = 12 * 3_600_000;

type Entry = { action: Action; at: number } | { skip: number; at: number };
interface Saved {
  t0: number;
  offset: number;
  log: Entry[];
}

export const DEMO_VIEWER: Viewer = {
  riderId: DEMO_YOU,
  signedIn: true,
  ageGroup: "adult",
};

function fresh(): Saved {
  return { t0: Date.now(), offset: 0, log: [] };
}

function parse(raw: string): Saved | null {
  try {
    const s = JSON.parse(raw) as Saved;
    if (
      typeof s.t0 !== "number" ||
      typeof s.offset !== "number" ||
      !Array.isArray(s.log)
    )
      return null;
    return Date.now() - s.t0 > STALE_MS ? null : s;
  } catch {
    return null;
  }
}

function read(): Saved {
  return parse(snapshot() ?? "") ?? fresh();
}

/** Rebuild the world from the seed and the visitor's log. Pure. */
export function replay(saved: Saved): World {
  let world = demoWorld(saved.t0);
  let n = 0;
  const newId = () => `y${(n++).toString(36)}`;
  const reports: Record<string, string[]> = {};
  for (const e of saved.log) {
    if ("skip" in e) {
      world = {
        ...world,
        votes: [...world.votes, ...crowdVotes(world, e.at, e.at + e.skip)],
      };
      continue;
    }
    const r = apply(world, DEMO_VIEWER, e.action, e.at, newId, reports);
    if (r.ok) world = r.world;
  }
  return world;
}

export interface DemoHandle {
  ready: boolean;
  world: World;
  now: number;
  /** Do something; returns the id it made (clip, challenge) or why not. */
  act(
    a: Action,
  ):
    | { ok: true; created?: string; world: World }
    | { ok: false; reason: string };
  /** Skip to the end of the voting window: the crowd votes, crowns are handed out. */
  skip(): { world: World; now: number } | null;
  reset(): void;
  skippedHours: number;
}

/**
 * The saved demo lives in localStorage; React reads it as an external store
 * (the raw string is the snapshot, so it is stable between renders). A
 * private-mode browser that refuses storage keeps it in memory instead.
 */
let memory: string | null = null;
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
function snapshot(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}
function write(s: Saved) {
  memory = JSON.stringify(s);
  try {
    window.localStorage.setItem(KEY, memory);
  } catch {
    /* private mode: the demo still works for this visit */
  }
  listeners.forEach((fn) => fn());
}
const clock = () => Date.now();

export function useDemo(): DemoHandle {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const saved = useMemo<Saved | null>(() => (raw ? parse(raw) : null), [raw]);
  const [now, setNow] = useState(0);

  // First visit, or a stale demo: start the fictional mountain now.
  useEffect(() => {
    if (!saved) write(read());
  }, [saved]);
  useEffect(() => {
    const t0 = window.setTimeout(() => setNow(clock()), 0);
    const t = window.setInterval(() => setNow(clock()), 30_000);
    return () => (window.clearTimeout(t0), window.clearInterval(t));
  }, [raw]);

  const persist = useCallback((s: Saved) => write(s), []);
  const world = useMemo(() => (saved ? replay(saved) : demoWorld(0)), [saved]);
  const nowOnHill = (now || saved?.t0 || 0) + (saved?.offset ?? 0);

  const act = useCallback(
    (a: Action) => {
      if (!saved) return { ok: false as const, reason: "One moment…" };
      const at = Date.now() + saved.offset;
      const probe = { ...saved, log: [...saved.log, { action: a, at }] };
      const r = apply(replay(saved), DEMO_VIEWER, a, at, () => "probe");
      if (!r.ok) return r;
      persist(probe);
      // Find the real id the replay gave the thing just made.
      const after = replay(probe);
      let created: string | undefined;
      if (a.type === "post") {
        created = a.answerTo
          ? after.challenges[after.challenges.length - 1]?.id
          : after.clips[after.clips.length - 1]?.id;
      } else if (a.type === "chirp")
        created = after.chirps[after.chirps.length - 1]?.id;
      return { ok: true as const, created, world: after };
    },
    [saved, persist],
  );

  const skip = useCallback(() => {
    if (!saved) return null;
    const at = Date.now() + saved.offset;
    const next = {
      ...saved,
      offset: saved.offset + VOTING_MS + 60_000,
      log: [...saved.log, { skip: VOTING_MS + 60_000, at }],
    };
    persist(next);
    return { world: replay(next), now: at + VOTING_MS + 60_000 };
  }, [saved, persist]);

  const reset = useCallback(() => persist(fresh()), [persist]);

  return {
    ready: saved !== null && now > 0,
    world: visibleTo(world, DEMO_VIEWER),
    now: nowOnHill,
    act,
    skip,
    reset,
    skippedHours: Math.round((saved?.offset ?? 0) / 3_600_000),
  };
}
