import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PlacePractical } from "./PlacePractical";
import type { Place, PlacePractical as Practical } from "@/lib/data/types";
import type { PlaceSectionProps } from "./types";

/**
 * Atlas composes; this renders. What is pinned here is that the component
 * shows exactly the groups Atlas sent and nothing it did not — no row for a
 * question Atlas holds no answer to, no "Free" from a missing fee, no label
 * repeated inside its sentence — and that what no group claimed is still on
 * the page under the publisher's own label.
 */

const place: Place = {
  kind: "Place",
  id: "hurlburt",
  name: "Hurlburt Park",
  aliases: [],
  placeType: "park",
  description: "",
};

const props = (practical?: Practical): PlaceSectionProps => ({
  place,
  relationships: [],
  sources: [],
  relatedPlaces: [],
  relatedPlaceDetails: [],
  practical,
});

const hurlburt: Practical = {
  version: 1,
  groups: [
    {
      key: "facilities",
      title: "Facilities",
      chips: ["Parking for twenty cars", "Toilet", "Four picnic tables"],
      items: [{ text: "Dock, swimming platform, picnic tables" }],
    },
    {
      key: "safety",
      title: "Safety & notices",
      items: [
        { label: "Dock repairs", text: "The dock received minor repairs." },
        {
          text: "There are no swim buoys and no lifeguards, so caution is advised.",
          asOf: "2026-09-19T16:35:56.719Z",
        },
      ],
    },
  ],
  other: [
    {
      items: [
        {
          label: "Starting point for guided tours",
          text: "Okanagan Affordable Rentals offers guided kayak tours starting from here.",
        },
      ],
    },
    { category: "Day 1", items: [{ label: "Trails", text: "Big Ed loop" }] },
  ],
  omitted: [{ label: "Facilities", reason: "restates-facilities" }],
};

describe("PlacePractical", () => {
  it("renders one row per group Atlas sent, in Atlas's order, with the facilities list as chips", () => {
    render(<PlacePractical {...props(hurlburt)} />);
    const rows = screen.getAllByRole("group");
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Facilities",
      "Safety & notices",
    ]);
    const facilities = within(screen.getByTestId("practical-facilities"));
    expect(facilities.getByText("Parking for twenty cars")).toBeTruthy();
    expect(facilities.getByText("Toilet")).toBeTruthy();
    expect(
      facilities.getByText("Dock, swimming platform, picnic tables"),
    ).toBeTruthy();
  });

  it("renders no row for a question Atlas did not answer — no Hours, no Fees, no Dogs, no Accessibility", () => {
    render(<PlacePractical {...props(hurlburt)} />);
    for (const absent of [
      "Hours & season",
      "Fees & reservations",
      "Dogs & pets",
      "Accessibility",
      "Getting there & parking",
    ]) {
      expect(screen.queryByText(absent)).toBeNull();
    }
    expect(screen.queryByText(/free/i)).toBeNull();
    expect(screen.queryByText(/^open$/i)).toBeNull();
    expect(screen.queryByText(/unknown/i)).toBeNull();
  });

  it("leads a sentence with its label only when Atlas kept one, and dates a current notice", () => {
    render(<PlacePractical {...props(hurlburt)} />);
    const safety = within(screen.getByTestId("practical-safety"));
    expect(safety.getByText("Dock repairs —")).toBeTruthy();
    expect(safety.getByText("The dock received minor repairs.")).toBeTruthy();
    const advisory = safety.getByText(
      "There are no swim buoys and no lifeguards, so caution is advised.",
    );
    expect(advisory.parentElement?.textContent).toContain("as of Sep 19, 2026");
    expect(advisory.parentElement?.textContent).not.toMatch(/—/);
  });

  it("keeps what no group claimed under More details, with the publisher's label and grouping", () => {
    render(<PlacePractical {...props(hurlburt)} />);
    const other = within(screen.getByTestId("place-practical-other"));
    expect(other.getByText("More details")).toBeTruthy();
    expect(other.getByText("Starting point for guided tours")).toBeTruthy();
    expect(
      other.getByText(
        "Okanagan Affordable Rentals offers guided kayak tours starting from here.",
      ),
    ).toBeTruthy();
    expect(other.getByText("Day 1")).toBeTruthy();
    expect(other.getByText("Trails")).toBeTruthy();
    // The label is the term of the list, not repeated inside its sentence.
    expect(other.queryByText(/Starting point for guided tours —/)).toBeNull();
  });

  it("never renders what Atlas omitted", () => {
    render(<PlacePractical {...props(hurlburt)} />);
    expect(screen.queryByText(/restates-facilities/)).toBeNull();
  });

  it("renders nothing at all for a place with nothing practical, and nothing without the field", () => {
    const { container } = render(
      <PlacePractical
        {...props({ version: 1, groups: [], other: [], omitted: [] })}
      />,
    );
    expect(container.innerHTML).toBe("");
    expect(
      render(<PlacePractical {...props(undefined)} />).container.innerHTML,
    ).toBe("");
  });

  it("attributes an operator's statements under its name, after the Place's own", () => {
    render(
      <PlacePractical
        {...props({
          version: 1,
          groups: [
            {
              key: "hours",
              title: "Hours & season",
              items: [
                { text: "Park gate open 7 am to 11 pm" },
                {
                  text: "8:30 am–3:30 pm",
                  via: { id: "org", name: "Big White Ski Resort" },
                },
              ],
            },
          ],
          other: [],
          omitted: [],
        })}
      />,
    );
    const hours = within(screen.getByTestId("practical-hours"));
    expect(hours.getByText("Park gate open 7 am to 11 pm")).toBeTruthy();
    expect(hours.getByText("Big White Ski Resort")).toBeTruthy();
    expect(hours.getByText("8:30 am–3:30 pm")).toBeTruthy();
  });

  it("renders a bare URL as a link named by its host, so a booking address neither reads as prose nor breaks the layout", () => {
    render(
      <PlacePractical
        {...props({
          version: 1,
          groups: [
            {
              key: "fees",
              title: "Fees & reservations",
              items: [
                {
                  label: "Reservations",
                  text: "https://camping.bcparks.ca/create-booking/results?resourceLocationId=-2147483615",
                },
              ],
            },
          ],
          other: [],
          omitted: [],
        })}
      />,
    );
    const link = screen.getByRole("link", { name: "camping.bcparks.ca" });
    expect(link.getAttribute("href")).toBe(
      "https://camping.bcparks.ca/create-booking/results?resourceLocationId=-2147483615",
    );
  });
});
