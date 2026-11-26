import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { strongest, type AroundSection } from "./around";
import type { Find } from "./discover";

/** The front page's four (mission 1126): pictured lead, but never past the town. */
function find(id: string, km: number, pictured: boolean, run = false): Find {
  const experience = {
    id,
    title: id,
    ...(pictured
      ? { heroMedia: { type: "image", src: `https://example.org/${id}.jpg` } }
      : {}),
  } as unknown as Experience;
  return { experience, km, run } as unknown as Find;
}
const section = (finds: Find[]) =>
  ({ id: "soon", finds, pins: [] }) as unknown as AroundSection;
const longRun = (f: Find) => Boolean((f as unknown as { run: boolean }).run);
const ids = (fs: Find[]) => fs.map((f) => f.experience.id);

describe("the front page's strongest four", () => {
  it("puts the town's pictured finds before its text-only ones, otherwise in order", () => {
    const got = strongest(
      [
        section([
          find("a", 1, false),
          find("b", 2, true),
          find("c", 3, false),
          find("d", 4, true),
        ]),
      ],
      4,
      longRun,
    );
    expect(ids(got)).toEqual(["b", "d", "a", "c"]);
  });

  it("never lifts a pictured find from beyond the town over the town's own", () => {
    const got = strongest(
      [
        section([
          find("vernon-friday", 0, false),
          find("lake-country", 25, true),
        ]),
      ],
      2,
      longRun,
    );
    expect(ids(got)).toEqual(["vernon-friday", "lake-country"]);
  });

  it("keeps a year-long run from leading, pictured or not", () => {
    const got = strongest(
      [section([find("run", 1, true, true), find("night", 2, false)])],
      2,
      longRun,
    );
    expect(ids(got)).toEqual(["night", "run"]);
  });

  it("says each find once across sections", () => {
    const a = find("a", 1, true);
    expect(
      ids(
        strongest(
          [section([a]), section([a, find("b", 1, false)])],
          4,
          longRun,
        ),
      ),
    ).toEqual(["a", "b"]);
  });
});
