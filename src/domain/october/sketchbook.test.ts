import { describe, expect, it } from "vitest";
import {
  SCENES,
  builtCount,
  interpretationCount,
  sceneBySlug,
} from "./sketchbook";

/**
 * **A scene is not an implementation.**
 *
 * The one rule the sketchbook exists to protect, and the only thing here worth
 * testing. Everything else is prose, and prose does not need assertions.
 */
describe("the sketchbook", () => {
  it("lets one scene hold several readings at once", () => {
    const many = SCENES.filter((s) => s.interpretations.length > 1);
    expect(many.length).toBeGreaterThan(0);
    // Video Store is already built once and has a second idea beside it; the
    // built one did not replace anything and was not replaced.
    const store = sceneBySlug("video-store")!;
    expect(store.interpretations.length).toBeGreaterThan(1);
    expect(
      store.interpretations.filter((i) => i.status === "built"),
    ).toHaveLength(1);
  });

  it("keeps contradictory readings of the same scene", () => {
    // Scariest Room holds readings that cannot all be true at once: October
    // accepting the photograph, October rejecting it, and October never
    // seeing one. All of them are on the page on purpose.
    //
    // Asserted by membership and not by an exact list — pinning the whole
    // array would mean every new idea breaks a test, which is precisely the
    // pressure to converge that this scene exists to resist.
    const room = sceneBySlug("scariest-room")!;
    const titles = room.interpretations.map((i) => i.title);
    expect(titles).toContain("October has been here");
    expect(titles).toContain("The other one");
    expect(titles).toContain("No photograph at all");
    expect(room.interpretations.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps a reading's own words as words", () => {
    // "No. The other one." only works as two lines with a gap. Folded into a
    // sentence describing it, the idea survives and the effect does not.
    const room = sceneBySlug("scariest-room")!;
    const other = room.interpretations.find(
      (i) => i.title === "The other one",
    )!;
    expect(other.lines).toEqual(["No.", "The other one."]);
  });

  it("only claims something is built when it says where", () => {
    for (const scene of SCENES) {
      for (const reading of scene.interpretations) {
        if (reading.status === "built") expect(reading.href).toBeTruthy();
        else expect(reading.href).toBeUndefined();
      }
    }
  });

  it("points its built readings at routes that exist", () => {
    const built = SCENES.flatMap((s) =>
      s.interpretations.filter((i) => i.status === "built"),
    );
    expect(built.map((b) => b.href).sort()).toEqual([
      "/labs/october/scariest-room/has-been-here",
      "/labs/october/secret-room/another-way-out",
      "/labs/october/video-store",
      "/labs/october/witching-hour",
    ]);
  });

  it("keeps the words, because the words are the idea", () => {
    const room = sceneBySlug("scariest-room")!;
    expect(room.quotes).toContain(
      "Go take a picture of the scariest room in your house.",
    );
    expect(room.quotes).toContain(
      "Come find me. I'm playing in your favourite room.",
    );
  });

  it("gives every scene a slug that resolves, and no duplicates", () => {
    const slugs = SCENES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(sceneBySlug(slug)).toBeDefined();
  });

  it("counts what the room says it counts", () => {
    expect(interpretationCount()).toBe(
      SCENES.reduce((n, s) => n + s.interpretations.length, 0),
    );
    expect(builtCount()).toBe(4);
  });

  it("has somewhere for an idea nobody has had yet", () => {
    // A seed with no reading is a legitimate state — Dragon's Eyes is one.
    const seed = sceneBySlug("dragons-eyes")!;
    expect(seed.interpretations).toHaveLength(1);
    expect(seed.interpretations[0]!.status).toBe("sketch");
  });

  it("keeps building one exit from becoming the whole Secret Room", () => {
    // One playable exit sits beside the unbuilt ones, and the real exit — the
    // reason October's games are alternates at all — stays on the page as an
    // idea nobody has designed yet. If this ever collapses to a single built
    // reading, the scene has quietly become its first implementation.
    const room = sceneBySlug("secret-room")!;
    const titles = room.interpretations.map((i) => i.title);
    expect(titles).toContain("Keep it alight");
    expect(titles).toContain("The real one");
    expect(
      room.interpretations.filter((i) => i.status === "sketch").length,
    ).toBeGreaterThan(1);
  });
});
