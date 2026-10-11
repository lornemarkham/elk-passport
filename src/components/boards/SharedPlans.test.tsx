import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SharedPlans } from "./SharedPlans";
import { LeaveBoard } from "./LeaveBoard";
import { InterestProvider } from "./GatheringInterest";
import type { SharedPlan } from "@/lib/data/boards-plans";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

const plan = (over: Partial<SharedPlan> = {}): SharedPlan => ({
  id: "p1",
  itemId: "plan:p1",
  title: "Saturday before the game",
  href: "/go/print?stops=a%2Cb",
  stops: 2,
  on: null,
  sharedBy: null,
  yours: false,
  canWithdraw: false,
  createdAt: "2026-10-11T00:00:00Z",
  ...over,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("days to have together", () => {
  it("says it could not ask, rather than that nobody shared anything", () => {
    render(
      <SharedPlans boardId="b" initial={null} canShare withInterest={false} />,
    );
    expect(screen.getByText(/can't share days on this board yet/)).toBeTruthy();
    expect(screen.queryByText(/No days shared yet/)).toBeNull();
    // No form to fill in for a store that is not there.
    expect(screen.queryByRole("button", { name: "Share this day" })).toBeNull();
  });

  it("opens the printed day the sharer saw", () => {
    render(
      <SharedPlans
        boardId="b"
        initial={[plan()]}
        canShare={false}
        withInterest={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Open the day/ }).getAttribute("href"),
    ).toBe("/go/print?stops=a%2Cb");
    expect(screen.getByText("Shared without a name")).toBeTruthy();
  });

  it("only offers taking a day down to whoever may", () => {
    const { rerender } = render(
      <SharedPlans
        boardId="b"
        initial={[plan()]}
        canShare
        withInterest={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /Take down/ })).toBeNull();
    rerender(
      <SharedPlans
        boardId="b"
        initial={[plan({ canWithdraw: true, yours: true })]}
        canShare
        withInterest={false}
      />,
    );
    expect(screen.getByRole("button", { name: /Take down/ })).toBeTruthy();
    expect(screen.getByText("Shared by you")).toBeTruthy();
  });

  it("does not offer sharing to a viewer", () => {
    render(
      <SharedPlans
        boardId="b"
        initial={[]}
        canShare={false}
        withInterest={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Share this day" })).toBeNull();
  });

  it("is \"I'm in\" — the board's own interest mark — in a group of people", () => {
    render(
      <InterestProvider
        boardId="b"
        yourName="Lorne"
        circle="people"
        initial={{
          summaries: {
            "plan:p1": {
              count: 2,
              youAreIn: false,
              youShowName: false,
              names: [],
              unnamed: 2,
            },
          },
          kindred: [],
        }}
      >
        <SharedPlans
          boardId="b"
          initial={[plan()]}
          canShare={false}
          withInterest
        />
      </InterestProvider>,
    );
    expect(
      screen.getByRole("button", { name: /I'm in for Saturday/ }),
    ).toBeTruthy();
    expect(screen.getByText("2 people are in.")).toBeTruthy();
  });

  it("shares a pasted day unnamed unless the box is ticked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([plan({ yours: true })]), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SharedPlans boardId="b" initial={[]} canShare withInterest={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText("/go/print?stops=…"), {
      target: { value: "/go/print?stops=a" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share this day" }));
    await waitFor(() => expect(screen.getByText("Shared by you")).toBeTruthy());
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent).toMatchObject({ link: "/go/print?stops=a", showName: false });
  });
});

describe("leaving a board", () => {
  it("asks once, then leaves as `me` and goes back to boards", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LeaveBoard boardId="b 1" />);
    fireEvent.click(screen.getByRole("button", { name: /Leave this board/ }));
    expect(
      screen.getByText(/interested.* marks here go with you/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/boards"));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/boards/b%201/members/me");
  });

  it("stays put, and says so, when Passport cannot take them off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Passport can't take you off this board yet.",
          }),
          { status: 503 },
        ),
      ),
    );
    render(<LeaveBoard boardId="b" />);
    fireEvent.click(screen.getByRole("button", { name: /Leave this board/ }));
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /can't take you off/,
      ),
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
