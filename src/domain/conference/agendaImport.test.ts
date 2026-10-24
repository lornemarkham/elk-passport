import { describe, expect, it } from "vitest";
import { planImport, readAgendaFile } from "./agendaImport";
import { BEFORE, SUMMIT_FILE } from "./testSummit";

const file = () => {
  const r = readAgendaFile(JSON.stringify(SUMMIT_FILE));
  if (!r.ok) throw new Error(r.problem);
  return r.file;
};

describe("reading an agenda file", () => {
  it("refuses what isn't one, saying why", () => {
    expect(readAgendaFile("{").ok).toBe(false);
    const wrong = readAgendaFile(JSON.stringify({ agenda: [] }));
    expect(wrong.ok || wrong.problem).toMatch(/format/);
    const dupe = readAgendaFile(
      JSON.stringify({
        ...SUMMIT_FILE,
        agenda: [SUMMIT_FILE.agenda[0], SUMMIT_FILE.agenda[0]],
      }),
    );
    expect(dupe.ok || dupe.problem).toMatch(/share the id "mon-mixer"/);
    const noId = readAgendaFile(
      JSON.stringify({
        ...SUMMIT_FILE,
        agenda: [{ ...SUMMIT_FILE.agenda[0], id: "has space" }],
      }),
    );
    expect(noId.ok).toBe(false);
  });
});

describe("importing it", () => {
  it("adds every line, sets the dates and venue it carries, and keeps the organiser's own line", () => {
    const plan = planImport(BEFORE, file());
    if (!plan.ok) throw new Error(JSON.stringify(plan.issues));
    expect(plan.added).toHaveLength(SUMMIT_FILE.agenda.length);
    expect(plan.updated).toHaveLength(0);
    expect(plan.notInFile.map((x) => x.id)).toEqual(["own-line"]);
    expect(plan.details.agenda).toHaveLength(SUMMIT_FILE.agenda.length + 1);
    expect(plan.details.startsOn).toBe("2026-10-26");
    expect(plan.details.endsOn).toBe("2026-10-29");
    expect(plan.details.venue).toEqual({
      name: "Harbour Hotel",
      address: "1 Quay Street",
    });
    expect(plan.conference.map((c) => c.field).sort()).toEqual([
      "endsOn",
      "startsOn",
      "venue",
    ]);
    expect(plan.details.dayTitles).toEqual([
      { day: "2026-10-26", title: "Welcome to town!" },
    ]);
    // Untouched: name, modules.
    expect(plan.details.name).toBe("Summit");
    expect(plan.details.modules).toEqual(BEFORE.modules);
  });

  it("is idempotent: the same file again changes nothing, and says so", () => {
    const first = planImport(BEFORE, file());
    if (!first.ok) throw new Error("first");
    const again = planImport(first.details, file());
    if (!again.ok) throw new Error("again");
    expect(again.added).toHaveLength(0);
    expect(again.updated).toHaveLength(0);
    expect(again.unchanged).toBe(SUMMIT_FILE.agenda.length);
    expect(again.nothingToDo).toBe(true);
    expect(again.details.agenda).toEqual(first.details.agenda);
  });

  it("a corrected room updates that one line, by id, without a duplicate", () => {
    const first = planImport(BEFORE, file());
    if (!first.ok) throw new Error("first");
    const moved = {
      ...file(),
      agenda: file().agenda.map((l) =>
        l.id === "tue-lunch" ? { ...l, where: "Terrace" } : l,
      ),
    };
    const plan = planImport(first.details, moved);
    if (!plan.ok) throw new Error("moved");
    expect(plan.updated.map((u) => u.id)).toEqual(["tue-lunch"]);
    expect(plan.details.agenda!.filter((l) => l.id === "tue-lunch")).toEqual([
      expect.objectContaining({ where: "Terrace" }),
    ]);
    expect(plan.details.agenda).toHaveLength(first.details.agenda!.length);
  });

  it("switches the Agenda tab on when it was off, and says so", () => {
    const off = {
      ...BEFORE,
      modules: BEFORE.modules.filter((m) => m !== "schedule"),
    };
    const plan = planImport(off, file());
    if (!plan.ok) throw new Error("plan");
    expect(plan.turnsOnAgenda).toBe(true);
    expect(plan.details.modules).toContain("schedule");
    const on = planImport(BEFORE, file());
    expect(on.ok && on.turnsOnAgenda).toBe(false);
  });

  it("replaces the whole agenda only when asked", () => {
    const plan = planImport(BEFORE, file(), { replace: true });
    if (!plan.ok) throw new Error("replace");
    expect(plan.removed).toBe(true);
    expect(plan.details.agenda!.some((l) => l.id === "own-line")).toBe(false);
  });

  it("keeps start-only lines start-only, and keeps kinds, topics and asides", () => {
    const plan = planImport(BEFORE, file());
    if (!plan.ok) throw new Error("plan");
    const byId = new Map(plan.details.agenda!.map((l) => [l.id, l]));
    expect(byId.get("tue-general")!.end).toBeUndefined();
    expect(byId.get("tue-general")!.kind).toBeUndefined(); // a session
    expect(byId.get("tue-general")!.topics).toHaveLength(3);
    expect(byId.get("tue-breakfast")!.end).toBe("08:30");
    expect(byId.get("wed-gala")!.kind).toBe("celebration");
    expect(byId.get("thu-club")!.aside).toBe("History is being made.");
  });

  it("goes through the details schema: a line far from the conference's days is refused", () => {
    const far = {
      ...file(),
      agenda: [{ ...file().agenda[0]!, day: "2027-01-01" }],
    };
    const plan = planImport(BEFORE, far);
    expect(plan.ok).toBe(false);
  });
});
