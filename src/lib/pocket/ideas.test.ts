import { describe, expect, it } from "vitest";
import {
  dayFrom,
  ideasBoardOf,
  ideasFrom,
  inPocketOrder,
  moved,
  weekendFrom,
} from "./ideas";
import { ideasCount, pocketLine, savedLine } from "@/lib/voice";

const board = (id: string, role?: "owner" | "editor" | "viewer") => ({
  id,
  name: id,
  ...(role ? { role } : {}),
});
const item = (experienceId: string, addedAt: string) => ({
  experienceId,
  addedAt,
});

describe("ideas are every save, whichever board it is on", () => {
  it("unions the person's own boards, newest first, without repeats", () => {
    const ideas = ideasFrom(
      [
        {
          board: board("places"),
          items: [item("a", "2026-10-01"), item("b", "2026-10-03")],
        },
        {
          board: board("wine"),
          items: [item("b", "2026-10-05"), item("c", "2026-10-02")],
        },
      ],
      "places",
    );
    expect(ideas.map((i) => i.experienceId)).toEqual(["b", "c", "a"]);
    // The ideas board first: it is where a removal starts.
    expect(ideas[0]!.boardIds).toEqual(["places", "wine"]);
    expect(ideas[0]!.addedAt).toBe("2026-10-05");
  });

  it("leaves boards someone only shared with them out of their ideas", () => {
    const ideas = ideasFrom(
      [
        { board: board("mine"), items: [item("a", "2026-10-01")] },
        {
          board: board("theirs", "viewer"),
          items: [item("z", "2026-10-09")],
        },
        {
          board: board("helping", "editor"),
          items: [item("y", "2026-10-09")],
        },
      ],
      "mine",
    );
    expect(ideas.map((i) => i.experienceId)).toEqual(["a"]);
  });

  it("saves to the board they were saving to, else their first own board", () => {
    const boards = [board("shared", "editor"), board("one"), board("two")];
    expect(ideasBoardOf(boards, "two")?.id).toBe("two");
    expect(ideasBoardOf(boards, "shared")?.id).toBe("one");
    expect(ideasBoardOf(boards, null)?.id).toBe("one");
    expect(ideasBoardOf([board("shared", "viewer")], null)).toBeNull();
  });
});

describe("the Pocket's order is only an order", () => {
  const ideas = [
    { experienceId: "new" },
    { experienceId: "mid" },
    { experienceId: "old" },
  ];

  it("follows the order the person set, and puts new saves at the end", () => {
    expect(
      inPocketOrder(ideas, ["mid", "old"]).map((i) => i.experienceId),
    ).toEqual(["mid", "old", "new"]);
  });

  it("with no order, reads oldest first — the order they were found", () => {
    expect(inPocketOrder(ideas, []).map((i) => i.experienceId)).toEqual([
      "old",
      "mid",
      "new",
    ]);
  });

  it("forgets nothing that is saved and shows nothing that isn't", () => {
    expect(
      inPocketOrder(ideas, ["gone", "old"]).map((i) => i.experienceId),
    ).toEqual(["old", "mid", "new"]);
  });

  it("moves one place, and not past either end", () => {
    expect(moved(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moved(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moved(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("where the Pocket leads", () => {
  it("makes a day from at most five, in the Pocket's order", () => {
    expect(dayFrom(["a", "b"])).toBe("/go?with=a,b");
    expect(dayFrom(["1", "2", "3", "4", "5", "6"])).toBe("/go?with=1,2,3,4,5");
    expect(dayFrom([])).toBe("/go");
  });

  it("makes a weekend as a new adventure sketched around them", () => {
    expect(weekendFrom(["a", "b"])).toBe("/adventures/new?with=a,b");
  });
});

describe("the voice says the fact first", () => {
  it("counts plainly", () => {
    expect(ideasCount(1)).toBe("1 idea saved");
    expect(ideasCount(3)).toBe("3 ideas saved");
  });

  it("varies the save line without randomness", () => {
    expect(savedLine(0)).toBe("Good find. Into the Pocket.");
    expect(savedLine(3)).toBe(savedLine(0));
  });

  it("grows with the Pocket", () => {
    expect(pocketLine(0)).toMatch(/Nothing in here yet/);
    expect(pocketLine(6)).toMatch(/whole weekend/);
  });
});
