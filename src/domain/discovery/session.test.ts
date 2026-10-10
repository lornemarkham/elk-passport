import { describe, expect, it } from "vitest";
import {
  pendingParam,
  readPending,
  readSession,
  sessionHref,
  sessionQuery,
  situationOf,
  type DiscoverySession,
} from "./session";

/**
 * **The exploration a real person lost, three times in one sitting.**
 *
 * They chose *Farms & markets*, said they had a young child and half a day,
 * typed `farm`, found Kangaroo Creek Farm and pressed **Want to do**. Passport
 * asked them to sign in and sent them to `/auth?next=%2Fdiscovery`. Everything
 * except the category lived in React state, so the full page load destroyed
 * it — and the press itself was never carried anywhere at all.
 *
 * An exploration is a place. These pin that it can be written down, read back,
 * and survive the round trip.
 */

const FULL: DiscoverySession = {
  intent: "local",
  query: "farm",
  kind: "Place",
  company: "child",
  window: "half-day",
  doing: "Playground",
};

describe("writing an exploration down", () => {
  it("survives being written and read back", () => {
    expect(readSession(new URLSearchParams(sessionQuery(FULL)))).toEqual(FULL);
  });

  it("writes nothing for an exploration nobody has started", () => {
    expect(sessionQuery({})).toBe("");
    expect(sessionHref({})).toBe("/discovery");
  });

  it("is the same string for the same exploration", () => {
    // A URL that reshuffles its own parameters breaks the back button's idea
    // of where it has been.
    expect(sessionQuery(FULL)).toBe(sessionQuery({ ...FULL }));
    expect(sessionQuery(FULL)).toBe(
      "intent=local&q=farm&kind=Place&who=child&how=half-day&doing=Playground",
    );
  });

  it("keeps what somebody typed, spaces and all", () => {
    const href = sessionHref({ query: "kangaroo creek" });
    expect(href).toContain("q=kangaroo+creek");
    expect(readSession(new URLSearchParams(href.split("?")[1]))).toEqual({
      query: "kangaroo creek",
    });
  });
});

describe("reading one a stranger wrote", () => {
  it("drops a value this product does not recognise", () => {
    // Somebody editing the address bar, or an old link. Behaving as though
    // they had not chosen anything beats repairing it into something else.
    const said = readSession(
      new URLSearchParams("intent=badgers&who=ferret&how=forever&kind=Moon"),
    );
    expect(said).toEqual({});
  });

  it("ignores blank text rather than searching for nothing", () => {
    expect(readSession(new URLSearchParams("q=%20%20"))).toEqual({});
  });

  it("reads an exploration someone was linked into", () => {
    // Passport's own homepage tiles link straight into a category.
    expect(readSession(new URLSearchParams("intent=local"))).toEqual({
      intent: "local",
    });
  });
});

describe("the two situational answers", () => {
  it("are handed to the panel as it wants them", () => {
    expect(situationOf(FULL)).toEqual({ company: "child", window: "half-day" });
  });

  it("are empty before anybody has answered", () => {
    expect(situationOf({ intent: "local" })).toEqual({});
  });
});

describe("the button they pressed before being interrupted", () => {
  it("rides along with the exploration", () => {
    const href = sessionHref(FULL, {
      do: pendingParam({ act: "want", id: "kangaroo-creek" }),
    });
    expect(href).toContain("intent=local");
    expect(href).toContain("q=farm");
    expect(href).toContain("do=want%3Akangaroo-creek");
  });

  it("comes back as the same intent, on the same thing", () => {
    expect(
      readPending(new URLSearchParams("do=want%3Akangaroo-creek")),
    ).toEqual({ act: "want", id: "kangaroo-creek" });
    expect(readPending(new URLSearchParams("do=save%3Apolson"))).toEqual({
      act: "save",
      id: "polson",
    });
  });

  it("keeps saving and wanting apart", () => {
    // They do different things — one writes to a board, the other to this
    // person's October — so collapsing them here would quietly change which
    // happened while somebody was signing in.
    expect(readPending(new URLSearchParams("do=keep%3Ax"))).toBeUndefined();
  });

  it("survives an id with a colon in it", () => {
    expect(readPending(new URLSearchParams("do=save%3Aa%3Ab"))).toEqual({
      act: "save",
      id: "a:b",
    });
  });

  it("is nothing at all when nobody pressed anything", () => {
    expect(readPending(new URLSearchParams(""))).toBeUndefined();
    expect(readPending(new URLSearchParams("do="))).toBeUndefined();
    expect(readPending(new URLSearchParams("do=save%3A"))).toBeUndefined();
    expect(readPending(new URLSearchParams("do=save"))).toBeUndefined();
  });
});
