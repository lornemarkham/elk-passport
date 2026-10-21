import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { GatheringBoard, type GatheringViewer } from "./GatheringBoard";
import { describeInterest } from "./GatheringInterest";
import { gatheringBySlug } from "@/lib/data/boards-gatherings";
import { NO_INTEREST } from "@/lib/data/boards-interest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

const sycle = gatheringBySlug("sycle-vancouver-2026")!;
const HOCKEY = sycle.featured.id;

const member = (
  over: Partial<Extract<GatheringViewer, { kind: "member" }>> = {},
): GatheringViewer => ({
  kind: "member",
  boardId: "b-1",
  role: "editor",
  yourName: "Lorne",
  interest: { summaries: {}, kindred: [] },
  plans: [],
  adventures: [],
  unresolved: 0,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the conference activities board", () => {
  it("shows the staff hockey game with every detail awaiting confirmation", () => {
    render(
      <GatheringBoard gathering={sycle} viewer={{ kind: "signed-out" }} />,
    );
    expect(
      screen.getByRole("heading", { name: "Staff hockey game" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Awaiting confirmation")).toHaveLength(4);
    expect(screen.getByText(/Dates awaiting confirmation/)).toBeTruthy();
  });

  it("offers Go Have A Day from Vancouver", () => {
    render(
      <GatheringBoard gathering={sycle} viewer={{ kind: "signed-out" }} />,
    );
    const links = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/go?"));
    expect(links.length).toBe(3);
    for (const href of links) expect(href).toContain("at=vancouver");
  });

  it.each<GatheringViewer>([
    { kind: "signed-out" },
    { kind: "no-board" },
    { kind: "not-member" },
    { kind: "board-error" },
    member({ interest: null }),
  ])(
    "offers no interest controls and no people to a $kind viewer",
    (viewer) => {
      render(<GatheringBoard gathering={sycle} viewer={viewer} />);
      expect(screen.queryByRole("button", { name: /interested/i })).toBeNull();
      expect(screen.queryByText(/Colleagues into the same things/)).toBeNull();
    },
  );

  it("says interest can't be recorded rather than that nobody is interested", () => {
    render(
      <GatheringBoard gathering={sycle} viewer={member({ interest: null })} />,
    );
    expect(
      screen.getByText("Passport can't record interest here yet"),
    ).toBeTruthy();
    expect(screen.queryByText(/Nobody yet/)).toBeNull();
  });

  it("lets a member say they're interested, and shows the server's answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summaries: {
          [HOCKEY]: {
            count: 2,
            youAreIn: true,
            youShowName: false,
            names: ["Sam"],
            unnamed: 0,
          },
        },
        kindred: [{ name: "Sam", shared: [HOCKEY] }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GatheringBoard gathering={sycle} viewer={member()} />);
    expect(screen.getByText("Nobody yet — be the first.")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "I'm interested in Staff hockey game",
      }),
    );

    await waitFor(() =>
      expect(screen.getByText("You and Sam are interested.")).toBeTruthy(),
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/boards/b-1/interest");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ itemId: HOCKEY, showName: false });
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByText(/also into Staff hockey game/)).toBeTruthy();
  });

  it("keeps the name choice off until the person turns it on", () => {
    render(<GatheringBoard gathering={sycle} viewer={member()} />);
    const box = screen.getByRole("checkbox", {
      name: /Show my name \(Lorne\)/,
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText(/Show my name \(Lorne\)/)).toBeTruthy();
  });

  it("lists adventures saved to the board, each with a way into the day", () => {
    render(
      <GatheringBoard
        gathering={sycle}
        viewer={member({
          adventures: [
            {
              id: "atlas-1",
              title: "Stanley Park seawall",
              shortDescription: "A walk.",
            } as never,
          ],
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Stanley Park seawall" }),
    ).toBeTruthy();
    const plan = screen.getByRole("link", { name: /Let's do this/ });
    expect(plan.getAttribute("href")).toMatch(/^\/day\/atlas-1\?back=/);
  });

  it("hides the Discovery invitation from a viewer who cannot add to the board", () => {
    render(
      <GatheringBoard gathering={sycle} viewer={member({ role: "viewer" })} />,
    );
    expect(
      screen.queryByRole("link", { name: /Find one in Discovery/ }),
    ).toBeNull();
  });
});

describe("describing who is interested", () => {
  it.each([
    [NO_INTEREST, "Nobody yet — be the first."],
    [{ ...NO_INTEREST, count: 1, youAreIn: true }, "You are interested."],
    [{ ...NO_INTEREST, count: 1, names: ["Sam"] }, "Sam is interested."],
    [{ ...NO_INTEREST, count: 1, unnamed: 1 }, "1 colleague is interested."],
    [{ ...NO_INTEREST, count: 3, unnamed: 3 }, "3 colleagues are interested."],
    [
      {
        ...NO_INTEREST,
        count: 4,
        youAreIn: true,
        names: ["Ana", "Sam"],
        unnamed: 1,
      },
      "You, Ana, Sam and 1 more are interested.",
    ],
  ])("%o → %s", (summary, sentence) => {
    expect(describeInterest(summary)).toBe(sentence);
  });
});
