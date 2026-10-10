import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import { EMPTY_SITUATION } from "@/domain/discovery/situation";
import { TodayPanel, placeNote } from "./TodayPanel";

/**
 * **Passport does not know where you are, and must not imply that it does.**
 *
 * Discovery forecast for Vernon because the *corpus* is about Vernon. Shown
 * without qualification that is a lie to everybody else holding the phone, and
 * the fix is not a better guess — there is no honest guess. It is to label the
 * default as a default and let a person replace it.
 *
 * So these pin the four outcomes and the line between them: nothing claimed
 * before consent, something precise-sounding only once a real forecast comes
 * back, an honest retreat when it does not, and never a second prompt.
 */

const VERNON = {
  wet: true,
  chance: 70,
  description: "Chance of showers",
  source: "Environment Canada",
  area: "Vernon",
};

const position = { coords: { latitude: 50.2581, longitude: -119.2691 } };
const geolocation = { getCurrentPosition: vi.fn() };
const fetchMock = vi.fn();

function panel(weather: typeof VERNON | null = VERNON) {
  return render(
    <TodayPanel
      today="Saturday, October 10"
      {...(weather ? { weather } : {})}
      experiences={[] as readonly Experience[]}
      situation={EMPTY_SITUATION}
      onSituation={() => {}}
    />,
  );
}

const grants = () =>
  geolocation.getCurrentPosition.mockImplementation(
    (ok: (p: unknown) => void) => ok(position),
  );

const answers = (weather: unknown) =>
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => (weather ? { weather } : {}),
  });

beforeEach(() => {
  geolocation.getCurrentPosition.mockReset();
  fetchMock.mockReset();
  Object.defineProperty(navigator, "geolocation", {
    value: geolocation,
    configurable: true,
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("before anybody has said anything", () => {
  it("calls the default area a default, in so many words", () => {
    panel();
    expect(screen.getByTestId("today-area")).toHaveTextContent("Vernon area");
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "not for wherever you are",
    );
  });

  it("offers to use the reader's location, without explaining itself first", () => {
    panel();
    expect(screen.getByTestId("use-my-location")).toBeInTheDocument();
    // No modal, no consent essay, no second step before the browser prompt.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks the browser for nothing until it is tapped", () => {
    panel();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe("permission granted", () => {
  it("replaces the forecast with one for near the reader, and says how near", async () => {
    grants();
    answers({
      wet: false,
      description: "Sunny",
      source: "Environment Canada",
      area: "Kamloops",
      km: 12,
    });
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));

    await waitFor(() =>
      expect(screen.getByTestId("today-known")).toHaveTextContent("Sunny"),
    );
    // "Kamloops", not "the Kamloops area": a forecast is now being shown
    // because of where this person is, and it names the city it belongs to.
    expect(screen.getByTestId("today-area")).toHaveTextContent("Kamloops");
    expect(screen.getByTestId("today-area")).not.toHaveTextContent("area");
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Nearest forecast to you — Kamloops, about 12 km away",
    );
  });

  it("sends a position rounded to about a kilometre, in a body and not a URL", async () => {
    grants();
    answers({ wet: false, source: "Environment Canada", area: "Vernon" });
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/environment/here");
    expect(String(url)).not.toContain("50.2");
    // 50.2581 → 50.26. Two decimals is ~1 km, and the forecast lookup searches
    // 65 km, so the precision thrown away here was never doing any work.
    expect(JSON.parse(init.body)).toEqual({
      latitude: 50.26,
      longitude: -119.27,
    });
  });

  it("shows that it is working while the browser decides", () => {
    // The prompt can sit there for as long as the person takes to read it.
    geolocation.getCurrentPosition.mockImplementation(() => {});
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));
    expect(screen.getByTestId("location-asking")).toBeInTheDocument();
    expect(screen.queryByTestId("use-my-location")).not.toBeInTheDocument();
  });
});

describe("permission denied", () => {
  const denies = () =>
    geolocation.getCurrentPosition.mockImplementation(
      (_ok: unknown, fail: (e: unknown) => void) =>
        fail({ code: 1, PERMISSION_DENIED: 1 }),
    );

  it("carries on with the default, and says which it is", () => {
    denies();
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Showing the Vernon area, since Passport can't see where you are",
    );
    expect(screen.getByTestId("today-area")).toHaveTextContent("Vernon area");
  });

  it("never asks again", () => {
    denies();
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));
    // The offer is gone for this visit. Re-prompting somebody who said no is
    // how a product earns a permanent block.
    expect(screen.queryByTestId("use-my-location")).not.toBeInTheDocument();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("still shows the rest of Discovery", () => {
    denies();
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));
    expect(screen.getByTestId("today-panel")).toBeInTheDocument();
    expect(screen.getByTestId("today-known")).toHaveTextContent(
      "Chance of showers",
    );
  });
});

describe("granted, and there is no forecast for where they are", () => {
  it("says so rather than inventing one", async () => {
    // Environment Canada publishes Canadian cities. Somebody in Seattle, or
    // far enough from any of them, gets nothing — and is told that.
    grants();
    answers(undefined);
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));

    await waitFor(() =>
      expect(screen.getByTestId("today-place")).toHaveTextContent(
        "Environment Canada publishes no forecast near you",
      ),
    );
    expect(screen.getByTestId("today-area")).toHaveTextContent("Vernon area");
    expect(screen.queryByTestId("use-my-location")).not.toBeInTheDocument();
  });

  it("retreats to the default when the lookup itself fails", async () => {
    grants();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    panel();
    fireEvent.click(screen.getByTestId("use-my-location"));

    await waitFor(() =>
      expect(screen.getByTestId("today-place")).toHaveTextContent(
        "Showing the Vernon area",
      ),
    );
  });
});

describe("a browser that cannot do this at all", () => {
  it("is never offered it, and is told the truth anyway", () => {
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });
    panel();
    expect(screen.queryByTestId("use-my-location")).not.toBeInTheDocument();
    // The default is still labelled as a default. A capability the reader
    // cannot act on is not worth a sentence; the gap it leaves is.
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Forecast for the Vernon area — not for wherever you are",
    );
  });
});

describe("with no forecast at all", () => {
  it("claims no area, and still offers to find one", () => {
    panel(null);
    expect(screen.queryByTestId("today-area")).not.toBeInTheDocument();
    expect(screen.getByTestId("today-place")).toHaveTextContent(
      "Passport has no forecast for today",
    );
    expect(screen.getByTestId("use-my-location")).toBeInTheDocument();
  });
});

describe("the sentence itself", () => {
  it("never names a coordinate, in any state", () => {
    const states = [
      placeNote({ state: "default" }, "Vernon"),
      placeNote({ state: "observed", area: "Vernon", km: 11 }, "Vernon"),
      placeNote({ state: "unavailable", lapse: "denied" }, "Vernon"),
      placeNote({ state: "unavailable", lapse: "no-forecast" }, "Vernon"),
      placeNote({ state: "unavailable", lapse: "failed" }, "Vernon"),
    ];
    for (const said of states) {
      expect(said).not.toMatch(/-?\d+\.\d{2,}/);
      expect(said).not.toContain("latitude");
    }
  });

  it("distinguishes a default it was given from one it fell back to", () => {
    expect(placeNote({ state: "default" }, "Vernon")).not.toEqual(
      placeNote({ state: "unavailable", lapse: "denied" }, "Vernon"),
    );
  });
});
