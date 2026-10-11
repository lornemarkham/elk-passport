import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { OfflineDay } from "@/lib/detox/day";
import { challengeById, deal } from "@/lib/detox/pact";
import { comeBack, leave, newOuting } from "@/lib/detox/outing";
import { defaultPact } from "@/lib/detox/pact";
import { forgetOffline, writeOffline } from "@/lib/detox/store";
import { GoOffline } from "./GoOffline";

/**
 * **Go Offline is the end of planning, not a second front door.**
 *
 * Pinned: a handed-over day is said back as "that's the plan" and kept on
 * the phone when the phones go away; with no day there is one way to plan,
 * `/go`, and no doors of its own; the pact is opt-in and leaves nothing
 * behind when skipped; and somebody already out is offered the way back in.
 */
const KEY = "ghad.offline";
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "null");

const DAY: OfflineDay = {
  said: "four hours, outdoors",
  stops: [
    { id: "a", name: "Kalamalka Lake", where: "Vernon", minutes: 90 },
    { id: "b", name: "Davison Orchards", minutes: 60 },
  ],
  print: "stops=a%2Cb&say=four+hours%2C+outdoors",
};

beforeEach(() => {
  window.localStorage.clear();
  forgetOffline();
});

describe("GoOffline, with a day handed over", () => {
  it("says planning is finished and lists the plan", () => {
    render(<GoOffline day={DAY} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /That's\s*the plan\./,
    );
    expect(screen.getByTestId("offline-done").textContent).toMatch(
      /nothing left to decide on a screen/,
    );
    const stops = screen.getAllByTestId("offline-plan-stop");
    expect(stops.map((li) => li.textContent)).toEqual([
      "1Kalamalka Lake · Vernon",
      "2Davison Orchards",
    ]);
    expect(screen.getByTestId("offline-print-again")).toHaveAttribute(
      "href",
      `/go/print?${DAY.print}`,
    );
  });

  it("keeps the day on the phone when the phones go away — and no pact", () => {
    render(<GoOffline day={DAY} />);
    expect(stored()).toBeNull();
    fireEvent.click(screen.getByTestId("offline-go"));
    const current = stored().current;
    expect(current.leftAt).toEqual(expect.any(String));
    expect(current.day).toEqual(DAY);
    expect(current.pact).toBeUndefined();
  });

  it("says when the stops could not be looked up, and still lets you go", () => {
    render(<GoOffline unreachable />);
    expect(screen.getByTestId("offline-unreachable").textContent).toMatch(
      /The paper has all of it/,
    );
    fireEvent.click(screen.getByTestId("offline-go"));
    expect(stored().current.day).toBeUndefined();
  });
});

describe("GoOffline, with no day", () => {
  it("sends planning to /go and has no planner of its own", () => {
    render(<GoOffline />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Got a\s*plan\?/,
    );
    expect(screen.getByTestId("offline-plan-first")).toHaveAttribute(
      "href",
      "/go",
    );
    const planners = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/go"));
    expect(planners).toEqual(["/go"]);
  });

  it("shows the day already kept, if there is one", () => {
    writeOffline({ current: newOuting({ day: DAY }), past: [] });
    render(<GoOffline />);
    expect(screen.getAllByTestId("offline-plan-stop")).toHaveLength(2);
  });
});

describe("the pact", () => {
  it("is not dealt until somebody asks for it", () => {
    render(<GoOffline day={DAY} />);
    expect(screen.queryByTestId("offline-card")).toBeNull();
    expect(screen.getByTestId("offline-stake-sentence").textContent).toBe(
      "Nothing to remember. That's what the paper is for.",
    );
  });

  it("deals a hand, deals again, remembers it, and can be dropped", () => {
    const { unmount } = render(<GoOffline />);
    fireEvent.click(screen.getByTestId("offline-make-pact"));
    const hand = () =>
      screen.getAllByTestId("offline-card").map((li) => li.textContent);
    const first = hand();
    expect(first).toHaveLength(3);
    expect(first[0]).toContain(challengeById(deal(1)[0]!.id)!.line);

    fireEvent.click(screen.getByTestId("offline-redeal"));
    fireEvent.click(screen.getByTestId("offline-stake-dishes"));
    fireEvent.click(screen.getByTestId("offline-phone-home"));
    const second = hand();
    expect(second).not.toEqual(first);
    expect(screen.getByTestId("offline-stake-sentence").textContent).toMatch(
      /does tonight's dishes/,
    );

    unmount();
    forgetOffline();
    render(<GoOffline />);
    expect(hand()).toEqual(second);
    expect(screen.getByTestId("offline-phone-home")).toBeChecked();
    expect(stored().current.pact.stake).toBe("dishes");

    fireEvent.click(screen.getByTestId("offline-drop-pact"));
    expect(screen.queryByTestId("offline-card")).toBeNull();
    expect(stored().current.pact).toBeUndefined();
  });
});

describe("GoOffline, around the outing", () => {
  it("starts the outing on Phones away, and promises not to buzz", () => {
    render(<GoOffline />);
    const go = screen.getByTestId("offline-go");
    expect(go).toHaveAttribute("href", "/detox/out");
    expect(go.parentElement!.textContent).toMatch(/We won't buzz you/);
    fireEvent.click(go);
    expect(stored().current.leftAt).toEqual(expect.any(String));
  });

  it("offers the way back to somebody who is already out", () => {
    writeOffline({
      current: leave(newOuting({ pact: defaultPact() }), new Date()),
      past: [],
    });
    render(<GoOffline />);
    expect(screen.getByTestId("offline-out-banner")).toHaveAttribute(
      "href",
      "/detox/back",
    );
  });

  it("puts past postcards on the fridge, and nothing when there are none", () => {
    const { unmount } = render(<GoOffline />);
    expect(screen.queryByTestId("offline-fridge")).toBeNull();
    unmount();

    const done = comeBack(newOuting({ pact: defaultPact() }), new Date(), {
      pulledOff: [],
      cracked: "",
      unplanned: "the pie stand",
    });
    writeOffline({ past: [done] });
    render(<GoOffline />);
    expect(screen.getByTestId("offline-fridge").textContent).toContain(
      "Not on the paper: the pie stand",
    );
  });
});
