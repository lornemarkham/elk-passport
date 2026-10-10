import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useHere } from "./useHere";

/**
 * **Passport does not know where you are, and must not imply that it does.**
 *
 * Discovery forecast for Vernon because the *corpus* is about Vernon. Shown
 * without qualification that is a lie to everybody else holding the phone, and
 * the fix is not a better guess — there is no honest guess. It is to ask, once,
 * and to be straight about every way the asking can fail.
 *
 * These pin the four outcomes, and the one rule that matters more than any of
 * them: a position that is never collected cannot be leaked, so nothing here
 * keeps one anywhere a reload would survive.
 */

const position = { coords: { latitude: 50.258136, longitude: -119.269061 } };
const geolocation = { getCurrentPosition: vi.fn() };
const fetchMock = vi.fn();

function Probe() {
  const { place, weather, at, ask } = useHere();
  return (
    <div>
      <span data-testid="state">{place.state}</span>
      <span data-testid="lapse">{place.lapse ?? ""}</span>
      <span data-testid="area">{place.area ?? ""}</span>
      <span data-testid="km">{place.km ?? ""}</span>
      <span data-testid="sky">{weather?.description ?? ""}</span>
      <span data-testid="at">{at ? `${at.latitude},${at.longitude}` : ""}</span>
      {ask && (
        <button type="button" data-testid="ask" onClick={ask}>
          Use my location
        </button>
      )}
    </div>
  );
}

const grants = () =>
  geolocation.getCurrentPosition.mockImplementation(
    (ok: (p: unknown) => void) => ok(position),
  );

const denies = () =>
  geolocation.getCurrentPosition.mockImplementation(
    (_ok: unknown, fail: (e: unknown) => void) =>
      fail({ code: 1, PERMISSION_DENIED: 1 }),
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
  it("claims nothing and asks the browser nothing", () => {
    render(<Probe />);
    expect(screen.getByTestId("state")).toHaveTextContent("default");
    expect(screen.getByTestId("at")).toBeEmptyDOMElement();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("offers, without explaining itself first", () => {
    render(<Probe />);
    // No consent essay, no second step before the browser's own prompt.
    expect(screen.getByTestId("ask")).toBeInTheDocument();
  });
});

describe("permission granted", () => {
  it("holds the area, the distance and the sky", async () => {
    grants();
    answers({
      wet: false,
      description: "Sunny",
      source: "Environment Canada",
      area: "Kamloops",
      km: 12,
    });
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("observed"),
    );
    expect(screen.getByTestId("area")).toHaveTextContent("Kamloops");
    expect(screen.getByTestId("km")).toHaveTextContent("12");
    expect(screen.getByTestId("sky")).toHaveTextContent("Sunny");
  });

  it("sends a position rounded to about a kilometre, in a body and not a URL", async () => {
    grants();
    answers({ wet: false, source: "Environment Canada", area: "Vernon" });
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/environment/here");
    expect(String(url)).not.toContain("50.2");
    // 50.258136 → 50.26. Two decimals is ~1 km, and the forecast lookup
    // searches 65 km, so the precision discarded was never doing any work.
    expect(JSON.parse(init.body)).toEqual({
      latitude: 50.26,
      longitude: -119.27,
    });
  });

  it("keeps the blunted position in memory, and only the blunted one", async () => {
    // The page asks "which of these is near me" and answers it here, in the
    // browser, against coordinates Atlas already published. Nothing precise
    // is kept, because nothing precise was ever received.
    grants();
    answers({ wet: false, source: "Environment Canada", area: "Vernon" });
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));

    await waitFor(() =>
      expect(screen.getByTestId("at")).toHaveTextContent("50.26,-119.27"),
    );
  });

  it("writes it nowhere a reload would survive", async () => {
    grants();
    answers({ wet: false, source: "Environment Canada", area: "Vernon" });
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("observed"),
    );
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("shows that it is working while the browser decides", () => {
    // The prompt can sit there as long as the person takes to read it.
    geolocation.getCurrentPosition.mockImplementation(() => {});
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));
    expect(screen.getByTestId("state")).toHaveTextContent("asking");
    expect(screen.queryByTestId("ask")).not.toBeInTheDocument();
  });
});

describe("permission denied", () => {
  it("says which kind of nothing it got", () => {
    denies();
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));
    expect(screen.getByTestId("state")).toHaveTextContent("unavailable");
    expect(screen.getByTestId("lapse")).toHaveTextContent("denied");
  });

  it("never asks again", () => {
    denies();
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));
    // Re-prompting somebody who said no is how a product earns a permanent
    // block, and the offer is gone for this visit.
    expect(screen.queryByTestId("ask")).not.toBeInTheDocument();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("holds no position at all", () => {
    denies();
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));
    expect(screen.getByTestId("at")).toBeEmptyDOMElement();
  });
});

describe("granted, and there is nothing to answer with", () => {
  it("distinguishes no forecast nearby from a failure", async () => {
    // Environment Canada publishes Canadian cities. Somebody far from any of
    // them gets nothing, and that is not the same as something breaking.
    grants();
    answers(undefined);
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));

    await waitFor(() =>
      expect(screen.getByTestId("lapse")).toHaveTextContent("no-forecast"),
    );
  });

  it("still knows where they are when the sky is unavailable", async () => {
    // Caught by dogfooding: a minute when Environment Canada did not answer
    // for Kelowna also removed every possibility Passport could place near
    // somebody standing in it. A weather outage is not amnesia.
    grants();
    answers(undefined);
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));

    await waitFor(() =>
      expect(screen.getByTestId("at")).toHaveTextContent("50.26,-119.27"),
    );
  });

  it("retreats when the lookup itself fails", async () => {
    grants();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    render(<Probe />);
    fireEvent.click(screen.getByTestId("ask"));

    await waitFor(() =>
      expect(screen.getByTestId("lapse")).toHaveTextContent("failed"),
    );
  });
});

describe("a browser that cannot do this at all", () => {
  it("is never offered it, and is told nothing about it", () => {
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });
    render(<Probe />);
    expect(screen.queryByTestId("ask")).not.toBeInTheDocument();
    // Still `default`: the page says it is showing an area default, which is
    // true, rather than reporting a capability the reader cannot act on.
    expect(screen.getByTestId("state")).toHaveTextContent("default");
  });
});
