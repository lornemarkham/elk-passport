"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlaceMediaView, PlaceSource } from "@/lib/data/types";
import { SectionShell } from "./SectionShell";
import { sourceLabel } from "./PlaceSources";
import { featuredImageShown, galleryImages } from "./placeMedia";
import type { PlaceSectionProps } from "./types";

/**
 * **What does this place actually look like?** (M1)
 *
 * A grid of the images Atlas can vouch for as this Place, beyond the hero,
 * each opening a lightbox the traveller can move through without leaving the
 * page. Which images qualify is Atlas's decision (ADR 069) carried in the
 * detail read's `media`; which of those the gallery shows is `galleryImages`
 * — the hero's file left out, nothing shown for fewer than two. Order is
 * Atlas's, untouched.
 *
 * Every image carries the source's own words for it (`caption`, verbatim) and
 * the publisher it came from, resolved from the page's own `sources` list —
 * the same provenance "Trusted Information" shows, per photograph.
 *
 * Keyboard: the tiles are buttons; in the lightbox ← and → move, Escape
 * closes (the dialog's own behaviour), and focus stays inside it.
 */
export function PlaceGallery({ place, media, sources }: PlaceSectionProps) {
  // What the page has already placed — the hero always, the featured image
  // when "Don't leave without…" rendered — stays out of the gallery (M11.1).
  const images = useMemo(
    () => galleryImages(media, [featuredImageShown(place, media)]),
    [place, media],
  );
  const [open, setOpen] = useState<number | undefined>(undefined);

  const publisherOf = useMemo(() => {
    const byId = new Map<string, PlaceSource>(sources.map((s) => [s.id, s]));
    return (image: PlaceMediaView): PlaceSource | undefined =>
      byId.get(image.sourceRecordId);
  }, [sources]);

  const step = useCallback(
    (delta: number) => {
      setOpen((current) =>
        current === undefined
          ? current
          : (current + delta + images.length) % images.length,
      );
    },
    [images.length],
  );

  // On the dialog itself, not on `window`: the dialog keeps focus inside it,
  // so a key pressed while it is open reaches here, and the same key pressed
  // on the page with the lightbox closed reaches nothing of ours.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };

  if (images.length === 0) return null;

  const current = open === undefined ? undefined : images[open];
  const currentSource = current ? publisherOf(current) : undefined;

  return (
    <SectionShell title="Photos">
      <ul
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        data-testid="place-gallery"
      >
        {images.map((image, index) => (
          <li key={image.url}>
            <button
              type="button"
              onClick={() => setOpen(index)}
              className="bg-muted focus-visible:ring-ring block aspect-[4/3] w-full overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:outline-none"
              aria-label={
                image.caption
                  ? `View photo: ${image.caption}`
                  : `View photo ${index + 1} of ${images.length}`
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- external source image, no next/image domain config for arbitrary sources */}
              <img
                src={image.thumbnailUrl ?? image.url}
                alt={image.caption ?? ""}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={open !== undefined}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpen(undefined);
        }}
      >
        <DialogContent
          className="max-w-[calc(100%-1rem)] gap-3 bg-black/95 p-3 text-white ring-white/10 sm:max-w-5xl"
          aria-label={`${place.name} photos`}
          onKeyDown={onKeyDown}
        >
          {current && (
            <>
              <DialogTitle className="sr-only">
                {current.caption ?? `${place.name} photo ${open! + 1}`}
              </DialogTitle>
              <div className="relative flex max-h-[75vh] items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- external source image */}
                <img
                  src={current.url}
                  alt={current.caption ?? ""}
                  className="max-h-[75vh] w-auto max-w-full rounded-md object-contain"
                  data-testid="place-gallery-lightbox-image"
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      aria-label="Previous photo"
                      className="absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      aria-label="Next photo"
                      className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              <DialogDescription className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-white/80">
                <span className="min-w-0 flex-1 text-sm text-white/90">
                  {current.caption ?? ""}
                </span>
                <span className="flex items-center gap-3 text-xs text-white/60">
                  {currentSource && (
                    <a
                      href={currentSource.source}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      Photo: {sourceLabel(currentSource.sourceType)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <span aria-live="polite">
                    {open! + 1} / {images.length}
                  </span>
                </span>
              </DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}
