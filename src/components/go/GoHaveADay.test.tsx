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

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn() }),
}));

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
  window.localStorage.removeItem("ghad.last-start");
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
    fireEvent.click(screen.getByTestId("go-age-6"));
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push.mock.calls[0]![0]).toContain("age=6");
  });

  it("carries the kept stops to the new address when the age changes", () => {
    mount("the family, near Vernon");
    const first = stops()[0]!;
    fireEvent.click(screen.getByTestId("go-keep-1"));
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "youngest is 6" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    const to = nav.push.mock.calls[0]![0] as string;
    expect(to).toContain("age=6");
    expect(to).toContain("at=vernon");
    // The address the browser is about to open finds the shaped day waiting.
    const saved = [...Array(window.sessionStorage.length).keys()]
      .map((i) => window.sessionStorage.key(i)!)
      .map((k) => window.sessionStorage.getItem(k)!)
      .map(
        (v) =>
          JSON.parse(v) as {
            brief: { childAge: number };
            shaping: { keep: string[] };
          },
      )
      .find((v) => v.brief?.childAge === 6);
    expect(saved?.shaping.keep.length).toBe(1);
    expect(first).toBeTruthy();
  });

  it("asks where the adventure begins instead of building a day from nowhere", () => {
    mount("Taking my family out this afternoon");
    expect(screen.getByTestId("go-where")).toBeTruthy();
    expect(screen.queryAllByTestId("go-stop")).toHaveLength(0);
    expect(screen.getByTestId("go-where").textContent).toMatch(
      /Where does the adventure begin/,
    );
    // Said, not lost: the sentence's own words stay on the page.
    expect(screen.getByTestId("go-working-from").textContent).toMatch(
      /family/i,
    );
    fireEvent.click(screen.getByTestId("go-start-vernon"));
    expect(screen.queryByTestId("go-where")).toBeNull();
    expect(screen.getAllByTestId("go-stop").length).toBeGreaterThan(0);
    expect(screen.getByTestId("go-working-from").textContent).toMatch(
      /From Vernon/,
    );
  });

  it("remembers the town that was tapped, and offers it next time without applying it", () => {
    const first = mount("Taking my family out this afternoon");
    expect(screen.queryByTestId("go-start-last")).toBeNull();
    fireEvent.click(screen.getByTestId("go-start-vernon"));
    first.unmount();
    window.sessionStorage.clear();

    mount("A quiet afternoon, just me");
    // Still asked: the person may be somewhere else today.
    expect(screen.getByTestId("go-where")).toBeTruthy();
    expect(screen.queryAllByTestId("go-stop")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("go-start-last"));
    expect(screen.getByTestId("go-working-from").textContent).toMatch(
      /From Vernon/,
    );
  });

  it("says nothing matched and substitutes nothing, and keeps the request on screen", () => {
    mount("Scuba diving with sharks tonight, near Vernon");
    expect(screen.queryAllByTestId("go-stop")).toHaveLength(0);
    const says = screen.getByTestId("go-not-found-says").textContent ?? "";
    expect(says).toMatch(/Nothing Atlas holds says it offers sharks/);
    expect(screen.getByTestId("go-working-from").textContent).toMatch(/sharks/);
    // The way forward is explicit, and is the person's to take.
    // Scuba diving is also missing from this pool; each is set aside by hand.
    fireEvent.click(screen.getByTestId("go-without-scuba-diving"));
    expect(screen.getByTestId("go-not-found")).toBeTruthy();
    fireEvent.click(screen.getByTestId("go-without-sharks"));
    expect(screen.queryByTestId("go-not-found")).toBeNull();
    expect(screen.getByTestId("go-working-from").textContent).toMatch(
      /without sharks/,
    );
  });

  it("reads “let's do Kelowna instead” as a change of start and keeps what was kept", () => {
    mount("three hours near Vernon");
    const first = stops()[0]!;
    fireEvent.click(screen.getByTestId("go-keep-1"));
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "Let's do Kelowna instead" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    expect(screen.getByTestId("go-reply").textContent).toMatch(/Kelowna/);
    expect(screen.getByTestId("go-reply").textContent).not.toMatch(
      /didn't catch/,
    );
    expect(screen.getByTestId("go-working-from").textContent).toMatch(
      /From Kelowna/,
    );
    expect(stops()).toContain(first);
  });

  it("does not throw away a kept stop when the top box is retyped, and can take it back", () => {
    mount("three hours near Vernon");
    const first = stops()[0]!;
    fireEvent.click(screen.getByTestId("go-keep-1"));
    fireEvent.change(screen.getByTestId("go-say"), {
      target: { value: "two hours near Vernon, no hiking" },
    });
    fireEvent.click(screen.getByTestId("go-build"));
    expect(stops()).toContain(first);
    expect(screen.getByTestId("go-reply").textContent).toMatch(/Still kept/);
    fireEvent.click(screen.getByTestId("go-undo"));
    expect(screen.getByTestId("go-say")).toHaveProperty(
      "value",
      "three hours near Vernon",
    );
  });

  it("shows an honest recovery state, and no day, when Atlas did not answer", () => {
    render(
      <GoHaveADay
        pool={[]}
        today="2026-10-11"
        on="2099-01-01"
        initialSay="a day near Vernon"
        atlas="unreachable"
      />,
    );
    expect(screen.getByTestId("atlas-recovery").textContent).toMatch(
      /couldn't reach Atlas/,
    );
    expect(screen.getByTestId("atlas-recovery-said").textContent).toBe(
      "a day near Vernon",
    );
    expect(
      screen.getByTestId("atlas-recovery-retry").getAttribute("href"),
    ).toContain("say=a+day+near+Vernon");
    expect(screen.queryByTestId("go-day")).toBeNull();
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

  it("does not wipe a working day when a revision asks for something nothing offers", () => {
    mount("three hours near Vernon");
    const before = stops();
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "add sharks" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    expect(stops()).toEqual(before);
    expect(screen.getByTestId("go-reply").textContent).toMatch(
      /Nothing Atlas holds says it offers sharks[\s\S]*left your day/,
    );
  });

  it("does not cut a working day down to its kept stop for a request nothing offers", () => {
    mount("three hours near Vernon");
    const before = stops();
    expect(before.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByTestId("go-keep-1"));
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "we want to see sharks" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    expect(stops()).toEqual(before);
    expect(screen.getByTestId("go-reply").textContent).toMatch(
      /Nothing Atlas holds says it offers sharks[\s\S]*left your day/,
    );
  });

  it("says when a refused revision had other parts it did not apply", () => {
    mount("three hours near Vernon");
    fireEvent.click(screen.getByTestId("go-keep-1"));
    fireEvent.change(screen.getByTestId("go-change"), {
      target: { value: "home by 4, also sharks" },
    });
    fireEvent.click(screen.getByTestId("go-change-submit"));
    expect(screen.getByTestId("go-reply").textContent).toMatch(
      /haven't changed anything/,
    );
  });
});
