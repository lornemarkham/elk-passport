"use client";

import { useEffect, useRef } from "react";

/**
 * A sequencer that can be abandoned.
 *
 * Every act is written as `await wait(ms)` between things that happen, which
 * reads like a shot list. Unmounting, or moving on, cancels the pending wait so
 * a stale act cannot fire a light or a sound into a scene that has moved on.
 */
export function useTimeline() {
  const alive = useRef(true);
  const pending = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    alive.current = true;
    const set = pending.current;
    return () => {
      alive.current = false;
      for (const cancel of set) cancel();
      set.clear();
    };
  }, []);

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!alive.current) return;
      const id = setTimeout(() => {
        pending.current.delete(cancel);
        resolve();
      }, ms);
      const cancel = () => {
        clearTimeout(id);
        resolve();
      };
      pending.current.add(cancel);
    });
  }

  /** Resolves when `signal` is called, or after `ms` if it never is. */
  function waitFor(ms: number): {
    promise: Promise<boolean>;
    signal: () => void;
  } {
    let signal: () => void = () => {};
    const promise = new Promise<boolean>((resolve) => {
      const id = setTimeout(() => {
        pending.current.delete(cancel);
        resolve(false);
      }, ms);
      const cancel = () => {
        clearTimeout(id);
        resolve(false);
      };
      pending.current.add(cancel);
      signal = () => {
        clearTimeout(id);
        pending.current.delete(cancel);
        resolve(true);
      };
    });
    return { promise, signal };
  }

  return { wait, waitFor, isAlive: () => alive.current };
}
