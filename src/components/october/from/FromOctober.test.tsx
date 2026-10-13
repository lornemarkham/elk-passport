import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  DOORS,
  FromOctoberBand,
  FromOctoberDoors,
  lineFor,
} from "./FromOctober";
import { PASSAGE_KEY } from "@/domain/october/passage";

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PASSAGE_KEY);
});

describe("From October", () => {
  it("is one visible link on Discover, to the doors", () => {
    render(<FromOctoberBand />);
    const link = screen.getByTestId("from-october");
    expect(link).toHaveAttribute("href", "/october/from");
    expect(link).toHaveTextContent("From October");
  });

  it("opens two doors, to the room and the store", () => {
    render(<FromOctoberDoors />);
    expect(screen.getByTestId("door-room")).toHaveAttribute(
      "href",
      "/october/room",
    );
    expect(screen.getByTestId("door-store")).toHaveAttribute(
      "href",
      "/october/store",
    );
  });

  it("says only what is true of what you have carried", () => {
    const [room, store] = DOORS as [
      (typeof DOORS)[number],
      (typeof DOORS)[number],
    ];
    expect(lineFor(room, {})).toBe(room.line);
    expect(lineFor(store, {})).toBe(store.line);
    expect(lineFor(store, { tape: 1 })).toMatch(/bottom shelf/);
    expect(lineFor(store, { escaped: 1 })).toMatch(/different now/);
    expect(lineFor(room, { escaped: 1 })).toMatch(/got out/);
    expect(lineFor(room, { escaped: 1, played: 2 })).toMatch(
      /watched the tape/,
    );
  });

  it("reads what is in storage once it has mounted", () => {
    window.localStorage.setItem(PASSAGE_KEY, JSON.stringify({ tape: 5 }));
    render(<FromOctoberDoors />);
    expect(screen.getByTestId("door-store-line")).toHaveTextContent(
      /bottom shelf/,
    );
  });
});

describe("the Room's door before it opens", () => {
  it("says what the date says, in the Room's own words", () => {
    const [room, store] = DOORS as [
      (typeof DOORS)[number],
      (typeof DOORS)[number],
    ];
    expect(lineFor(room, {}, { kind: "not-yet" })).toBe("Not yet.");
    expect(lineFor(room, {}, { kind: "counting", nights: 6 })).toBe(
      "Six nights.",
    );
    // An open door is the door it always was, and the store is not the room.
    expect(lineFor(room, {}, { kind: "open" })).toBe(room.line);
    expect(lineFor(store, {}, { kind: "not-yet" })).toBe(store.line);
  });
});
