"use client";

import { useCallback, useState, type ReactNode } from "react";

/**
 * **A hero that asks the image what kind of image it is.**
 *
 * ## Measured, not guessed
 *
 * Of the 25 October subjects Atlas holds a lead image for, 21 are landscape
 * photographs between 1.38 and 1.78 — a crowd at a concert, coffee on a
 * table, a comedy club in the dark. Behind a title with a scrim over it, those
 * look like a product.
 *
 * The other four are square or taller, and every one of them is a poster: the
 * Sagebrush Ranch flyer (1080×1080) carries its own headline, its own price
 * list, its opening hours and a QR code. Used as a background it produced a
 * hero with two headlines fighting each other and eight lines of half-visible
 * type running through the description. It was the worst page in October.
 *
 * ```
 * ratio ≥ 1.2   a photograph  →  full bleed behind the title
 * ratio < 1.2   a poster      →  its own panel beside it, whole and uncropped
 * ```
 *
 * The shape comes from the image itself, on load, so nothing here is a list of
 * ids and a subject Atlas learns a photograph for tomorrow gets the other
 * treatment with no edit. A poster is never cropped — cropping a flyer throws
 * away the half that holds the prices — and type is never laid over one.
 *
 * The cost is one reflow on those four pages when the image lands. The
 * alternative was holding the hero blank until every image had loaded, which
 * is a worse first frame for the twenty-one that were already right.
 */
export function OctoberHero({
  imageUrl,
  children,
}: {
  readonly imageUrl: string;
  /** The eyebrow, title, description, dates and actions — all server-rendered. */
  readonly children: ReactNode;
}) {
  const [poster, setPoster] = useState(false);

  /**
   * A ref rather than `onLoad` alone: an image already in the browser's cache
   * is `complete` before React attaches a load handler, so the second visit to
   * a page — and every navigation back to it — would have measured nothing and
   * shown the poster treatment nobody wanted.
   */
  const measure = useCallback((image: HTMLImageElement | null) => {
    if (!image) return;
    const read = () => {
      const { naturalWidth: w, naturalHeight: h } = image;
      if (w > 0 && h > 0) setPoster(w / h < 1.2);
    };
    if (image.complete) read();
    else image.addEventListener("load", read, { once: true });
  }, []);

  if (poster) {
    return (
      <header className="mx-auto mt-6 grid w-full max-w-5xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0 lg:order-1">{children}</div>
        <div className="october-edge border-border/60 bg-card min-w-0 overflow-hidden rounded-2xl border lg:order-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            ref={measure}
            className="h-auto w-full object-contain"
          />
        </div>
      </header>
    );
  }

  return (
    <header className="relative isolate mt-4 flex min-h-[52vh] items-end overflow-hidden sm:min-h-[62vh]">
      <div className="absolute inset-0 -z-10">
        {/* The one image Atlas chose, never "its media". A subject whose media
            lane picked nothing gets no picture here, which is the honest hero
            rather than a stock pumpkin. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          ref={measure}
          className="h-full w-full object-cover"
        />
        <div className="from-background via-background/70 absolute inset-0 bg-gradient-to-t to-transparent" />
        <div className="from-background/85 absolute inset-0 bg-gradient-to-r to-transparent" />
      </div>
      <div className="mx-auto w-full max-w-5xl px-5 pt-28 pb-10 sm:px-8 sm:pb-14">
        {children}
      </div>
    </header>
  );
}
