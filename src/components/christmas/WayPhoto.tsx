"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type StaticImageData } from "next/image";

/**
 * **A way's photograph, fetched when it is about to be seen.** The browser's
 * own lazy loading starts more than a screen early, so on a phone the six
 * pictures under the hero were downloading beside the discovery below them
 * and held it back (M1128: first event card 4.7 s against 3.6 s without
 * them, slow 4G). Until the picture is near the screen its blurred preview
 * holds the space; nothing moves when the photograph arrives.
 */
export function WayPhoto({
  image,
  alt,
  sizes,
  focus,
  className,
}: {
  readonly image: StaticImageData;
  readonly alt: string;
  readonly sizes: string;
  readonly focus: string;
  readonly className?: string;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          seen.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [near]);
  return (
    <span
      ref={box}
      className="absolute inset-0"
      style={{
        backgroundImage: image.blurDataURL
          ? `url(${image.blurDataURL})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: focus,
      }}
    >
      {near && (
        <Image
          src={image}
          alt={alt}
          fill
          sizes={sizes}
          className={className}
          style={{ objectPosition: focus }}
        />
      )}
    </span>
  );
}
