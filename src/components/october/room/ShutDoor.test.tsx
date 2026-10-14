import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSAGE_KEY } from "@/domain/october/passage";
import { RoomThreshold } from "./RoomThreshold";
import { ShutDoor } from "./ShutDoor";

vi.mock("./roomAudio", () => ({
  armRoomAudio: vi.fn(),
  felt: vi.fn(),
  play: vi.fn(),
  stopRoomAudio: vi.fn(),
  setRoomMuted: vi.fn(),
  roomMuted: () => false,
  setPressure: vi.fn(),
  tuneRadio: vi.fn(),
}));

describe("the shut door", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("says only what the date allows, and shows no light before the light", () => {
    render(<ShutDoor threshold={{ kind: "not-yet" }} />);
    expect(screen.getByTestId("shut-door-line")).toHaveTextContent("Not yet.");
    expect(screen.queryByTestId("shut-door-light")).toBeNull();
  });

  it("holds a steady light, and a count, in the last six nights", () => {
    render(<ShutDoor threshold={{ kind: "counting", nights: 6 }} />);
    expect(screen.getByTestId("shut-door-line")).toHaveTextContent(
      "Six nights.",
    );
    expect(screen.getByTestId("shut-door-light")).toBeInTheDocument();
  });

  it("answers a knock after a breath", () => {
    render(<ShutDoor threshold={{ kind: "not-yet" }} />);
    fireEvent.click(screen.getByTestId("shut-door-knock"));
    expect(screen.queryByTestId("shut-door-answer")).toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("shut-door-answer")).toHaveTextContent(
      "Not yet.",
    );
  });

  it("offers a way out that is not the browser's back button", () => {
    render(<ShutDoor threshold={{ kind: "not-yet" }} />);
    expect(screen.getByTestId("shut-door-leave")).toHaveAttribute(
      "href",
      "/october/from",
    );
  });
});

describe("the Room's front door", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    window.localStorage.removeItem(PASSAGE_KEY);
  });
  afterEach(() => vi.useRealTimers());

  it("is the door before Halloween, and the room on it", () => {
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    const early = render(<RoomThreshold />);
    expect(screen.getByTestId("shut-door")).toHaveAttribute(
      "data-threshold",
      "not-yet",
    );
    early.unmount();

    vi.setSystemTime(new Date(2026, 9, 31, 12));
    render(<RoomThreshold />);
    expect(screen.getByTestId("secret-room")).toBeInTheDocument();
  });

  it("lets in someone who has been in before", () => {
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    window.localStorage.setItem(PASSAGE_KEY, JSON.stringify({ entered: 5 }));
    render(<RoomThreshold />);
    expect(screen.getByTestId("secret-room")).toBeInTheDocument();
  });
});
