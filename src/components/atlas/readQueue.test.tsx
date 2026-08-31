import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ReadQueue } from "./readQueue";

/**
 * **Finishing the mission from the mission's own page** (ADR 043).
 *
 * Reading a discovered page was the last step that required a terminal. The
 * control starts the operation Atlas already has, then gets out of the way:
 * the run's own events are the progress, and what the run *means* for the
 * mission is re-derived by the server, never announced here.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

const mockRefresh = vi.fn();

/** Atlas answers 202 + runId; the run then reports itself until it stops. */
function mockAtlas(runStatuses: string[], events: { message: string }[] = []) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let poll = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("run-queue")) {
        return { ok: true, json: async () => ({ runId: "run-abc12345" }) };
      }
      const status = runStatuses[Math.min(poll++, runStatuses.length - 1)];
      return { ok: true, json: async () => ({ run: { status }, events }) };
    }),
  );
  return calls;
}

beforeEach(() => mockRefresh.mockClear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ReadQueue — the count is the mission's own", () => {
  it("offers exactly the unread pages, and does not hard-code a number", () => {
    render(<ReadQueue entityIds={["e1"]} unread={3} failed={0} />);
    expect(screen.getByRole("button", { name: "Read 3 pages" })).toBeTruthy();
  });

  it("counts a single page in the singular", () => {
    render(<ReadQueue entityIds={["e1"]} unread={1} failed={0} />);
    expect(screen.getByRole("button", { name: "Read 1 page" })).toBeTruthy();
  });

  it("names a failure as a retry, not as unread work", () => {
    // A broken fetch and a page nobody has opened are different facts, and
    // adding them into one number would hide which is which.
    render(<ReadQueue entityIds={["e1"]} unread={0} failed={1} />);
    expect(
      screen.getByRole("button", { name: "Retry 1 failed page" }),
    ).toBeTruthy();
  });

  it("names both when both exist", () => {
    render(<ReadQueue entityIds={["e1"]} unread={3} failed={2} />);
    expect(
      screen.getByRole("button", { name: "Read 3 pages and retry 2 failed" }),
    ).toBeTruthy();
  });

  it("read-not-applied is not queue work, so it cannot appear here", () => {
    // The component is only ever given unread + failed. Ten pages read without
    // result leave nothing to press — re-running would not change them, and
    // offering the button would spend a fetch to be told so.
    const { container } = render(
      <ReadQueue entityIds={["e1"]} unread={0} failed={0} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("ReadQueue — starting the operation", () => {
  it("posts through the app's own proxy and never handles a token", async () => {
    const calls = mockAtlas(["completed"]);
    render(<ReadQueue entityIds={["e1", "e2"]} unread={3} failed={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Read 3 pages" }));

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const start = calls[0]!;
    expect(start.url).toBe("/api/admin/candidate-sources/run-queue");
    expect(JSON.parse(String(start.init!.body))).toEqual({
      entityIds: ["e1", "e2"],
    });
    // ADMIN_TOKEN is a server-side secret. Nothing the browser sends may carry
    // it, in the body or in a header.
    const serialised = JSON.stringify(calls);
    expect(serialised.toLowerCase()).not.toContain("admin_token");
    expect(serialised).not.toContain("x-admin-token");
  });

  it("follows the returned runId for progress, and shows Atlas's own words", async () => {
    mockAtlas(["running", "completed"], [{ message: "Attempted 3 pages." }]);
    render(<ReadQueue entityIds={["e1"]} unread={3} failed={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Read 3 pages" }));

    await waitFor(() => expect(screen.getByText(/run run-abc/)).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByText("Attempted 3 pages.")).toBeTruthy(),
    );
  });

  it("re-reads the mission when the run stops, rather than declaring an outcome", async () => {
    // The whole loop: run the operation, come back, let Atlas work out what
    // changed. This component never says the mission is complete.
    mockAtlas(["completed"]);
    render(<ReadQueue entityIds={["e1"]} unread={3} failed={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Read 3 pages" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(screen.queryByText(/complete/i)).toBeNull();
  });

  it("a failed run stays a failure and stays retryable", async () => {
    mockAtlas(["failed"]);
    render(<ReadQueue entityIds={["e1"]} unread={0} failed={1} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry 1 failed page" }),
    );

    await waitFor(() =>
      expect(screen.getByText(/stopped on a failure/i)).toBeTruthy(),
    );
    // Never rewritten as "nothing found" — a page that failed is a fact about
    // the request, not about the world.
    expect(screen.queryByText(/nothing/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry 1 failed page" }),
    ).toBeTruthy();
  });

  it("surfaces a refusal instead of pretending the run started", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "entityIds is required" }),
      })),
    );
    render(<ReadQueue entityIds={[]} unread={3} failed={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Read 3 pages" }));

    await waitFor(() =>
      expect(screen.getByText(/entityIds is required/)).toBeTruthy(),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
