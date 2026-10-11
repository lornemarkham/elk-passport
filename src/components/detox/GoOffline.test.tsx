import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OFFLINE_MODES } from "@/components/go/modes";
import { challengeById, deal } from "@/lib/detox/pact";
import { comeBack, leave, newOuting } from "@/lib/detox/outing";
import { defaultPact } from "@/lib/detox/pact";
import { forgetOffline, writeOffline } from "@/lib/detox/store";
import { GoOffline } from "./GoOffline";

/**
 * **The front door hands planning to /go, and keeps the pact.**
 *
 * Pinned: every door is one of `OFFLINE_MODES` and opens `/go` with it —
 * this page must not grow its own planner; the pact survives a reload;
 * "Phones away" starts the outing; and somebody already out is offered the
 * way back in.
 */
const KEY = "ghad.offline";
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "null");

beforeEach(() => {
  window.localStorage.clear();
  forgetOffline();
});

describe("GoOffline", () => {
  it("explains the idea in three steps", () => {
    render(<GoOffline />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Plan it\.\s*Print it\.\s*Go\./,
    );
    for (const step of ["Plan it", "Print it", "Go"])
      expect(
        screen.getByRole("heading", { level: 3, name: step }),
      ).toBeTruthy();
  });

  it("opens /go with each existing mode, and links to /go to say it freely", () => {
    render(<GoOffline />);
    for (const mode of OFFLINE_MODES) {
      expect(
        screen.getByTestId(`offline-door-${mode.id}`).getAttribute("href"),
      ).toBe(`/go?mode=${mode.id}`);
    }
    expect(
      screen.getByRole("link", { name: "say it in your own words" }),
    ).toHaveAttribute("href", "/go");
  });

  it("deals a hand, deals again, and remembers the pact", () => {
    const { unmount } = render(<GoOffline />);
    const hand = () =>
      screen.getAllByTestId("offline-card").map((li) => li.textContent);
    const first = hand();
    expect(first).toHaveLength(3);
    expect(first[0]).toContain(challengeById(deal(1)[0]!.id)!.line);

    fireEvent.click(screen.getByTestId("offline-redeal"));
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
  });

  it("starts the outing on Phones away", () => {
    render(<GoOffline />);
    const go = screen.getByTestId("offline-go");
    expect(go).toHaveAttribute("href", "/detox/out");
    fireEvent.click(go);
    expect(stored().current.leftAt).toEqual(expect.any(String));
  });

  it("offers the way back to somebody who is already out", () => {
    writeOffline({
      current: leave(newOuting(defaultPact()), new Date()),
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

    const done = comeBack(newOuting(defaultPact()), new Date(), {
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
