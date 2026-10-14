"use client";

/**
 * **Keep the phone awake while it is a prop.**
 *
 * A phone face down on a table for twenty-four seconds locks itself, and a
 * locked phone cannot receive the cue that makes the whole trick work. The
 * Screen Wake Lock API is the standards answer and it is real on the platforms
 * that matter: Android Chrome, and iOS Safari from 16.4. It must be requested
 * from a user gesture, and the browser silently releases it whenever the page
 * is hidden — so it is re-acquired on every return to visibility.
 *
 * Where it does not exist (older iOS, some in-app browsers) the answer is
 * `false`, and the scene says so rather than pretending. The screen is black
 * either way; the lock only stops the OS from turning it off.
 */
export interface WakeLockHandle {
  readonly supported: boolean;
  release: () => void;
}

export async function keepAwake(): Promise<WakeLockHandle> {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
  };

  if (!nav.wakeLock) {
    return { supported: false, release: () => {} };
  }

  let sentinel: WakeLockSentinel | null = null;

  const acquire = async () => {
    try {
      sentinel = await nav.wakeLock!.request("screen");
    } catch {
      sentinel = null;
    }
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") void acquire();
  };

  await acquire();
  document.addEventListener("visibilitychange", onVisible);

  return {
    supported: sentinel !== null,
    release: () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
      sentinel = null;
    },
  };
}
