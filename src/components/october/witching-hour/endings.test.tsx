import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { rememberEncounter } from "@/lib/october/foundYou";
import { forgetEverything, readNightMemory } from "@/lib/october/remembers";

/**
 * **Every door at the end of the night goes somewhere.**
 *
 * Walked through the real component from the doorway (`startAt="doorway"`,
 * the screening shortcut), with the clock faked because the endings are
 * mostly written silence, Framer Motion replaced with plain elements, and the
 * synthesiser replaced with spies — so the one thing a renderer *can* judge
 * about sound is checked: which sounds each ending is allowed to make.
 */
vi.mock("framer-motion", () => {
  // Animation props are dropped; everything else reaches the element.
  const ANIMATION = new Set(["initial", "animate", "exit", "transition"]);
  const passthrough = (tag: string) =>
    function El({
      children,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) {
      const rest = Object.fromEntries(
        Object.entries(props).filter(([k]) => !ANIMATION.has(k)),
      );
      return React.createElement(tag, rest, children);
    };
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    // Reduced motion: the camera drift loop stays off, the night does not.
    useReducedMotion: () => true,
    motion: new Proxy({} as Record<string, unknown>, {
      get: (_t, tag: string) => passthrough(tag),
    }),
  };
});

const sound = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}),
  wind: vi.fn(),
  tick: vi.fn(),
  thump: vi.fn(),
  latch: vi.fn(),
  slam: vi.fn(),
  close: vi.fn(),
}));
vi.mock("./audio", () => ({
  createSound: () => ({ ...sound, ready: true }),
  pulse: () => false,
}));
// No phone in the room for these; pairing is never offered from the doorway.
vi.mock("./pairing", () => ({
  joinPairing: () => ({ send: () => {}, close: () => {} }),
  newCode: () => "ABCDEF",
}));

import { WitchingHour } from "./WitchingHour";

/** Advance in slices, collecting every line she says on the way. */
async function watch(ms: number, said: string[], slice = 200) {
  for (let t = 0; t < ms; t += slice) {
    await act(async () => {
      vi.advanceTimersByTime(slice);
    });
    for (const p of document.querySelectorAll("p.font-serif")) {
      const text = p.textContent ?? "";
      if (text && said.at(-1) !== text) said.push(text);
    }
  }
}

async function toDoorway(said: string[]) {
  render(<WitchingHour startAt="doorway" />);
  await act(async () => {
    screen.getByRole("button", { name: "Click to begin" }).click();
  });
  await watch(5000, said);
  expect(said).toContain("Still awake?");
}

async function choose(label: RegExp) {
  await act(async () => {
    screen.getByRole("button", { name: label }).click();
  });
}

const ended = () => screen.queryByTestId("night-ended");

beforeEach(() => {
  forgetEverything();
  vi.useFakeTimers();
  for (const spy of Object.values(sound)) spy.mockClear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
afterEach(() => {
  vi.useRealTimers();
  forgetEverything();
});

describe("Stay inside", () => {
  it("is still the door: one slam, Locked, and the surface", async () => {
    const said: string[] = [];
    await toDoorway(said);
    await choose(/^Stay inside/);
    await watch(14_000, said);
    expect(said).toContain("Locked.");
    expect(sound.slam).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("stay-inside")).toBeTruthy();
    expect(readNightMemory()).toEqual({ ended: "inside" });
  });
});

describe("Go outside", () => {
  it("keeps the light on, sends you out, and notices if you were quick", async () => {
    const said: string[] = [];
    await toDoorway(said);
    await choose(/^Go outside/);
    await watch(15_000, said);
    expect(said).toEqual(
      expect.arrayContaining([
        "Take a coat. I'll keep the light on.",
        "Ten minutes.",
        "Don't bring me.",
      ]),
    );
    // Gone, and nothing is waiting on a timer to bring you back.
    expect(ended()).toBeNull();
    await watch(20_000, said);
    expect(ended()).toBeNull();

    await act(async () => {
      screen.getByRole("button", { name: "I'm back" }).click();
    });
    await watch(14_000, said);
    expect(said).toContain("That wasn't ten minutes.");
    expect(said).not.toContain("You came back.");
    expect(said.at(-1)).toBe("Goodnight.");
    expect(ended()?.getAttribute("href")).toBe("/october");
    expect(ended()?.dataset.ending).toBe("outside");
    expect(readNightMemory()).toEqual({ ended: "outside" });
    expect(sound.slam).not.toHaveBeenCalled();
  });

  it("welcomes somebody who actually stayed out", async () => {
    const said: string[] = [];
    await toDoorway(said);
    await choose(/^Go outside/);
    await watch(15_000, said);
    await watch(11 * 60_000, said, 5000);
    await act(async () => {
      screen.getByRole("button", { name: "I'm back" }).click();
    });
    await watch(14_000, said);
    expect(said).toContain("You came back.");
    expect(said).toContain("The light stayed on.");
    expect(said).not.toContain("That wasn't ten minutes.");
  });

  it("is where she remembers Found You — only if it happened here", async () => {
    // Without a finished Found You, no callback.
    const strangers: string[] = [];
    await toDoorway(strangers);
    await choose(/^Go outside/);
    await watch(15_000, strangers);
    await act(async () => {
      screen.getByRole("button", { name: "I'm back" }).click();
    });
    await watch(14_000, strangers);
    expect(strangers).not.toContain("I didn't follow you this time.");
  });

  it("tells somebody she followed last time that she did not, this time", async () => {
    rememberEncounter({ number: "10", door: "LEAVE", hearing: "YES" });
    const said: string[] = [];
    await toDoorway(said);
    await choose(/^Go outside/);
    await watch(15_000, said);
    await act(async () => {
      screen.getByRole("button", { name: "I'm back" }).click();
    });
    await watch(16_000, said);
    expect(said).toContain("I didn't follow you this time.");
    // Said before goodnight, not instead of it.
    expect(said.indexOf("I didn't follow you this time.")).toBeLessThan(
      said.indexOf("Goodnight."),
    );
  });
});

describe("Tell me something", () => {
  it("makes it darker, tells something of hers, and goes black", async () => {
    const said: string[] = [];
    await toDoorway(said);
    await choose(/^Tell me something/);
    await watch(45_000, said);
    expect(said).toEqual(
      expect.arrayContaining([
        "Not tonight. Come back when it's darker.",
        "There.",
        "Darker.",
        "10 is me.",
        "12 brings me back.",
        "31, then everything goes black.",
      ]),
    );
    // One tick per window, the grammar the night already taught.
    expect(sound.tick).toHaveBeenCalledTimes(3);
    expect(said.at(-1)).toBe("That's all you get tonight.");
    expect(ended()?.dataset.ending).toBe("story");
    expect(readNightMemory()).toEqual({ ended: "story" });
    expect(sound.slam).not.toHaveBeenCalled();
  });
});

describe("Surprise me", () => {
  it("is silence and the same small sound, then the night given back", async () => {
    const said: string[] = [];
    await toDoorway(said);
    await choose(/^Surprise me/);
    // The wind goes away before anything else happens.
    await watch(3000, said);
    expect(sound.wind).toHaveBeenLastCalledWith(0, 3);
    await watch(40_000, said);
    expect(said).toEqual(
      expect.arrayContaining([
        "Then don't turn around.",
        "Most people turn around.",
        "Surprise.",
        "There was nothing behind you.",
      ]),
    );
    expect(said.at(-1)).toBe(
      "I just wanted someone to stay still with me for a minute.",
    );
    // Three ticks, all on the same side. Pressure, not impact.
    expect(sound.tick.mock.calls).toEqual([[-1], [-1], [-1]]);
    expect(sound.slam).not.toHaveBeenCalled();
    expect(sound.thump).not.toHaveBeenCalled();
    expect(ended()?.dataset.ending).toBe("surprise");
    expect(readNightMemory()).toEqual({ ended: "surprise" });
  });
});

describe("I've had enough", () => {
  it("lets them go kindly, with a door back", async () => {
    const said: string[] = [];
    await toDoorway(said);
    await choose(/^I've had enough/);
    await watch(6000, said);
    expect(said.at(-1)).toBe("Sleep well. October will still be here.");
    expect(ended()?.dataset.ending).toBe("escape");
    expect(readNightMemory()).toEqual({ ended: "escape" });
  });
});

describe("four doors, four nights", () => {
  it("ends every choice on a line of its own", async () => {
    const lasts: string[] = [];
    for (const [label, wait, back] of [
      [/^Go outside/, 30_000, true],
      [/^Tell me something/, 45_000, false],
      [/^Surprise me/, 45_000, false],
    ] as const) {
      const said: string[] = [];
      await toDoorway(said);
      await choose(label);
      await watch(back ? 15_000 : wait, said);
      if (back) {
        await act(async () => {
          screen.getByRole("button", { name: "I'm back" }).click();
        });
        await watch(14_000, said);
      }
      lasts.push(said.at(-1)!);
      cleanup();
    }
    expect(new Set(lasts).size).toBe(3);
  });
});
