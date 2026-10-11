import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PrintableAdventure } from "./PrintableAdventure";
import { sampleAdventure } from "@/lib/analog/sample";

describe("PrintableAdventure", () => {
  it("has one clear print action, and it prints", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    const button = screen.getByRole("button", {
      name: /print your adventure/i,
    });
    fireEvent.click(button);
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it("prints every stop as a numbered stop with its own heading", () => {
    const adventure = sampleAdventure();
    render(<PrintableAdventure adventure={adventure} />);
    const stops = screen.getAllByTestId("guide-stop");
    expect(stops).toHaveLength(adventure.stops.length);
    adventure.stops.forEach((stop, i) => {
      expect(
        within(stops[i]!).getByRole("heading", { level: 3 }),
      ).toHaveTextContent(`Stop ${stop.number}: ${stop.title}`);
    });
  });

  it("says plainly where hours and prices were not published", () => {
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    const first = screen.getAllByTestId("guide-stop")[0]!;
    expect(first).toHaveTextContent("Hours not published");
    expect(first).toHaveTextContent("Cost");
    expect(first).toHaveTextContent("distance not measured");
  });

  it("never prints a drive time", () => {
    const { container } = render(
      <PrintableAdventure adventure={sampleAdventure()} />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\d+\s*(min|minutes?)\s*(drive|driving)/i);
    expect(text).not.toMatch(/drive of \d/i);
    expect(text).toContain("Nothing on this page is a drive time.");
  });

  it("has the checklist, the summary, side quests and memories", () => {
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    expect(screen.getByTestId("adventure-prep")).toBeInTheDocument();
    expect(screen.getAllByTestId("adventure-prep-item").length).toBeGreaterThan(
      3,
    );
    expect(screen.getByTestId("adventure-time")).toHaveTextContent(
      "Your 5 hours",
    );
    expect(screen.getByTestId("adventure-budget")).toHaveTextContent("$80");
    expect(screen.getByTestId("adventure-quests")).toBeInTheDocument();
    expect(screen.getByTestId("adventure-memories")).toBeInTheDocument();
    // A seven-year-old was named, so there is somewhere to draw.
    expect(screen.getByTestId("adventure-draw")).toBeInTheDocument();
  });

  it("tells a screen reader what kind of claim each checklist line is", () => {
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    const items = screen.getAllByTestId("adventure-prep-item");
    for (const item of items) {
      expect(item.textContent).toMatch(
        /\((Published|Check first|Suggestion)\)/,
      );
    }
  });

  it("labels the sample as a sample", () => {
    render(<PrintableAdventure adventure={sampleAdventure()} />);
    expect(screen.getByTestId("adventure-sample-note")).toHaveTextContent(
      "Sample adventure.",
    );
  });

  it("does not offer a drawing box when no child was named", () => {
    const adventure = { ...sampleAdventure(), childAge: undefined };
    render(<PrintableAdventure adventure={adventure} />);
    expect(screen.queryByTestId("adventure-draw")).toBeNull();
  });

  it("sends somebody back to build a day when there is nothing to print", () => {
    render(
      <PrintableAdventure adventure={{ ...sampleAdventure(), stops: [] }} />,
    );
    expect(screen.getByRole("link", { name: /build a day/i })).toHaveAttribute(
      "href",
      "/go",
    );
    expect(screen.queryByRole("button", { name: /print/i })).toBeNull();
  });
});
