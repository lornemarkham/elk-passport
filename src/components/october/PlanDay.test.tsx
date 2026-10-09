import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * **A list of things to look forward to should not read as a form.**
 *
 * An empty `<input type="date">` paints `yyyy-mm-dd` in Chrome, so every
 * undated film and Doing in My October showed a line of database format where
 * a plan belongs. These pin the control's two states and the one date it
 * volunteers — and that giving a day still saves exactly what it saved before.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("sonner", () => ({ toast: { error: () => {} } }));

const planFor = vi.fn<(id: string, day: string | null) => Promise<void>>(
  async () => {},
);
vi.mock("@/lib/october/october-repo", () => ({
  planFor: (id: string, day: string | null) => planFor(id, day),
}));

const { PlanDay } = await import("./PlanDay");

beforeEach(() => planFor.mockClear());

describe("a thing with no day yet", () => {
  it("asks in words rather than showing a date field", () => {
    render(<PlanDay entityId="e1" today="2026-10-09" />);
    expect(screen.getByTestId("plan-ask")).toHaveTextContent("Give it a day");
    expect(screen.queryByTestId("plan-day")).toBeNull();
  });

  it("opens on today, which is the answer most often wanted", () => {
    render(<PlanDay entityId="e1" today="2026-10-09" />);
    fireEvent.click(screen.getByTestId("plan-ask"));
    expect(screen.getByTestId("plan-day")).toHaveValue("2026-10-09");
  });

  it("can be put away again without having set anything", () => {
    render(<PlanDay entityId="e1" today="2026-10-09" />);
    fireEvent.click(screen.getByTestId("plan-ask"));
    fireEvent.click(screen.getByTestId("plan-clear"));
    expect(screen.getByTestId("plan-ask")).toBeInTheDocument();
    // Nothing was asked for, so nothing was written.
    expect(planFor).not.toHaveBeenCalled();
  });
});

describe("a thing that already has a day", () => {
  it("shows the day it has, with no extra tap", () => {
    render(<PlanDay entityId="e1" day="2026-10-24" today="2026-10-09" />);
    expect(screen.getByTestId("plan-day")).toHaveValue("2026-10-24");
    expect(screen.queryByTestId("plan-ask")).toBeNull();
  });

  it("still saves a change", () => {
    render(<PlanDay entityId="e1" day="2026-10-24" today="2026-10-09" />);
    fireEvent.change(screen.getByTestId("plan-day"), {
      target: { value: "2026-10-25" },
    });
    expect(planFor).toHaveBeenCalledWith("e1", "2026-10-25");
  });

  it("still clears back to no date", () => {
    render(<PlanDay entityId="e1" day="2026-10-24" today="2026-10-09" />);
    fireEvent.click(screen.getByTestId("plan-clear"));
    expect(planFor).toHaveBeenCalledWith("e1", null);
  });

  it("refuses a second write while the first is still in flight", async () => {
    // Both controls read the same `busy`, so a fast double-tap cannot send
    // two conflicting days. Worth pinning: it is also why the two assertions
    // above had to be separate tests.
    let release: () => void = () => {};
    planFor.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = () => resolve())),
    );
    render(<PlanDay entityId="e1" day="2026-10-24" today="2026-10-09" />);
    fireEvent.change(screen.getByTestId("plan-day"), {
      target: { value: "2026-10-25" },
    });
    fireEvent.click(screen.getByTestId("plan-clear"));
    expect(planFor).toHaveBeenCalledTimes(1);
    release();
  });
});

describe("the date it volunteers", () => {
  it("is today on the local calendar, not in UTC", () => {
    // 2026-10-09 19:30 Pacific is 2026-10-10 in UTC. A component that reached
    // for `toISOString()` would offer tomorrow through every Pacific evening —
    // which is exactly when somebody plans something.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T02:30:00.000Z"));
    try {
      render(<PlanDay entityId="e1" />);
      fireEvent.click(screen.getByTestId("plan-ask"));
      const offered = screen.getByTestId("plan-day") as HTMLInputElement;
      const local = new Date();
      const expected = `${local.getFullYear()}-${`${local.getMonth() + 1}`.padStart(2, "0")}-${`${local.getDate()}`.padStart(2, "0")}`;
      expect(offered.value).toBe(expected);
    } finally {
      vi.useRealTimers();
    }
  });
});
