import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Discover } from "./Discover";
import { emptyTray } from "./tray";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import type { Possibility } from "@/lib/labs/october/possibility";
import type { Days } from "@/lib/labs/october/filters";

/**
 * **The question this page has to pass is "can I find the thing, and keep it,
 * without losing where I was".**
 *
 * The finding half is tested against the filter and search modules. What can
 * only be tested here is the second half: a page four filters deep must
 * survive being acted on. Saving is a `PUT` and nothing navigates, so the
 * query, the filters and the scroll position are all still there afterwards —
 * which is the difference between a page you make one decision on and a page
 * you plan an evening with.
 */

const DAYS: Days = {
  today: "2026-10-01",
  tomorrow: "2026-10-02",
  weekend: ["2026-10-02", "2026-10-03", "2026-10-04"],
};

const make = (over: Partial<Possibility>): Possibility => ({
  id: "x",
  source: "atlas",
  title: "A thing",
  availability: {
    shape: "fixed",
    label: "THU OCT 1",
    days: ["2026-10-01"],
    tonight: true,
  },
  setting: "indoor",
  href: "/",
  text: "",
  tags: [],
  keepAs: "Event",
  ...over,
});

const POOL: readonly Possibility[] = [
  make({
    id: "film",
    source: "movie",
    title: "Halloween",
    keepAs: "Movie",
    scare: 3,
    tags: ["stay-in", "watch"],
    text: "halloween",
    availability: {
      shape: "anytime",
      label: "ANY NIGHT · 1H 31M",
      days: [],
      tonight: true,
    },
  }),
  make({
    id: "doing",
    source: "doing",
    title: "Carve pumpkins",
    keepAs: "Doing",
    tags: ["stay-in", "make"],
    text: "pumpkin carving",
    availability: {
      shape: "anytime",
      label: "ANY NIGHT",
      days: [],
      tonight: true,
    },
  }),
  make({
    id: "gig",
    title: "Pumpkin Patch Storytime",
    tags: ["go-out"],
    text: "a pumpkin patch",
  }),
];

const ctx = { today: DAYS.today, weather: {} };

function show(signedIn = true) {
  return render(
    <Discover
      possibilities={POOL}
      ctx={ctx}
      days={DAYS}
      signedIn={signedIn}
      kept={[]}
    />,
  );
}

const count = () => screen.getByTestId("count").textContent ?? "";
const titles = () =>
  screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 200 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  forgetEverythingKept();
  emptyTray();
});

describe("one page, several questions", () => {
  it("shows everything before anything is asked", () => {
    show();
    expect(count()).toContain("3");
    expect(titles()).toHaveLength(3);
  });

  it("narrows on a search across every source", () => {
    show();
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "pumpkin" },
    });
    expect(titles().sort()).toEqual([
      "Carve pumpkins",
      "Pumpkin Patch Storytime",
    ]);
  });

  it("narrows on a filter", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Make" }));
    expect(titles()).toEqual(["Carve pumpkins"]);
  });

  it("combines a search with a filter", () => {
    show();
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "pumpkin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Go out" }));
    expect(titles()).toEqual(["Pumpkin Patch Storytime"]);
  });

  it("gives a way out when nothing matches", () => {
    show();
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "snowmobiling" },
    });
    expect(
      screen.getByText(/nothing matches all of that/i),
    ).toBeInTheDocument();
  });

  it("clears everything in one press", () => {
    show();
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "pumpkin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make" }));
    fireEvent.click(screen.getByRole("button", { name: /clear everything/i }));
    expect(titles()).toHaveLength(3);
  });
});

describe("choosing does not cost you your place", () => {
  it("keeps the search and the filter after something is chosen", async () => {
    show();
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "pumpkin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stay in" }));
    expect(titles()).toEqual(["Carve pumpkins"]);

    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Chosen" }),
      ).toBeInTheDocument(),
    );

    // Still one result, still filtered, still searched.
    expect(titles()).toEqual(["Carve pumpkins"]);
    expect(
      (screen.getByLabelText(/search everything/i) as HTMLInputElement).value,
    ).toBe("pumpkin");
    expect(screen.getByRole("button", { name: "Stay in" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("writes through the one October route, not a lab store", async () => {
    show();
    fireEvent.click(screen.getAllByRole("button", { name: "Choose" })[0]);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toMatch(/^\/api\/october\/things\//);
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("asks a visitor to sign in rather than hiding that choosing exists", () => {
    show(false);
    expect(
      screen.getAllByRole("link", { name: /sign in to choose/i }).length,
    ).toBeGreaterThan(0);
  });
});
