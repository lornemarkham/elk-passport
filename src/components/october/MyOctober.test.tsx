import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OctoberThing } from "@/lib/october/types";

/**
 * **The only way anything becomes lived is the person saying so.**
 *
 * These pin the shape of My October rather than its looks: no counts in the
 * empty state, Ahead and Lived kept apart, "Did this" the sole path between
 * them, and nothing moving on its own.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/october",
}));

const didThis = vi.fn<(id: string) => Promise<OctoberThing>>();
const forget = vi.fn<(id: string) => Promise<void>>(async () => {});
vi.mock("@/lib/october/october-repo", () => ({
  didThis: (id: string) => didThis(id),
  forget: (id: string) => forget(id),
}));

const { MyOctober } = await import("./MyOctober");

const thing = (over: Partial<OctoberThing>): OctoberThing => ({
  entityId: "e1",
  entityKind: "Place",
  name: "Kekuli Bay",
  startsAt: null,
  state: "ahead",
  wantedAt: "2026-10-02T10:00:00.000Z",
  livedAt: null,
  ...over,
});

beforeEach(() => {
  didThis.mockReset();
  forget.mockClear();
});

describe("an empty October", () => {
  it("does not count anything", () => {
    render(<MyOctober displayName="Ana" things={[]} experiences={[]} />);
    const text = screen.getByTestId("october-empty").textContent ?? "";
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toMatch(/activities|events|completed/i);
    expect(screen.getByText(/Find something/)).toBeTruthy();
  });
});

describe("ahead and lived", () => {
  it("keeps what is meant apart from what was done", () => {
    render(
      <MyOctober
        displayName="Ana"
        things={[
          thing({ entityId: "a", name: "Kekuli Bay" }),
          thing({
            entityId: "b",
            name: "Apple Harvest Fest",
            entityKind: "Event",
            state: "lived",
            livedAt: "2026-10-05T20:00:00.000Z",
          }),
        ]}
        experiences={[]}
      />,
    );
    expect(screen.getAllByTestId("ahead-thing")).toHaveLength(1);
    expect(screen.getAllByTestId("lived-thing")).toHaveLength(1);
    expect(screen.getByTestId("october-lived").textContent).toContain(
      "Apple Harvest Fest",
    );
  });

  it("puts dated things first in Ahead, soonest first", () => {
    render(
      <MyOctober
        displayName="Ana"
        things={[
          thing({
            entityId: "later",
            name: "Later",
            startsAt: "2026-10-20T00:00:00.000Z",
            entityKind: "Event",
          }),
          thing({ entityId: "undated", name: "Undated" }),
          thing({
            entityId: "sooner",
            name: "Sooner",
            startsAt: "2026-10-09T00:00:00.000Z",
            entityKind: "Event",
          }),
        ]}
        experiences={[]}
      />,
    );
    const names = screen
      .getAllByTestId("ahead-thing")
      .map((li) => li.textContent);
    expect(names[0]).toContain("Sooner");
    expect(names[1]).toContain("Later");
    expect(names[2]).toContain("Undated");
  });

  it("moves a thing to Lived only when the person says they did it", async () => {
    didThis.mockResolvedValueOnce(
      thing({
        entityId: "a",
        state: "lived",
        livedAt: "2026-10-08T21:00:00.000Z",
      }),
    );
    render(
      <MyOctober
        displayName="Ana"
        things={[thing({ entityId: "a" })]}
        experiences={[]}
      />,
    );

    expect(screen.queryAllByTestId("lived-thing")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("did-this"));

    await waitFor(() =>
      expect(screen.getAllByTestId("lived-thing")).toHaveLength(1),
    );
    expect(screen.queryAllByTestId("ahead-thing")).toHaveLength(0);
    expect(didThis).toHaveBeenCalledWith("a");
  });

  it("never marks anything lived on its own", () => {
    // Render, wait, click nothing. Nothing moves.
    render(
      <MyOctober
        displayName="Ana"
        things={[thing({ entityId: "a" })]}
        experiences={[]}
      />,
    );
    expect(screen.queryAllByTestId("lived-thing")).toHaveLength(0);
    expect(didThis).not.toHaveBeenCalled();
  });

  it("lets the person change their mind", async () => {
    render(
      <MyOctober
        displayName="Ana"
        things={[thing({ entityId: "a" })]}
        experiences={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("forget"));
    await waitFor(() =>
      expect(screen.queryAllByTestId("ahead-thing")).toHaveLength(0),
    );
    expect(forget).toHaveBeenCalledWith("a");
  });

  it("shows a thing by its remembered name even when Atlas no longer returns it", () => {
    // No experiences passed at all — every row still renders from the snapshot.
    render(
      <MyOctober
        displayName="Ana"
        things={[thing({ name: "Somewhere Retired" })]}
        experiences={[]}
      />,
    );
    expect(screen.getByText("Somewhere Retired")).toBeTruthy();
  });
});
