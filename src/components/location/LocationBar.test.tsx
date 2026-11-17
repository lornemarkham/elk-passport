import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationBar } from "./LocationBar";

vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({
    ok: true,
    json: async () => ({ townId: "vernon", source: "default" }),
  })),
);
afterEach(() => vi.clearAllMocks());

describe("LocationBar — a change of place is answered at once", () => {
  it("names the town on its way and says it is loading", () => {
    render(<LocationBar showing="kelowna" busy="Loading Kelowna" />);
    expect(screen.getByTestId("location-name").textContent).toBe("Kelowna, BC");
    expect(screen.getByTestId("location-loading").textContent).toBe(
      "Loading Kelowna…",
    );
    expect(
      screen.getByTestId("location-loading").getAttribute("aria-live"),
    ).toBe("polite");
  });

  it("says nothing extra when nothing is loading", () => {
    render(<LocationBar showing="kelowna" />);
    expect(screen.getByTestId("location-loading").textContent).toBe("");
  });
});
