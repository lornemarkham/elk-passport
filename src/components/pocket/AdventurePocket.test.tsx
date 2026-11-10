import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import type { Ideas } from "@/lib/pocket/useIdeas";

const toast = Object.assign(vi.fn(), {
  success: vi.fn(),
  error: vi.fn(),
});
vi.mock("sonner", () => ({ toast }));

const { AdventurePocket } = await import("./AdventurePocket");

const experience = (id: string, title: string): Experience =>
  ({
    id,
    kind: "Place",
    title,
    activities: [],
    location: { name: title, region: "Okanagan" },
  }) as unknown as Experience;

const things = [
  experience("sandhill", "Sandhill Winery"),
  experience("market", "Penticton Farmers' Market"),
  experience("peak", "Peak of Christmas"),
];

function ideasWith(order: string[]): Ideas {
  const pocket = order.map((experienceId) => ({
    experienceId,
    addedAt: "2026-11-08",
    boardIds: ["b1"],
  }));
  return {
    boards: [],
    ready: true,
    failed: false,
    ideas: pocket,
    pocket,
    savedIds: new Set(order),
    save: vi.fn(async () => {}),
    remove: vi.fn(async () => ["b1"]),
    restore: vi.fn(async () => {}),
    setOrder: vi.fn(),
  };
}

const find = (id: string) => things.find((t) => t.id === id);

beforeEach(() => {
  toast.mockClear();
  toast.success.mockClear();
});

describe("the Adventure Pocket", () => {
  it("is not there until something is saved", () => {
    render(<AdventurePocket ideas={ideasWith([])} find={find} />);
    expect(screen.queryByTestId("pocket-button")).toBeNull();
  });

  it("closed, says how many and offers to make a day", () => {
    render(
      <AdventurePocket
        ideas={ideasWith(["sandhill", "market", "peak"])}
        find={find}
      />,
    );
    expect(screen.getByTestId("pocket-button")).toHaveTextContent(
      "3 ideas saved",
    );
    expect(screen.getByTestId("pocket-quick-day")).toHaveAttribute(
      "href",
      "/go?with=sandhill,market,peak",
    );
  });

  it("opens to the ideas, in the Pocket's order, with every way on", () => {
    render(
      <AdventurePocket
        ideas={ideasWith(["sandhill", "market", "peak"])}
        find={find}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /3 ideas saved/ }));
    const items = screen.getAllByTestId("pocket-item");
    expect(items.map((i) => i.querySelector("p")?.textContent)).toEqual([
      "Sandhill Winery",
      "Penticton Farmers' Market",
      "Peak of Christmas",
    ]);
    expect(screen.getByTestId("pocket-make-weekend")).toHaveAttribute(
      "href",
      "/adventures/new?with=sandhill,market,peak",
    );
    expect(screen.getByTestId("pocket-keep-collecting")).toBeInTheDocument();
    expect(screen.getByTestId("pocket-my-stuff")).toHaveAttribute(
      "href",
      "/saved",
    );
  });

  it("makes a day from only the ideas left ticked", () => {
    render(
      <AdventurePocket
        ideas={ideasWith(["sandhill", "market", "peak"])}
        find={find}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /3 ideas saved/ }));
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Use Peak of Christmas in the day",
      }),
    );
    expect(screen.getByTestId("pocket-make-day")).toHaveAttribute(
      "href",
      "/go?with=sandhill,market",
    );
    expect(screen.getByTestId("pocket-make-day")).toHaveTextContent(
      "with these 2",
    );
  });

  it("reorders by moving one place", () => {
    const ideas = ideasWith(["sandhill", "market", "peak"]);
    render(<AdventurePocket ideas={ideas} find={find} />);
    fireEvent.click(screen.getByRole("button", { name: /3 ideas saved/ }));
    expect(
      screen.getByRole("button", { name: "Move Sandhill Winery up" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Move Peak of Christmas up" }),
    );
    expect(ideas.setOrder).toHaveBeenCalledWith(["sandhill", "peak", "market"]);
  });

  it("removes at once and puts it back with one Undo", async () => {
    const ideas = ideasWith(["sandhill", "market"]);
    render(<AdventurePocket ideas={ideas} find={find} />);
    fireEvent.click(screen.getByRole("button", { name: /2 ideas saved/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Penticton Farmers' Market" }),
    );
    await waitFor(() => expect(ideas.remove).toHaveBeenCalledWith("market"));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    const [line, options] = toast.mock.calls[0]!;
    expect(line).toBe("Out of the Pocket.");
    expect(options.action.label).toBe("Undo");
    options.action.onClick();
    await waitFor(() =>
      expect(ideas.restore).toHaveBeenCalledWith("market", ["b1"]),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Back in the Pocket."),
    );
  });

  it("closes on Escape", () => {
    render(<AdventurePocket ideas={ideasWith(["sandhill"])} find={find} />);
    fireEvent.click(screen.getByRole("button", { name: /1 idea saved/ }));
    expect(screen.getByTestId("pocket")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("pocket")).toBeNull();
  });
});

describe("ideas saved in different parts of the province", () => {
  const at = (id: string, title: string, lng: number, lat: number) =>
    ({
      ...experience(id, title),
      geography: { coordinates: [lng, lat] },
    }) as unknown as Experience;
  const apart = [
    at("kal", "Kal Beach", -119.2937, 50.2316),
    at("bna", "BNA Brewing", -119.27, 50.267),
    at("stanley", "Stanley Park", -123.1443, 49.3043),
  ];
  const findApart = (id: string) => apart.find((t) => t.id === id);

  it("says so before the press, and keeps every one of them", () => {
    render(
      <AdventurePocket
        ideas={ideasWith(["kal", "bna", "stanley"])}
        find={findApart}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /3 ideas saved/ }));
    expect(screen.getByTestId("pocket-spread")).toHaveTextContent(
      "These are in 2 different places",
    );
    expect(screen.getByTestId("pocket-make-day")).toHaveAttribute(
      "href",
      "/go?with=kal,bna,stanley",
    );
  });

  it("says nothing when they are all around one town", () => {
    render(
      <AdventurePocket ideas={ideasWith(["kal", "bna"])} find={findApart} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2 ideas saved/ }));
    expect(screen.queryByTestId("pocket-spread")).toBeNull();
  });
});
