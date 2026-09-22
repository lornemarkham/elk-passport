import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FilmReaction, shouldAskWhat } from "./FilmReaction";

/**
 * Two taps, and a third only when the answer is interesting. Repetition is
 * what turns a question into a form.
 */
describe("when the third question is worth asking", () => {
  it("asks when what they felt differs from what we expected", () => {
    expect(shouldAskWhat("nightmare", "spooky", "good")).toBe(true);
    expect(shouldAskWhat("cozy", "creepy", "meh")).toBe(true);
  });

  it("asks when they loved something frightening", () => {
    expect(shouldAskWhat("nightmare", "nightmare", "loved")).toBe(true);
  });

  it("stays quiet when the answer was unremarkable", () => {
    expect(shouldAskWhat("spooky", "spooky", "good")).toBe(false);
    expect(shouldAskWhat("cozy", "cozy", "meh")).toBe(false);
  });
});

describe("reacting", () => {
  it("takes two taps when nothing is surprising", () => {
    const onDone = vi.fn();
    render(<FilmReaction expected="spooky" onDone={onDone} />);

    fireEvent.click(screen.getByTestId("verdict-good"));
    fireEvent.click(screen.getByTestId("felt-spooky"));

    expect(onDone).toHaveBeenCalledWith({ verdict: "good", felt: "spooky" });
    expect(screen.queryByTestId("what-got-you")).toBeNull();
  });

  it("asks one more when it is", () => {
    const onDone = vi.fn();
    render(<FilmReaction expected="cozy" onDone={onDone} />);

    fireEvent.click(screen.getByTestId("verdict-good"));
    fireEvent.click(screen.getByTestId("felt-nightmare"));

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId("what-got-you")).toBeTruthy();

    fireEvent.click(screen.getByText("the unseen"));
    expect(onDone).toHaveBeenCalledWith({
      verdict: "good",
      felt: "nightmare",
      gotMe: "the unseen",
    });
  });

  it("lets them skip the third question", () => {
    const onDone = vi.fn();
    render(<FilmReaction expected="cozy" onDone={onDone} />);
    fireEvent.click(screen.getByTestId("verdict-loved"));
    fireEvent.click(screen.getByTestId("felt-nightmare"));
    fireEvent.click(screen.getByText("skip"));
    expect(onDone).toHaveBeenCalledWith({
      verdict: "loved",
      felt: "nightmare",
    });
  });
});
