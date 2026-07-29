import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Node's own native `localStorage` global (unrelated to jsdom's) ships
// unconfigured and non-functional ("--localstorage-file was provided
// without a valid path") on the Node version this repo runs, and it
// shadows jsdom's real implementation in this environment. Replace it with
// a small in-memory Storage so any test touching localStorage gets
// deterministic, working behavior regardless of Node/jsdom version quirks.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

afterEach(() => {
  cleanup();
  globalThis.localStorage.clear();
});

// jsdom does not implement matchMedia at all. usePrefersReducedMotion (used
// directly by DiscoveryCard as of IMP-005, not just indirectly via
// usePeripheralTemptation) calls it unconditionally on mount, so any test
// rendering a real DiscoveryCard needs this to exist. Defaults to "not
// reduced" — the sensible default for a test environment with no real user
// preference to read.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
