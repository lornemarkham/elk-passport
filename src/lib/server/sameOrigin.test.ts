import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./sameOrigin";

const asked = (headers: Record<string, string>) =>
  new Request("https://passport.test/api/travel/legs", {
    method: "POST",
    headers,
  });

describe("isSameOrigin", () => {
  it("lets this site's pages through, and a caller that is not a page", () => {
    expect(isSameOrigin(asked({}))).toBe(true);
    expect(
      isSameOrigin(
        asked({
          origin: "https://passport.test",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
    // Behind a proxy that names the public host.
    expect(
      isSameOrigin(
        asked({
          origin: "https://elk-passport.vercel.app",
          "x-forwarded-host": "elk-passport.vercel.app",
        }),
      ),
    ).toBe(true);
    expect(isSameOrigin(asked({ "sec-fetch-site": "same-site" }))).toBe(true);
  });

  it("refuses another site's page", () => {
    expect(isSameOrigin(asked({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(asked({ origin: "https://elsewhere.example" }))).toBe(
      false,
    );
    expect(isSameOrigin(asked({ origin: "null" }))).toBe(false);
    expect(
      isSameOrigin(
        asked({
          origin: "https://passport.test",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toBe(false);
  });
});
