import { describe, expect, it } from "vitest";
import type { Place, PlaceRepresentativeMedia } from "@/lib/data/types";
import {
  GALLERY_MIN,
  featuredImage,
  featuredImageShown,
  galleryImages,
  heroImage,
} from "./placeMedia";

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

describe("galleryImages (M1)", () => {
  const withEvidence = (
    url: string,
    evidence: PlaceRepresentativeMedia["gallery"][number]["evidence"],
  ) => ({ ...view(url), evidence });

  it("is Atlas's representative set minus the hero's file, in Atlas's order", () => {
    const media: PlaceRepresentativeMedia = {
      hero: view("https://cdn/hero.jpg"),
      gallery: [
        view("https://cdn/hero.jpg"),
        withEvidence("https://cdn/b.jpg", "source-subject"),
        withEvidence("https://cdn/a.jpg", "own-page"),
        withEvidence("https://cdn/c.jpg", "curator"),
      ],
    };
    expect(galleryImages(media).map((m) => m.url)).toEqual([
      "https://cdn/b.jpg",
      "https://cdn/a.jpg",
      "https://cdn/c.jpg",
    ]);
    // Deterministic: the same read yields the same gallery.
    expect(galleryImages(media)).toEqual(galleryImages(media));
  });

  it("renders no gallery for fewer than two images beyond the hero — a lone hero, or a hero plus one", () => {
    expect(galleryImages(undefined)).toEqual([]);
    expect(galleryImages({ gallery: [] })).toEqual([]);
    const lone: PlaceRepresentativeMedia = {
      hero: view("https://cdn/h.jpg"),
      gallery: [view("https://cdn/h.jpg")],
    };
    expect(galleryImages(lone)).toEqual([]);
    const heroPlusOne: PlaceRepresentativeMedia = {
      hero: view("https://cdn/h.jpg"),
      gallery: [view("https://cdn/h.jpg"), view("https://cdn/x.jpg")],
    };
    expect(galleryImages(heroPlusOne)).toEqual([]);
    expect(GALLERY_MIN).toBe(2);
  });

  it("never consults the Place's raw scalar or anything outside Atlas's representative read", () => {
    const stale = place("https://cdn/listicle-shop-interior.jpg");
    expect(galleryImages(undefined)).toEqual([]);
    expect(featuredImage(stale, { gallery: [] })).toBeUndefined();
    // With no hero, everything representative is the gallery.
    const noHero: PlaceRepresentativeMedia = {
      gallery: [view("https://cdn/a.jpg"), view("https://cdn/b.jpg")],
    };
    expect(galleryImages(noHero).map((m) => m.url)).toEqual([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
    ]);
  });
});

describe("galleryImages leaves out what the page already placed (M11.1)", () => {
  const media: PlaceRepresentativeMedia = {
    hero: view("https://cdn/salmon-1200.jpg"),
    gallery: [
      view("https://cdn/salmon-1200.jpg"),
      view("https://cdn/listing.jpg"),
      view("https://cdn/falls-1.jpg"),
      view("https://cdn/falls-2.jpg"),
      view("https://cdn/falls-3.jpg"),
    ],
  };

  it("excludes the featured image when 'Don't leave without…' rendered it", () => {
    const withActivities = place();
    withActivities.activities = ["Hiking"];
    expect(featuredImageShown(withActivities, media)).toBe(
      "https://cdn/listing.jpg",
    );
    expect(
      galleryImages(media, [featuredImageShown(withActivities, media)]).map(
        (m) => m.url,
      ),
    ).toEqual([
      "https://cdn/falls-1.jpg",
      "https://cdn/falls-2.jpg",
      "https://cdn/falls-3.jpg",
    ]);
  });

  it("keeps the featured image in the gallery when that block did not render — nothing is left off the page", () => {
    const noActivities = place();
    noActivities.activities = [];
    expect(featuredImageShown(noActivities, media)).toBeUndefined();
    expect(
      galleryImages(media, [featuredImageShown(noActivities, media)]).map(
        (m) => m.url,
      ),
    ).toEqual([
      "https://cdn/listing.jpg",
      "https://cdn/falls-1.jpg",
      "https://cdn/falls-2.jpg",
      "https://cdn/falls-3.jpg",
    ]);
  });

  it("applies the minimum after exclusions: hero plus featured plus one is no gallery", () => {
    const three: PlaceRepresentativeMedia = {
      hero: view("https://cdn/h.jpg"),
      gallery: [
        view("https://cdn/h.jpg"),
        view("https://cdn/f.jpg"),
        view("https://cdn/x.jpg"),
      ],
    };
    const withActivities = place();
    withActivities.activities = ["Hiking"];
    expect(
      galleryImages(three, [featuredImageShown(withActivities, three)]),
    ).toEqual([]);
    expect(galleryImages(three).map((m) => m.url)).toEqual([
      "https://cdn/f.jpg",
      "https://cdn/x.jpg",
    ]);
  });
});
