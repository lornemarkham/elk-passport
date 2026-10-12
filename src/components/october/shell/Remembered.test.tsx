import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { BEEN_HERE, Remembered, WALKED_PAST } from "./Remembered";
import { forgetOctober, rememberEncounter } from "@/lib/october/foundYou";

/**
 * **The way in says only what is true.** "You've been here before." is a
 * fact about this browser or it is not said.
 */
describe("the way into Found You", () => {
  afterEach(() => forgetOctober());

  it("tells a stranger they walked past, and leads to her", () => {
    render(<Remembered />);
    const door = screen.getByRole("link", { name: WALKED_PAST });
    expect(door.getAttribute("href")).toBe("/october/found-you");
    expect(screen.queryByText(BEEN_HERE)).toBeNull();
  });

  it("tells somebody she has met that they have been here", () => {
    rememberEncounter({ door: "STAY" });
    render(<Remembered />);
    const door = screen.getByRole("link", { name: BEEN_HERE });
    expect(door.getAttribute("href")).toBe("/october/found-you");
    expect(screen.queryByText(WALKED_PAST)).toBeNull();
  });

  it("is not fooled by a record that never finished", () => {
    window.localStorage.setItem(
      "elk-passport:october:found-you",
      JSON.stringify({ found: false, door: "STAY" }),
    );
    render(<Remembered />);
    expect(screen.getByRole("link", { name: WALKED_PAST })).toBeTruthy();
  });

  it("renders nothing on the server, where nobody is known", () => {
    rememberEncounter({ door: "STAY" });
    expect(renderToString(<Remembered />)).toBe("");
  });

  it("is a link a thumb can hit", () => {
    render(<Remembered />);
    expect(screen.getByRole("link").className).toContain("min-h-11");
  });
});
