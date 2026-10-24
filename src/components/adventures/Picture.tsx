"use client";

import { useState } from "react";
import type { Experience } from "@/domain/experience/types";
import { cardPictures } from "@/lib/media/cardPicture";
import { cn } from "@/lib/utils";

/**
 * **A subject's picture, with Discovery's rules** (`cardPictures`): its own,
 * else Atlas's labelled one, else its venue's — each label said on the
 * picture. A picture that fails to load gives way to the next; with none
 * left, a warm tile with the subject's name, never a grey box.
 */
export function Picture({
  experience,
  className,
  priority = false,
  showLabel = true,
  fallbackTitle,
  tone = "var(--gh-forest)",
}: {
  readonly experience: Experience | undefined;
  readonly className?: string;
  readonly priority?: boolean;
  /** Small thumbnails may hide the label; the picture's alt still says it. */
  readonly showLabel?: boolean;
  /** Words for the tile when there is no picture. */
  readonly fallbackTitle?: string;
  /** The tile's colour when there is no picture. */
  readonly tone?: string;
}) {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const picture = experience
    ? cardPictures(experience).find((p) => !broken.has(p.src))
    : undefined;

  if (!picture)
    return (
      <div
        data-testid="picture-tile"
        className={cn(
          "relative flex items-end overflow-hidden p-4 text-white",
          className,
        )}
        style={{
          background: `linear-gradient(140deg, ${tone}, color-mix(in srgb, ${tone} 55%, #000))`,
        }}
      >
        <span className="ghad-display line-clamp-3 text-lg leading-tight font-extrabold tracking-tight">
          {fallbackTitle ?? experience?.title ?? ""}
        </span>
      </div>
    );

  return (
    <div className={cn("relative overflow-hidden bg-black/[0.06]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline */}
      <img
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
