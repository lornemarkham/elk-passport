import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DiscoverySurface } from "./DiscoverySurface";

/**
 * These test the *mechanics*, with a deliberately fake entity that is not a
 * Place. If a test here needed a Place field, the shell would have leaked
 * knowledge of one entity type into the layer meant to serve four.
 */
interface Widget {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly tags?: readonly string[];
}

const widgets: Widget[] = [
  { id: "w3", name: "Cedar", kind: "tree", tags: ["tall", "green"] },
  { id: "w1", name: "Alder", kind: "tree", tags: ["green"] },
  { id: "w2", name: "Boulder", kind: "rock", tags: ["grey"] },
];

function renderSurface(
  overrides: Partial<Parameters<typeof DiscoverySurface<Widget>>[0]> = {},
) {
  return render(
    <DiscoverySurface<Widget>
      items={widgets}
      keyOf={(w) => w.id}
      title="Widgets"
      noun={{ one: "widget", many: "widgets" }}
      facet={{ label: "Filter by kind", valuesOf: (w) => [w.kind] }}
      emptyMessage="Nothing of that kind."
      renderItem={(w) => <a href={`/widgets/${w.id}`}>{w.name}</a>}
      {...overrides}
    />,
  );
}

const results = () => screen.getByRole("list");
const countText = () => screen.getByTestId("result-count").textContent;
const resultNames = () =>
  within(results())
    .getAllByRole("link")
    .map((a) => a.textContent);

describe("DiscoverySurface", () => {
  it("shows every item, with the plural noun and a chip per facet value", () => {
    renderSurface();
    expect(resultNames()).toHaveLength(3);
    expect(countText()).toBe("3 widgets");

    const chips = within(screen.getByTestId("filter-chips")).getAllByRole(
      "button",
    );
    expect(chips.map((c) => c.textContent)).toEqual([
      "All 3",
      "tree 2",
      "rock 1",
    ]);
  });

  it("narrows results to the selected facet value", () => {
    renderSurface();
    fireEvent.click(screen.getByRole("button", { name: "rock 1" }));

    expect(resultNames()).toEqual(["Boulder"]);
    // The selected value is echoed after the count, so a filtered view says
    // what it is filtered to without the reader looking back up at the chips.
    expect(countText()).toBe("1 widget · rock");
    expect(screen.getByRole("button", { name: "rock 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("restores every result when the filter is cleared — by the chip or by All", () => {
    renderSurface();
    const rock = screen.getByRole("button", { name: "rock 1" });

    fireEvent.click(rock);
    expect(resultNames()).toEqual(["Boulder"]);

    fireEvent.click(rock); // clicking the active chip clears it
    expect(resultNames()).toHaveLength(3);

    fireEvent.click(rock);
    fireEvent.click(screen.getByRole("button", { name: "All 3" }));
    expect(resultNames()).toHaveLength(3);
  });

  it("keeps the chip counts fixed to the whole collection, not the filtered view", () => {
    renderSurface();
    fireEvent.click(screen.getByRole("button", { name: "rock 1" }));

    // A count that shrank to match the current filter would make the other
    // chips look empty and unclickable.
    const chips = within(screen.getByTestId("filter-chips")).getAllByRole(
      "button",
    );
    expect(chips.map((c) => c.textContent)).toEqual([
      "All 3",
      "tree 2",
      "rock 1",
    ]);
  });

  it("hands the renderer the whole entity, so a card may read fields no other type has", () => {
    const renderItem = vi.fn((w: Widget) => (
      <a href={`/widgets/${w.id}`}>{w.name}</a>
    ));
    renderSurface({ renderItem });

    expect(renderItem).toHaveBeenCalledTimes(3);
    expect(renderItem.mock.calls.map(([w]) => w)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "w2", kind: "rock" }),
      ]),
    );
  });

  it("preserves the links the renderer produced, in the collection's own order", () => {
    // No `compare`, so the order is the order the caller handed over — the
    // shell never reorders on its own.
    renderSurface();
    const hrefs = within(results())
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/widgets/w3", "/widgets/w1", "/widgets/w2"]);
  });

  it("applies the caller's ordering after filtering", () => {
    renderSurface({ compare: (a, b) => b.name.localeCompare(a.name) });
    expect(resultNames()).toEqual(["Cedar", "Boulder", "Alder"]);

    fireEvent.click(screen.getByRole("button", { name: "tree 2" }));
    expect(resultNames()).toEqual(["Cedar", "Alder"]);
  });

  it("shows the caller's empty message, and no list, for an empty collection", () => {
    renderSurface({ items: [], facet: undefined });
    expect(screen.getByText("Nothing of that kind.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(countText()).toBe("0 widgets");
  });

  it("filters correctly when an item contributes no facet value at all", () => {
    // The shape a real facet takes when a field is optional: an item with no
    // value is simply not reachable through the chips, rather than landing
    // under a guessed one.
    renderSurface({
      facet: {
        label: "Filter by kind",
        valuesOf: (w) => (w.kind === "rock" ? ["rock"] : []),
      },
    });
    const chips = within(screen.getByTestId("filter-chips")).getAllByRole(
      "button",
    );
    expect(chips.map((c) => c.textContent)).toEqual(["All 3", "rock 1"]);

    fireEvent.click(screen.getByRole("button", { name: "rock 1" }));
    expect(resultNames()).toEqual(["Boulder"]);
  });

  it("counts an item under every value a multi-valued facet returns", () => {
    renderSurface({
      facet: { label: "Filter by tag", valuesOf: (w) => w.tags ?? [] },
    });

    const chips = within(screen.getByTestId("filter-chips")).getAllByRole(
      "button",
    );
    expect(chips.map((c) => c.textContent)).toEqual([
      "All 3",
      "green 2",
      "grey 1",
      "tall 1",
    ]);
  });

  it("renders no filter row at all when the caller supplies no facet", () => {
    renderSurface({ facet: undefined });
    expect(screen.queryByTestId("filter-chips")).not.toBeInTheDocument();
    expect(resultNames()).toHaveLength(3);
  });

  it("uses the singular noun for exactly one result", () => {
    renderSurface({ items: [widgets[0]!] });
    expect(countText()).toBe("1 widget");
  });
});
