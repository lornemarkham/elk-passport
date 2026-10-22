import { describe, expect, it } from "vitest";
import { gateById, type ArenaGate } from "./arena";
import { destinationFor, preferredOrder, walkingLinks } from "./directions";

const venue = {
  name: "Rogers Arena",
  at: [49.2778, -123.1088] as [number, number],
};

describe("destinationFor", () => {
  it("ends at the arena, and says why, for a gate with no verified point", () => {
    const d = destinationFor(venue, gateById("10"));
    expect(d.at).toEqual({ latitude: 49.2778, longitude: -123.1088 });
    expect(d.gate).toBeUndefined();
    expect(d.because).toMatch(/no verified location for Gate 10/);
  });
  it("ends at the gate once it has a verified point", () => {
    const gate: ArenaGate = { ...gateById("10")!, at: [49.2785, -123.1085] };
    const d = destinationFor(venue, gate);
    expect(d).toMatchObject({ gate: "Gate 10", at: { latitude: 49.2785 } });
    expect(d.because).toBeUndefined();
  });
  it("says nothing extra when no gate was chosen", () => {
    expect(destinationFor(venue, undefined).because).toBeUndefined();
  });
});

describe("walkingLinks", () => {
  const to = destinationFor(venue, undefined);
  it("walks from a restaurant in both apps", () => {
    const [google, apple] = walkingLinks(to, {
      name: "Chambar",
      at: { latitude: 49.2803, longitude: -123.1095 },
    });
    const g = new URL(google.href);
    expect(g.origin + g.pathname).toBe("https://www.google.com/maps/dir/");
    expect(g.searchParams.get("travelmode")).toBe("walking");
    expect(g.searchParams.get("origin")).toBe("49.280300,-123.109500");
    expect(g.searchParams.get("destination")).toBe("49.277800,-123.108800");
    const a = new URL(apple.href);
    expect(a.host).toBe("maps.apple.com");
    expect(a.searchParams.get("dirflg")).toBe("w");
    expect(a.searchParams.get("saddr")).toBe("49.280300,-123.109500");
  });
  it("starts from the phone when there is no origin", () => {
    const [google, apple] = walkingLinks(to);
    expect(new URL(google.href).searchParams.has("origin")).toBe(false);
    expect(new URL(apple.href).searchParams.has("saddr")).toBe(false);
  });
  it("puts Apple Maps first on an iPhone", () => {
    const links = walkingLinks(to);
    expect(
      preferredOrder(links, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")[0].app,
    ).toBe("apple");
    expect(
      preferredOrder(links, "Mozilla/5.0 (Linux; Android 15)")[0].app,
    ).toBe("google");
  });
});
