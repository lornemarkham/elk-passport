import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { OctoberTray } from "./OctoberTray";
import { addToTray, emptyTray, removeFromTray } from "./tray";

/**
 * **The question this prototypes: do you have to leave discovery to see what
 * you have collected?**
 *
 * So what is tested is the counting and the peek, not the saving — saving is
 * the production mechanism and has its own tests. The two rules that matter
 * here are that the corner starts from what the server already said was kept
 * (so it is not zero on a page where three things are already saved), and that
 * it never shows a visitor a My October they do not have.
 */

afterEach(() => {
  act(() => emptyTray());
});

const seed = [
  { id: "a", name: "Field of Screams", when: "OCT 1–31" },
  { id: "b", name: "The Lost Boys", when: "ANY NIGHT · 1H 37M" },
];

describe("the corner that says what you have got", () => {
  it("starts from what the server already knew was kept", () => {
    render(<OctoberTray seed={seed} signedIn />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("counts up the moment something is kept, without a reload", () => {
    render(<OctoberTray seed={seed} signedIn />);
    act(() =>
      addToTray({ id: "c", name: "Carve pumpkins", when: "ANY NIGHT" }),
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("counts back down when something is let go", () => {
    render(<OctoberTray seed={seed} signedIn />);
    act(() => removeFromTray("a"));
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("keeps one row per thing however many cards saved it", () => {
    render(<OctoberTray seed={seed} signedIn />);
    act(() => addToTray(seed[0]));
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("opens to the list, with names and when — not ids", () => {
    render(<OctoberTray seed={seed} signedIn />);
    act(() => screen.getByRole("button", { name: /my october/i }).click());
    expect(screen.getByText("Field of Screams")).toBeInTheDocument();
    expect(screen.getByText("ANY NIGHT · 1H 37M")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open my october/i }),
    ).toHaveAttribute("href", "/october/mine");
  });

  it("says so plainly when nothing has been kept yet", () => {
    render(<OctoberTray seed={[]} signedIn />);
    act(() => screen.getByRole("button", { name: /my october/i }).click());
    expect(screen.getByText(/nothing yet/i)).toBeInTheDocument();
  });

  it("shows a visitor no October at all", () => {
    render(<OctoberTray seed={seed} signedIn={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
