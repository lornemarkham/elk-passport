import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExperienceListRow } from "./ExperienceListRow";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * The link a traveller actually clicks.
 *
 * `destination.test.ts` pins which URL an Experience *should* get; these pin
 * that the rendered row really carries it. The two were verified separately
 * once — the domain layer produced 29 destinations while the page rendered 26
 * links — and the gap turned out to be elsewhere, but nothing was asserting
 * this half at all.
 */
const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id-1",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

const row = (over: Partial<DiscoveryCandidate>) =>
  render(
    <ul>
      <ExperienceListRow
        experience={candidateToExperience(candidate(over))}
        saved={false}
        saving={false}
        onSave={vi.fn()}
      />
    </ul>,
  );

const bigWhite = {
  id: "238661eb-e191-4d60-ae3d-748b4543964c",
  kind: "Place" as const,
  name: "Big White Ski Resort",
  subtype: "ski resort",
  heroUrl: "https://example.com/gem-lake-express.jpg",
  coordinates: [-118.9459084, 49.7379086] as [number, number],
};

describe("the row's navigation", () => {
  it("gives a detail-ready Place a stretched link to its own page", () => {
    row(bigWhite);
    const link = screen.getByRole("link", { name: "Big White Ski Resort" });
    expect(link).toHaveAttribute(
      "href",
      "/places/238661eb-e191-4d60-ae3d-748b4543964c",
    );
    // The overlay covers the row rather than wrapping it, so the Save button
    // is not nested inside an anchor.
    expect(link.className).toContain("absolute");
    expect(link.className).toContain("inset-0");
    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-navigates",
      "true",
    );
  });

  it("keeps Save clickable above the link overlay", () => {
    const onSave = vi.fn();
    render(
      <ul>
        <ExperienceListRow
          experience={candidateToExperience(candidate(bigWhite))}
          saved={false}
          saving={false}
          onSave={onSave}
        />
      </ul>,
    );
    // Regression from the row's own history: elevating the image and text
    // above the overlay made everything but the padding a dead target. The
    // Save button is the one element that must sit above it.
    const save = screen.getByRole("button", { name: /save/i });
    expect(save.parentElement?.className).toContain("z-10");
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("opens a Place that is not detail-ready on the neutral page", () => {
    // Kekuli Bay: real, mapped, described — and Atlas holds no photograph, so
    // the Place template has nothing to open with. The traveller page does,
    // and is built to state what it does not know.
    row({
      id: "1d8a002c-a7ac-41d5-9a3e-73ab0849e702",
      name: "Kekuli Bay Provincial Park",
      subtype: "provincial park",
      coordinates: [-119.34027778, 50.18333333],
    });
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/passport/1d8a002c-a7ac-41d5-9a3e-73ab0849e702",
    );
    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-navigates",
      "true",
    );
  });

  it("never sends an Organization id to /places/{id}", () => {
    row({
      id: "9b3cc3d6-9af8-43ce-8e8d-3b1010220333",
      kind: "Organization",
      name: "Big White Ski Resort",
      subtype: "resort",
      heroUrl: "https://example.com/panorama.jpg",
    });
    expect(
      screen.queryByRole("link")?.getAttribute("href") ?? "",
    ).not.toContain("/places/");
  });

  it("never sends an Activity id to /places/{id}", () => {
    row({
      id: "activity-night-skiing",
      kind: "Activity",
      name: "night skiing",
      subtype: "skiing",
      heroUrl: "https://example.com/night.jpg",
    });
    expect(
      screen.queryByRole("link")?.getAttribute("href") ?? "",
    ).not.toContain("/places/");
  });
});
