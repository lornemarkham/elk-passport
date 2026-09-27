import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FoundYou } from "./FoundYou";
import { forgetOctober, readOctoberMemory } from "@/lib/october/foundYou";

/**
 * **Walking the whole encounter, twice.**
 *
 * Framer Motion is replaced with plain elements. The animation is not what is
 * being tested, and `AnimatePresence`'s exit handling needs real frames — with
 * fake timers it simply never finishes, which would make every assertion here
 * a coin toss rather than a check.
 *
 * The clock is faked because the encounter is mostly silence. Advancing it is
 * the only way to prove the silences end where they are supposed to.
 */
vi.mock("framer-motion", () => {
  const passthrough = (tag: string) =>
    function El({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...rest
    }: Record<string, unknown> & { children?: React.ReactNode }) {
      return React.createElement(tag, rest, children);
    };
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    useReducedMotion: () => false,
    motion: new Proxy({} as Record<string, unknown>, {
      get: (_t, tag: string) => passthrough(tag),
    }),
  };
});

import React from "react";

/**
 * Push the clock far enough that any written pause has elapsed.
 *
 * Sliced rather than advanced in one jump: each beat schedules the next one
 * from an effect, and an effect cannot run until React has re-rendered. A
 * single large advance fires every *pending* timer and then finds nothing
 * left, because the timer after it had not been created yet.
 */
async function settle(ms = 30_000, slice = 500) {
  for (let elapsed = 0; elapsed < ms; elapsed += slice) {
    await act(async () => {
      vi.advanceTimersByTime(slice);
    });
  }
}

async function press(name: string) {
  await act(async () => {
    screen.getByRole("button", { name }).click();
  });
}

const phase = () => screen.getByTestId("found-you").dataset.phase;

describe("October found you", () => {
  beforeEach(() => {
    forgetOctober();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    forgetOctober();
  });

  it("does not claim to remember a first-time visitor", async () => {
    render(<FoundYou />);
    await act(async () => {});
    expect(screen.queryByText("I remember you.")).toBeNull();
    // And the opening is the opening, not a greeting.
    await settle(3000);
    expect(screen.getByText("You found a way out.")).toBeTruthy();
  });

  it("plays through, recalls the choice actually made, and ends on the line", async () => {
    render(<FoundYou />);
    await settle();

    expect(phase()).toBe("number");
    await press("12");
    await settle();

    expect(phase()).toBe("door");
    await press("LEAVE");
    await act(async () => {});

    // The software-sounding recall, and it must match the press exactly.
    expect(screen.getByText("You chose LEAVE.")).toBeTruthy();
    expect(screen.queryByText("You chose STAY.")).toBeNull();
    await settle();

    expect(phase()).toBe("hearing");
    await press("NO");
    await act(async () => {});
    expect(screen.getByText("That's okay.")).toBeTruthy();
    await settle(4000);
    expect(screen.getByText("They couldn't either.")).toBeTruthy();

    // Earned, one at a time.
    await settle(5000);
    expect(screen.getByText("They didn't see me.")).toBeTruthy();
    await settle(4000);
    expect(screen.getByText("They didn't hear me.")).toBeTruthy();
    await settle(4000);
    expect(screen.getByText("They walked right by me.")).toBeTruthy();

    // Then the same fact, wearing a different coat.
    await settle(6000);
    expect(screen.getByText("That's what you chose last time.")).toBeTruthy();

    await settle();
    expect(phase()).toBe("exit");
    await press("EXIT");

    // Black, and it has to actually last.
    expect(phase()).toBe("black");
    await settle(3000);
    expect(phase()).toBe("black");

    await settle(4000);
    expect(screen.getByText("You found the way out.")).toBeTruthy();
    await settle(4000);
    expect(screen.getByText("I couldn't.")).toBeTruthy();
    await settle(5000);
    expect(screen.getByText("So I followed you.")).toBeTruthy();
  });

  it("takes the other hearing branch when the visitor says yes", async () => {
    render(<FoundYou />);
    await settle();
    await press("10");
    await settle();
    await press("STAY");
    await act(async () => {});
    expect(screen.getByText("You chose STAY.")).toBeTruthy();
    await settle();
    await press("YES");
    await act(async () => {});
    expect(screen.getByText("Oh.")).toBeTruthy();
    expect(screen.queryByText("That's okay.")).toBeNull();
    await settle(3000);
    expect(screen.getByText("You can.")).toBeTruthy();
  });

  it("keeps the encounter only once it has reached the ending", async () => {
    render(<FoundYou />);
    await settle();
    await press("31");
    await settle();
    await press("LEAVE");
    await settle();
    await press("NO");
    await settle(40_000);

    // Still nothing kept: she has not finished with them yet.
    expect(readOctoberMemory().found).toBe(false);

    await press("EXIT");
    await settle(10_000);

    expect(readOctoberMemory()).toEqual({
      found: true,
      number: "31",
      door: "LEAVE",
      hearing: "NO",
    });
  });

  it("recognises somebody it has met, on the way in", async () => {
    // Finish one encounter.
    const first = render(<FoundYou />);
    await settle();
    await press("10");
    await settle();
    await press("STAY");
    await settle();
    await press("YES");
    await settle(40_000);
    await press("EXIT");
    await settle(10_000);
    expect(readOctoberMemory().found).toBe(true);
    first.unmount();

    // Come back.
    render(<FoundYou />);
    await act(async () => {});
    expect(screen.getByText("I remember you.")).toBeTruthy();
  });

  it("stops recognising them once the state is cleared", async () => {
    const first = render(<FoundYou />);
    await settle();
    await press("12");
    await settle();
    await press("LEAVE");
    await settle();
    await press("NO");
    await settle(40_000);
    await press("EXIT");
    await settle(10_000);
    first.unmount();

    forgetOctober();

    render(<FoundYou />);
    await act(async () => {});
    expect(screen.queryByText("I remember you.")).toBeNull();
  });
});
