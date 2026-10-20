import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { withoutRepeatedIllustrations } from "./illustrations";

const item = (
  id: string,
  relationship: string | undefined,
  url = "https://example.test/pumpkins.jpg",
) =>
  ({
    id,
    title: id,
    ...(relationship
      ? {
          presentationImage: {
            url,
            relationship,
            attribution: "x",
            confidence: "low",
            depictsEntity: false,
          },
        }
      : {}),
  }) as unknown as Experience;

describe("withoutRepeatedIllustrations", () => {
  it("keeps an illustrative photo on the first card of a row only", () => {
    const row = withoutRepeatedIllustrations([
      item("a", "category"),
      item("b", "category"),
      item("c", "representative"),
    ]);
    expect(row[0]!.presentationImage).toBeDefined();
    expect(row[1]!.presentationImage).toBeUndefined();
    expect(row[2]!.presentationImage).toBeUndefined();
  });

  it("leaves different illustrative photos alone", () => {
    const row = withoutRepeatedIllustrations([
      item("a", "category", "https://example.test/1.jpg"),
      item("b", "category", "https://example.test/2.jpg"),
    ]);
    expect(row.every((e) => e.presentationImage)).toBe(true);
  });

  it("never strips authentic pictures, even when shared", () => {
    for (const kind of ["exact", "venue", "organization"]) {
      const row = withoutRepeatedIllustrations([
        item("a", kind),
        item("b", kind),
      ]);
      expect(row.every((e) => e.presentationImage)).toBe(true);
    }
  });

  it("does not mutate its input and passes cards without images through", () => {
    const input = [
      item("a", "category"),
      item("b", "category"),
      item("c", undefined),
    ];
    withoutRepeatedIllustrations(input);
    expect(input[1]!.presentationImage).toBeDefined();
    expect(withoutRepeatedIllustrations([input[2]!])[0]).toBe(input[2]);
  });
});
