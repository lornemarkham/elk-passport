import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { answerAsk } from "@/lib/ai/ask/answer";
import { readAsk } from "@/lib/ai/ask/read";
import { forDiscoveryWire } from "./wire";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/discovery",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/data/boards-repo", () => ({
  listBoards: async () => [],
  getBoard: async () => null,
  listBoardItems: async () => [],
  createBoard: async (name: string) => ({ id: "b", name }),
  saveExperienceToBoard: async () => ({}),
  removeExperienceFromBoard: async () => {},
  renameBoard: async () => {},
  deleteBoard: async () => {},
  isSignedOut: () => false,
}));
vi.mock("@/lib/october/october-repo", () => ({
  listOctoberThings: async () => [],
  wantToDo: async () => {},
}));
vi.mock("sonner", () => {
  const toast = () => {};
  toast.error = vi.fn();
  toast.success = vi.fn();
  return { toast };
});
const { DiscoveryListView } =
  await import("@/components/discovery-list/DiscoveryListView");

/**
 * **The wire format drops only what Discovery never reads** — and says how it
 * knows. The pool is the committed Atlas fixture (2,979 real candidates, with
 * `environment.season`, `knowledge.practical` and the rest), mapped exactly as
 * the page maps it.
 */
const body = JSON.parse(
  gunzipSync(
    readFileSync(
      join(
        process.cwd(),
        "docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz",
      ),
    ),
  ).toString("utf8"),
) as { candidates: DiscoveryCandidate[] } | DiscoveryCandidate[];
const candidates = Array.isArray(body) ? body : body.candidates;

const full = candidates.map(candidateToExperience);
const lean = full.map(forDiscoveryWire);

describe("the Discovery wire format", () => {
  it("is materially smaller than the pool it was made from", () => {
    const before = JSON.stringify(full).length;
    const after = JSON.stringify(lean).length;
    expect(after).toBeLessThan(before * 0.8);
  });

  it("keeps every candidate and every id, in order", () => {
    expect(lean.map((e) => e.id)).toEqual(full.map((e) => e.id));
    expect(lean.map((e) => e.title)).toEqual(full.map((e) => e.title));
  });

  it("drops keys rather than serialising them as undefined", () => {
    // An `undefined` prop crosses the server boundary as the literal
    // "$undefined", which is what the old `description: undefined` cost.
    for (const e of lean)
      for (const value of Object.values(e)) expect(value).not.toBeUndefined();
    expect(JSON.stringify(lean)).not.toMatch(/"slug"|"practical"|"season"/);
  });

  it("keeps the statements and the shape every reader needs", () => {
    const withAge = full.find((e) => e.suitability?.statements?.length);
    const same = lean.find((e) => e.id === withAge!.id)!;
    expect(same.suitability?.statements?.[0]).toMatchObject({
      about: withAge!.suitability!.statements![0]!.about,
      says: withAge!.suitability!.statements![0]!.says,
      text: withAge!.suitability!.statements![0]!.text,
    });
    const withExposure = full.find((e) => e.environment?.exposure)!;
    expect(
      lean.find((e) => e.id === withExposure.id)!.environment,
    ).toMatchObject({
      rain: withExposure.environment!.rain,
      exposure: {
        value: withExposure.environment!.exposure!.value,
        basis: withExposure.environment!.exposure!.basis,
      },
    });
  });

  it("renders the same Discovery page from the lean pool as from the full one", () => {
    const props = {
      displayName: null,
      now: "2026-10-15T18:00:00.000Z",
      today: "Thursday, October 15",
    };
    const fullPage = render(
      <DiscoveryListView experiences={full} {...props} />,
    );
    const fullHtml = fullPage.container.innerHTML;
    fullPage.unmount();
    const leanPage = render(
      <DiscoveryListView experiences={lean} {...props} />,
    );
    expect(leanPage.container.innerHTML).toBe(fullHtml);
    expect(fullHtml.length).toBeGreaterThan(10_000);
  });

  it.each([
    "what can we do with three hours?",
    "something unusual nearby",
    "where can I take my kid this afternoon?",
    "what is on tonight",
    "indoors on a wet day with friends",
  ])("answers %j identically from either pool", (said) => {
    const today = "2026-10-15";
    const reading = readAsk(said, { today });
    const context = { today, home: "Okanagan" };
    const a = answerAsk(full, reading, context);
    const b = answerAsk(lean, reading, context);
    expect(b.heading).toBe(a.heading);
    expect(b.note).toBe(a.note);
    expect(b.picks.map((p) => [p.experience.id, p.reasons, p.caveat])).toEqual(
      a.picks.map((p) => [p.experience.id, p.reasons, p.caveat]),
    );
  });
});

/**
 * **Nothing the wire drops may be read by Discovery.** The equivalence above
 * only proves the paths a render exercises; this proves the rest by name. If a
 * Discovery surface starts to read one of these, this fails and the field
 * stops being dropped in `wire.ts` — which is the whole contract.
 */
describe("what the wire drops is not read by the Discovery client", () => {
  const DIRECTORIES = [
    "src/components/discovery-list",
    "src/components/ghad",
    "src/domain/discovery",
    "src/lib/ai/ask",
    "src/lib/location",
    "src/lib/routing",
  ];
  const READS =
    /\.(?:slug|practical|conditions|season|seenAt|voice|sourceRecordId|depictsEntity|evidence)\b/;
  const files = (directory: string): string[] =>
    readdirSync(join(process.cwd(), directory)).flatMap((name) => {
      const path = join(directory, name);
      if (statSync(join(process.cwd(), path)).isDirectory()) return files(path);
      return /\.(?:ts|tsx)$/.test(name) && !/\.test\.|eval\./.test(name)
        ? [path]
        : [];
    });

  it.each(DIRECTORIES)("%s", (directory) => {
    for (const path of files(directory)) {
      const code = readFileSync(join(process.cwd(), path), "utf8")
        .split("\n")
        // Comments say what a field is; only code reads one.
        .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
        .join("\n");
      expect(`${path}: ${code.match(READS)?.[0] ?? "ok"}`).toBe(`${path}: ok`);
    }
  });
});
