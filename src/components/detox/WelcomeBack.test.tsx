import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { defaultPact } from "@/lib/detox/pact";
import type { OfflineDay } from "@/lib/detox/day";
import { leave, newOuting } from "@/lib/detox/outing";
import { forgetOffline, writeOffline } from "@/lib/detox/store";
import { PocketScreen } from "./PocketScreen";
import { WelcomeBack } from "./WelcomeBack";

/**
 * **The way out is one button, and the way back in ends in a postcard.**
 */
const KEY = "ghad.offline";
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "null");
const pact = defaultPact();
const DAY: OfflineDay = {
  said: "four hours",
  stops: [
    { id: "a", name: "Kalamalka Lake", where: "Vernon", minutes: 90 },
    { id: "b", name: "Davison Orchards", minutes: 60 },
  ],
  print: "stops=a%2Cb",
};

beforeEach(() => {
  window.localStorage.clear();
  forgetOffline();
});

describe("PocketScreen", () => {
  it("says the pact once and offers only the way back", () => {
    writeOffline({ current: leave(newOuting({ pact }), new Date()), past: [] });
    render(<PocketScreen />);
    expect(screen.getAllByTestId("offline-pocket-card")).toHaveLength(3);
    expect(screen.getByTestId("offline-since").textContent).toMatch(
      /Phones away since/,
    );
    // en-CA says "a.m." — the sentence must not end in "a.m..".
    expect(screen.getByTestId("offline-since").textContent).not.toMatch(/\.\./);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByTestId("offline-back")).toHaveAttribute(
      "href",
      "/detox/back",
    );
  });

  it("keeps the day folded away, with no links in it", () => {
    writeOffline({
      current: leave(newOuting({ day: DAY }), new Date()),
      past: [],
    });
    render(<PocketScreen />);
    const kept = screen.getByTestId("offline-pocket-day");
    expect(kept.tagName).toBe("DETAILS");
    expect(kept).not.toHaveAttribute("open");
    expect(screen.getAllByTestId("offline-pocket-stop")).toHaveLength(2);
    expect(kept.querySelector("a")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("still works with no pact at all", () => {
    render(<PocketScreen />);
    expect(screen.queryByTestId("offline-pocket-card")).toBeNull();
    expect(screen.getByTestId("offline-back")).toBeTruthy();
  });
});

describe("WelcomeBack", () => {
  it("asks about the pact, makes the postcard, and files the outing", () => {
    const left = new Date(Date.now() - 3 * 60 * 60_000 - 5 * 60_000);
    writeOffline({ current: leave(newOuting({ pact }), left), past: [] });
    render(<WelcomeBack />);

    expect(screen.getByTestId("offline-away").textContent).toMatch(
      /away for 3 hours and 5 minutes/,
    );
    fireEvent.click(screen.getByTestId(`offline-did-${pact.challenges[0]}`));
    fireEvent.click(screen.getByTestId(`offline-did-${pact.challenges[1]}`));
    fireEvent.change(screen.getByTestId("offline-cracked"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByTestId("offline-unplanned"), {
      target: { value: "a dog called Biscuit" },
    });
    fireEvent.click(screen.getByTestId("offline-make-postcard"));

    const card = screen.getByTestId("offline-postcard").textContent!;
    expect(card).toContain("Two out of three. Respectable.");
    expect(card).toContain("Sam cracked first.");
    expect(card).toContain("Not on the paper: a dog called Biscuit");
    // The next one starts back in GO HAVE A DAY, not in a separate product.
    expect(screen.getByTestId("offline-another")).toHaveAttribute(
      "href",
      "/go",
    );

    const state = stored();
    expect(state.current).toBeUndefined();
    expect(state.past).toHaveLength(1);
    expect(state.past[0].back.cracked).toBe("Sam");
  });

  it("with no pact, asks nothing about one, and remembers who was there", () => {
    writeOffline({
      current: leave(newOuting({ day: DAY }), new Date()),
      past: [],
    });
    render(<WelcomeBack />);
    expect(screen.getByTestId("offline-back-plan").textContent).toContain(
      "The plan was Kalamalka Lake → Davison Orchards.",
    );
    expect(screen.queryByTestId("offline-cracked")).toBeNull();
    expect(screen.queryByText(/Which ones did you pull off/)).toBeNull();
    fireEvent.change(screen.getByTestId("offline-company"), {
      target: { value: "  Sam and the dog " },
    });
    fireEvent.click(screen.getByTestId("offline-make-postcard"));

    const card = screen.getByTestId("offline-postcard").textContent!;
    expect(card).toContain("The plan: Kalamalka Lake → Davison Orchards.");
    expect(card).toContain("With Sam and the dog.");
    expect(card).not.toMatch(/cracked/);
    expect(stored().past[0].back.company).toBe("Sam and the dog");
  });

  it("welcomes somebody who never pressed Phones away", () => {
    render(<WelcomeBack />);
    expect(screen.queryByText(/Which ones did you pull off/)).toBeNull();
    fireEvent.click(screen.getByTestId("offline-make-postcard"));
    expect(screen.getByTestId("offline-postcard").textContent).toContain(
      "You went. That was the whole idea.",
    );
  });
});
