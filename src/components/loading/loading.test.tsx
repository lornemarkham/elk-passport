import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  LINK_GIVE_UP_MS,
  getProgress,
  hold,
  isBusy,
  navigatesAway,
  resetProgressForTest,
  startLink,
} from "./progress";
import { PendingContent, PendingProvider, usePendingRegion } from "./Pending";
import { SubjectSkeleton } from "./SubjectSkeleton";

import { NavigationProgress } from "./NavigationProgress";

const here = {
  href: "https://gohaveaday.com/christmas?at=vernon",
  origin: "https://gohaveaday.com",
};

describe("navigatesAway — only a click that loads another page starts the line", () => {
  it("counts another path, or the same path with a different query", () => {
    expect(navigatesAway("/discovery", here)).toBe(true);
    expect(navigatesAway("/christmas?at=kelowna", here)).toBe(true);
  });
  it("does not count a jump within the page, the same address, or another site", () => {
    expect(navigatesAway("#markets", here)).toBe(false);
    expect(navigatesAway("/christmas?at=vernon", here)).toBe(false);
    expect(navigatesAway("https://www.google.com/maps", here)).toBe(false);
    expect(navigatesAway("mailto:elf@example.test", here)).toBe(false);
  });
});

describe("the progress store", () => {
  beforeEach(() => resetProgressForTest());

  it("is busy while any hold is held, and each release counts once", () => {
    const a = hold();
    const b = hold();
    expect(isBusy(getProgress())).toBe(true);
    a();
    a();
    expect(isBusy(getProgress())).toBe(true);
    b();
    expect(isBusy(getProgress())).toBe(false);
  });

  it("gives up on a link that never changed the address, but not before 30 s", () => {
    vi.useFakeTimers();
    startLink();
    vi.advanceTimersByTime(LINK_GIVE_UP_MS - 1);
    expect(isBusy(getProgress())).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isBusy(getProgress())).toBe(false);
    vi.useRealTimers();
  });
});

describe("NavigationProgress", () => {
  beforeEach(() => {
    resetProgressForTest();
    window.history.replaceState(null, "", "/christmas?at=vernon");
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  function Page() {
    return (
      <>
        <NavigationProgress />
        <NavigationProgress />
        <a
          href="/christmas?at=kelowna"
          onClick={(e) => e.preventDefault()}
          data-testid="go"
        >
          Kelowna
        </a>
        <a href="#markets" data-testid="jump">
          Markets
        </a>
      </>
    );
  }

  it("appears shortly after a click that navigates — once, however many mount it", () => {
    render(<Page />);
    fireEvent.click(screen.getByTestId("go"));
    // Quiet for a fast navigation…
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByTestId("nav-progress")).toBeNull();
    // …and there for a slow one.
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getAllByTestId("nav-progress")).toHaveLength(1);
    expect(screen.getByTestId("nav-progress").dataset.state).toBe("loading");

    // The address arrives: it finishes, then goes.
    window.history.pushState(null, "", "/christmas?at=kelowna");
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByTestId("nav-progress").dataset.state).toBe("done");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByTestId("nav-progress")).toBeNull();
  });

  it("stays quiet for a jump within the page", () => {
    render(<Page />);
    fireEvent.click(screen.getByTestId("jump"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByTestId("nav-progress")).toBeNull();
  });

  it("starts on a GET form that opens a page", () => {
    render(
      <>
        <NavigationProgress />
        <form
          action="/christmas/itinerary"
          onSubmit={(e) => e.preventDefault()}
          data-testid="plan"
        />
      </>,
    );
    fireEvent.submit(screen.getByTestId("plan"));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId("nav-progress")).toBeTruthy();
  });

  it("runs while a held transition is pending", () => {
    render(<NavigationProgress />);
    let release = () => {};
    act(() => {
      release = hold();
    });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId("nav-progress").dataset.state).toBe("loading");
    act(() => release());
    expect(screen.getByTestId("nav-progress").dataset.state).toBe("done");
  });
});

describe("PendingContent — out of date, never hidden", () => {
  it("keeps its children and is not busy at rest", () => {
    render(
      <PendingProvider>
        <PendingContent>
          <p>Vernon markets</p>
        </PendingContent>
      </PendingProvider>,
    );
    expect(screen.getByText("Vernon markets")).toBeTruthy();
    expect(
      screen.getByTestId("pending-content").getAttribute("aria-busy"),
    ).toBe(null);
  });

  it("works outside a provider too, with a region of its own", () => {
    function Alone() {
      const [n, setN] = useState(0);
      const region = usePendingRegion();
      return (
        <button onClick={() => setN(n + 1)}>
          {String(region.pending)} {n}
        </button>
      );
    }
    render(<Alone />);
    expect(screen.getByText("false 0")).toBeTruthy();
  });
});

describe("SubjectSkeleton", () => {
  it("is busy, says what it is waiting for, and draws only shapes", () => {
    render(<SubjectSkeleton />);
    const main = screen.getByTestId("subject-loading");
    expect(main.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toMatch(
      /Getting everything/,
    );
  });
});
