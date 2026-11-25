import { describe, expect, it } from "vitest";
import { distinctWhere, tidyWhere } from "./tidy";

describe("tidyWhere", () => {
  it("keeps the organiser's address and drops the geocoder's notes", () => {
    expect(
      tidyWhere(
        "2901 35th Avenue, Vernon, BC → 2901 35 Ave, Vernon, BC (bc-address-geocoder: CIVIC_NUMBER, score 100, parcelPoint; from stated-location) · Vernon · Under 1 km away",
      ),
    ).toBe("2901 35th Avenue, Vernon · Vernon · Under 1 km away");
  });
  it("leaves a plain venue alone", () => {
    expect(
      tidyWhere("Okanagan Regional Library - Kelowna Branch · Kelowna"),
    ).toBe("Okanagan Regional Library - Kelowna Branch · Kelowna");
  });
  it("drops a bare provenance bracket with no arrow", () => {
    expect(tidyWhere("12 Main St (bc-address-geocoder: score 90)")).toBe(
      "12 Main St",
    );
  });
});

describe("distinctWhere", () => {
  it("says a town once", () => {
    expect(distinctWhere("Okanagan Park · Vernon · 2901 35 Ave, Vernon")).toBe(
      "Okanagan Park · 2901 35 Ave, Vernon",
    );
    expect(distinctWhere("SilverStar Village · Vernon")).toBe(
      "SilverStar Village · Vernon",
    );
    expect(distinctWhere("Vernon · Vernon")).toBe("Vernon");
    expect(distinctWhere("")).toBe("");
  });
});
