import { describe, expect, it } from "vitest";
import type { Place, PlaceRepresentativeMedia } from "@/lib/data/types";
import { featuredImage, heroImage } from "./placeMedia";

/**
 * Passport composes Place imagery from Atlas's `media` read and judges
 * nothing itself (Atlas ADR 069). Kal Beach's page showed one shop interior
 * twice: as the hero, and again as the featured image, both from one scalar.
 */

const place = (imageUrl?: string): Place => ({
  kind: "Place",
  id: "kal",
  name: "Kal Beach",
  aliases: [],
  placeType: "beach",
  description: "",
  ...(imageUrl ? { imageUrl } : {}),
});
const view = (url: string): PlaceRepresentativeMedia["gallery"][number] => ({
  url,
  sourceRecordId: "s",
  evidence: "caption-names-subject",
});

describe("placeMedia", () => {
  it("renders the hero from Atlas's representative media, not from the scalar, and nothing when Atlas can vouch for nothing", () => {
    const stale = place("https://cdn/shop-interior.jpg");
    expect(heroImage(stale, { gallery: [] })).toBeUndefined();
    expect(
      heroImage(stale, {
        hero: view("https://cdn/kal.jpg"),
        gallery: [view("https://cdn/kal.jpg")],
      }),
    ).toBe("https://cdn/kal.jpg");
  });

  it("never features the hero's file a second time: the featured image is the second representative image, or none", () => {
    const one: PlaceRepresentativeMedia = {
      hero: view("https://cdn/kal.jpg"),
      gallery: [view("https://cdn/kal.jpg")],
    };
    expect(featuredImage(place("https://cdn/kal.jpg"), one)).toBeUndefined();
    const two: PlaceRepresentativeMedia = {
      hero: view("https://cdn/kal.jpg"),
      gallery: [view("https://cdn/kal.jpg"), view("https://cdn/kal-2.jpg")],
    };
    expect(featuredImage(place(), two)).toBe("https://cdn/kal-2.jpg");
  });

  it("falls back to the scalar only for an Atlas that sends no media read at all", () => {
    expect(heroImage(place("https://cdn/x.jpg"), undefined)).toBe(
      "https://cdn/x.jpg",
    );
    expect(heroImage(place(), undefined)).toBeUndefined();
  });
});
