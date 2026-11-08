import { describe, expect, it } from "vitest";
import { FEATURED_HOSTS, disclosure } from "./hosts";

describe("featured hosts", () => {
  it("features ELK Lark as an adventure host, like any other entry", () => {
    const lark = FEATURED_HOSTS.find((h) => h.id === "elk-lark");
    expect(lark?.host).toBe("Uncle Lorne");
    expect(lark?.doing.join(" ")).toMatch(/adventure/i);
    // Adventures and activities, not a bed-and-breakfast.
    expect(JSON.stringify(lark)).not.toMatch(
      /b&b|bed and breakfast|accommodation|stay|rooms?\b|nightly/i,
    );
  });

  it("never states a date, a price or availability", () => {
    for (const host of FEATURED_HOSTS) {
      const said = [host.line, ...host.doing, host.cta ?? ""].join(" ");
      expect(said).not.toMatch(
        /\$\d|\d{1,2}(am|pm)|\b20\d\d\b|available|book now|spots? left|tickets?/i,
      );
    }
  });

  it("always says why it is there", () => {
    for (const host of FEATURED_HOSTS) expect(disclosure(host)).toBeTruthy();
    expect(
      disclosure({ ...FEATURED_HOSTS[0]!, relationship: "sponsored" }),
    ).toBe("Sponsored");
  });
});
