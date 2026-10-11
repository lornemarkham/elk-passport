import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_THEME,
  THEMES,
  ThemePicker,
  ThemeProvider,
  forgetTheme,
} from "./theme";

/**
 * **A colour is a choice somebody made, so it survives the next page.**
 *
 * Two things are pinned here. The accent is applied as a CSS variable rather
 * than as a class, so nothing in the product has to know which theme is on;
 * and the choice is read back out of storage on the next mount, because a
 * picker that forgets is a picker that was never worth offering.
 *
 * The storage read is deliberately **not** done during render — see
 * `ThemeProvider`. These tests mount twice rather than asserting on internals,
 * which is the only way to tell a real rehydration from a lucky first paint.
 */
const accentOf = (): string | null =>
  screen
    .getByTestId("themed")
    .closest("[data-ghad-theme]")!
    .getAttribute("style");

const mount = () =>
  render(
    <ThemeProvider>
      <ThemePicker />
      <p data-testid="themed">anything</p>
    </ThemeProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  // The module keeps the applied value in memory for the visit — once per page
  // load in a browser, and once per process here — so a test that did not
  // reset it would be reading the previous test's choice.
  forgetTheme();
});

describe("the accent", () => {
  it("is burnt orange until somebody says otherwise", () => {
    mount();
    expect(DEFAULT_THEME).toBe("orange");
    expect(accentOf()).toContain(THEMES.orange.accent);
  });

  it("changes the whole subtree through one variable", () => {
    mount();
    fireEvent.click(screen.getByTestId("theme-green"));
    expect(accentOf()).toContain(THEMES.green.accent);
    expect(screen.getByTestId("theme-green")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("is still there on the next page", () => {
    const first = mount();
    fireEvent.click(screen.getByTestId("theme-green"));
    expect(window.localStorage.getItem("ghad.theme")).toBe("green");
    first.unmount();
    mount();
    expect(accentOf()).toContain(THEMES.green.accent);
  });

  it("renders perfectly well where storage refuses", () => {
    const getItem = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("blocked");
    };
    try {
      mount();
      // The default is a perfectly good answer, and a private window is not a
      // reason for Discovery to fail to render.
      expect(accentOf()).toContain(THEMES.orange.accent);
    } finally {
      window.localStorage.getItem = getItem;
    }
  });
});
