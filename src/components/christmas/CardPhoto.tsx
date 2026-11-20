"use client";

import { useCallback, useState } from "react";
import type { Experience } from "@/domain/experience/types";
import { christmasPictures } from "@/domain/christmas/pictures";
import { cn } from "@/lib/utils";

/**
 * **A real picture of the thing, or nothing at all.** Unlike the shared
 * `Picture` there is no title tile to fall back to — a card with no honest
 * picture is a text card, so this renders `null` and takes no room. A picture
 * that fails to load gives way to the next, then to nothing, so a broken-image
 * icon is never drawn.
 *
 * `fill` makes it an absolutely-filled backdrop (the hero, a theme tile)
 * rather than a block with its own proportions.
 */
export function CardPhoto({
  experience,
  className,
  priority = false,
  showLabel = true,
  fill = false,
}: {
  readonly experience: Experience | undefined;
  readonly className?: string;
  readonly priority?: boolean;
  readonly showLabel?: boolean;
  readonly fill?: boolean;
}) {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const picture = experience
    ? christmasPictures(experience).find((p) => !broken.has(p.src))
    : undefined;
  const src = picture?.src;
  // A server-rendered picture can fail before React attaches `onError`; look
  // again once mounted so that failure still gives way to the next one.
  const check = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && src && img.complete && img.naturalWidth === 0)
        setBroken((prev) => new Set(prev).add(src));
    },
    [src],
  );
  if (!picture) return null;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#0f3b2b]",
        fill ? "absolute inset-0 h-full w-full" : "aspect-[16/9] w-full",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline */}
      <img
        ref={check}
        src={picture.src}
        alt={picture.label ? picture.alt || picture.label : picture.alt}
        title={picture.label}
        loading={priority ? "eager" : "lazy"}
        onError={() => setBroken((prev) => new Set(prev).add(picture.src))}
        className="h-full w-full object-cover"
      />
      {picture.label && showLabel && (
        <p
          data-testid="picture-label"
          className="absolute bottom-2 left-2 line-clamp-1 max-w-[calc(100%-1rem)] rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white uppercase"
        >
          {picture.label}
        </p>
      )}
    </div>
  );
}
