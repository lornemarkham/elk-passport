import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { GoHaveADay } from "./GoHaveADay";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate, RainReading } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";

/**
 * **Talking to the day and touching it are the same conversation.**
 *
 * Fixture subjects only. These drive the real component: a sentence builds a
 * day, the controls change it, a sentence changes it again, and what the
 * person chose survives.
 */
const VERNON = townById("vernon")!;

const place = (
  name: string,
  km: number,
  affordances: string[],
  extra: Partial<DiscoveryCandidate> & { rain?: RainReading } = {},
): DiscoveryCandidate => {
  const { rain, ...rest } = extra;
  return {
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    subtype: "park",
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    geography: {
      state: "observed",
      locality: "Vernon",
      area: { id: "okanagan", name: "Okanagan" },
      coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
    },
    knowledge: {
      affordances: affordances.map((n) => ({
        name: n,
        basis: "stated-activity",
      })),
    },
    ...(rain
      ? { environment: { rain: { reading: rain, basis: "stated" } } }
      : {}),
    ...rest,
  } as DiscoveryCandidate;
};

const POOL = [
  place("Lakeside Beach", 2, ["swimming", "beach"], {
    subtype: "beach",
    rain: "exposed",
  }),
  place("Ridge Trail", 6, ["hiking"], { subtype: "trail" }),
  place("Town Playground", 1, ["playground", "picnic"]),
  place("Rose Garden", 3, ["garden walk"], { subtype: "garden" }),
  place("Science Hall", 2.5, ["interactive exhibits"], {
    subtype: "science centre",
    rain: "sheltered",
  }),
  place("Covered Market", 4, ["market"], {
    subtype: "market",
    rain: "partly-sheltered",
  }),
].map(candidateToExperience);

const stops = () =>
  screen
    .getAllByTestId("go-stop")
    .map((s) => within(s).getByRole("heading", { level: 3 }).textContent);

const mount = (say = "three hours near Vernon") =>
  render(
    <GoHaveADay
      pool={POOL}
      today="2026-10-11"
      on="2099-01-01"
      initialSay={say}
    />,
  );

beforeEach(() => {
  // Each test starts a fresh tab: no day shaped here before.
  window.sessionStorage.clear();
  // No forecast in tests: the day is not today, so none is fetched.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    ),
  );
});

describe("Go have a day", () => {
  it("comes back from the paper to the day that was shaped, not a fresh one", () => {
    const first = mount();
    fireEvent.click(screen.getByTestId("go-down-1"));
    const shaped = stops();
    const query = screen.getByTestId("go-offline").getAttribute("href");
    first.unmount();
    // Back from /go/print: the same address, mounted again.
    mount();
    expect(stops()).toEqual(shaped);
    expect(screen.getByTestId("go-offline").getAttribute("href")).toBe(query);
  });

  it("asks the forecast route that exists", () => {
    render(
      <GoHaveADay
        pool={POOL}
        today="2026-10-11"
        on="2026-10-11"
        initialSay="three hours near Vernon"
      />,
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/environment/here",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("builds a day from a sentence, and says what it is working from", () => {
    mount("leave at 10, home by 1, the two of us, near Vernon");
    expect(stops().length).toBeGreaterThan(0);
    const from = screen.getByTestId("go-working-from").textContent!;
    expect(from).toContain("Leave 10 am");
    expect(from).toContain("Home by 1 pm");
    expect(from).toContain("For two");
    expect(screen.getByTestId("go-start").textContent).toContain(
      "Leave from Vernon",
    );
    expect(screen.getByTestId("go-home").textContent).toContain("by 1 pm");
    expect(screen.getByTestId("go-time-bar")).toBeTruthy();
  });

  it("says when it assumed the hours", () => {
    mount("near Vernon");
    expect(screen.getByTestId("go-working-from").textContent).toContain(
      "assumed",
    );
  });

  it("offers real alternatives on swap, and uses the one picked", () => {
    mount();
    const first = stops()[0];
    fireEvent.click(screen.getByTestId("go-replace-1"));
    const options = within(
      screen.getByTestId("go-alternatives"),
    ).getAllByTestId("go-choose");
    expect(options.length).toBeGreaterThan(0);
    fireEvent.click(options[0]!);
    expect(stops()[0]).not.toBe(first);
    expect(screen.getByTestId("go-reply").textContent).toMatch(/Swapped in/);
    // A pick is a choice, and choices are kept.
    expect(screen.getByTestId("go-keep-1").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("keeps a kept stop through a sentence that changes everything else", () => {
    mount();
    fireEvent.click(screen.getByTestId("go-keep-2"));
    const kept = stops()[1];
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "make it more adventurous, under cover" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    expect(stops()).toContain(kept);
    expect(screen.getByTestId("go-reply").textContent).toMatch(
      /Leaning adventurous/,
    );
  });

  it("reorders, removes and adds stops", () => {
    mount();
    const [a, b] = stops();
    fireEvent.click(screen.getByTestId("go-down-1"));
    expect(stops().slice(0, 2)).toEqual([b, a]);
    const before = stops().length;
    fireEvent.click(screen.getByTestId("go-remove-1"));
    expect(stops().length).toBe(before - 1);
    fireEvent.click(screen.getByTestId("go-add-stop"));
    expect(stops().length).toBe(before);
  });

  it("gives a stop more time and says it was set by hand", () => {
    mount();
    fireEvent.click(screen.getByTestId("go-more-1"));
    const first = screen.getAllByTestId("go-stop")[0]!;
    expect(within(first).getByTestId("go-time").textContent).toMatch(
      /the time you set/,
    );
  });

  it("opens alternatives when told to swap in words", () => {
    mount();
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "swap the second one" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    expect(screen.getByTestId("go-alternatives")).toBeTruthy();
  });

  it("says so when it hears nothing to change", () => {
    mount();
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "hmm" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    expect(screen.getByTestId("go-reply").textContent).toMatch(/didn't catch/);
  });

  it("asks a family how old, and sends the age to Atlas by reloading with it", () => {
    mount("the family, near Vernon");
    const link = screen.getByTestId("go-age-6");
    expect(link.getAttribute("href")).toContain("age=6");
  });

  it("offers a rain plan for an exposed stop, and uses it on request", () => {
    mount("near Vernon, swimming");
    const plan = screen.getAllByTestId("go-rain-plan")[0]!;
    expect(plan.textContent).toMatch(/Science Hall|Covered Market/);
    const index = screen
      .getAllByTestId("go-stop")
      .findIndex((s) => within(s).queryByTestId("go-rain-plan"));
    fireEvent.click(screen.getByTestId(`go-use-rain-${index + 1}`));
    expect(stops()).not.toContain("Lakeside Beach");
  });

  it("keeps facts and suggestions visibly apart", () => {
    mount();
    expect(screen.getAllByLabelText("Stated").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Suggestion").length).toBeGreaterThan(0);
  });

  it("carries the day it shows to the paper", () => {
    mount("four hours, $40, near Vernon");
    fireEvent.click(screen.getByTestId("go-more-1"));
    const href = screen.getByTestId("go-print").getAttribute("href")!;
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("stops")!.split(",")).toHaveLength(stops().length);
    expect(params.get("mins")).toMatch(/:\d+/);
    expect(JSON.parse(params.get("b")!).budget).toBe(40);
  });
});
