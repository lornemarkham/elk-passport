import { describe, expect, it } from "vitest";
import { PhotoInputSchema, photoPrompts } from "./memories";

const jpeg = "/9j/" + "A".repeat(200);

describe("PhotoInputSchema", () => {
  it("takes a JPEG and tidies the caption", () => {
    const r = PhotoInputSchema.parse({ data: jpeg, caption: "  big   win " });
    expect(r.caption).toBe("big win");
  });
  it("makes a caption optional", () => {
    expect(PhotoInputSchema.parse({ data: jpeg }).caption).toBe("");
  });
  it("refuses anything that is not a JPEG", () => {
    expect(
      PhotoInputSchema.safeParse({ data: "iVBORw0KGgo" + "A".repeat(200) })
        .success,
    ).toBe(false);
    expect(
      PhotoInputSchema.safeParse({ data: "data:image/jpeg;base64," + jpeg })
        .success,
    ).toBe(false);
  });
  it("refuses tiny, huge and over-long", () => {
    expect(PhotoInputSchema.safeParse({ data: "/9j/AAAA" }).success).toBe(
      false,
    );
    expect(
      PhotoInputSchema.safeParse({ data: "/9j/" + "A".repeat(800_001) })
        .success,
    ).toBe(false);
    expect(
      PhotoInputSchema.safeParse({ data: jpeg, caption: "x".repeat(141) })
        .success,
    ).toBe(false);
  });
  it("names the other team in the fan challenge", () => {
    expect(photoPrompts("Wild")[0]).toContain("Wild");
  });
});
