import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { WhatSheRemembers } from "./WhatSheRemembers";
import { rememberEncounter } from "@/lib/october/foundYou";
import {
  REMEMBERS_NOTHING,
  forgetEverything,
  rememberNight,
  whatOctoberRemembers,
} from "@/lib/october/remembers";

describe("what she remembers, shown to the person she remembers", () => {
  afterEach(() => forgetEverything());

  it("shows nothing at all to somebody she has not met", () => {
    const { container } = render(<WhatSheRemembers />);
    expect(container.textContent).toBe("");
  });

  it("lists what was kept, and says it is only this browser", () => {
    rememberEncounter({ number: "31", door: "STAY", hearing: "YES" });
    rememberNight("outside");
    render(<WhatSheRemembers />);
    expect(screen.getByText("That you chose STAY.")).toBeTruthy();
    expect(
      screen.getByText("That you went outside, the last night."),
    ).toBeTruthy();
    expect(screen.getByText(/Only in this browser/)).toBeTruthy();
    expect(
      screen.getByText(/does not follow you to another device/),
    ).toBeTruthy();
  });

  it("forgets when asked, and says so", async () => {
    rememberEncounter({ door: "LEAVE" });
    render(<WhatSheRemembers />);
    await act(async () => {
      screen.getByRole("button", { name: "Make her forget" }).click();
    });
    expect(whatOctoberRemembers()).toEqual(REMEMBERS_NOTHING);
    expect(screen.getByTestId("october-forgot")).toBeTruthy();
    expect(screen.queryByText("That you chose LEAVE.")).toBeNull();
  });
});
