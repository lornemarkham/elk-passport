/**
 * **The same photograph, at the size it is shown.**
 *
 * Atlas holds the address of a picture on the publisher's own site, and those
 * are usually the publisher's largest rendition: a card 300–400px wide was
 * fetching a 2.7 MB Kelowna JPEG, a 3.9 MB Squarespace PNG and 1280px
 * Wikimedia thumbnails (660 KB each). One load of `/discovery` on a phone
 * moved 8.7 MB, nearly all of it pictures.
 *
 * Several hosts will resize on request, by a parameter that is part of the
 * address. This rewrites those addresses — and only those — to ask for the
 * widths a card is actually drawn at, and returns them as a `srcSet` so a
 * high-density screen still gets the sharper one. Nothing is cropped or
 * recompressed here, and the picture is the same picture: an address this does
 * not recognise is returned exactly as it came, so the worst case is the old
 * behaviour, never a broken image.
 *
 * It does not choose a host to trust or fetch anything: the browser still
 * loads from the publisher, so credit and licence are unchanged.
 */

/** The renditions a card asks for. Wikimedia only serves a fixed set of widths. */
export const CARD_WIDTHS: readonly number[] = [500, 960];

/**
 * What a card's `<img>` tells the browser about its drawn width: the shelf
 * cards are 300px wide on a phone and 400px from the small-tablet breakpoint
 * up (measured at 390, 820 and 1366px).
 */
export const CARD_SIZES = "(min-width: 640px) 400px, 300px";

/** A 64px thumbnail, drawn at up to 3x density. */
export const THUMB_WIDTHS: readonly number[] = [250, 500];

export interface SizedImage {
  readonly src: string;
  readonly srcSet?: string;
}

/**
 * `widths` ascending. `src` (for a browser that ignores `srcset`) is the
 * largest rendition requested, never an upscale of the original.
 */
export function sizedImage(
  url: string,
  widths: readonly number[] = CARD_WIDTHS,
): SizedImage {
  const variants = widths
    .map((width) => ({ width, url: rewrite(url, width) }))
    .filter((v): v is { width: number; url: string } => v.url !== undefined);
  if (variants.length === 0) return { src: url };
  const largest = variants[variants.length - 1];
  if (!largest) return { src: url };
  return {
    src: largest.url,
    srcSet: variants.map((v) => `${v.url} ${v.width}w`).join(", "),
  };
}

/** The address for `width`, or `undefined` when the host is not one we know or the original is already smaller. */
function rewrite(raw: string, width: number): string | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();

  if (host === "upload.wikimedia.org" || host === "thumb.wikimedia.org") {
    return wikimedia(url, width);
  }
  if (host === "assets.simpleviewinc.com" || host === "res.cloudinary.com") {
    return cloudinary(url, width);
  }
  if (
    host === "images.squarespace-cdn.com" ||
    host === "static1.squarespace.com"
  ) {
    return squarespace(url, width);
  }
  if (host.endsWith(".widen.net")) return widen(url, width);
  if (host === "static.wixstatic.com") return wix(url, width);
  return undefined;
}

/**
 * `…/thumb/a/ab/File.jpg/1280px-File.jpg` → `…/500px-File.jpg`. A file that
 * is not a `/thumb/` address is the original upload and is left alone, and a
 * thumbnail already narrower than `width` is not asked to grow.
 */
function wikimedia(url: URL, width: number): string | undefined {
  const match = /^(.*\/thumb\/.+\/)(\d+)px-([^/]+)$/.exec(url.pathname);
  if (!match) return undefined;
  const current = Number(match[2]);
  if (!(current > width)) return undefined;
  const next = new URL(url.href);
  next.pathname = `${match[1]}${width}px-${match[3]}`;
  return next.href;
}

/**
 * Cloudinary's delivery transformations sit between `/upload/` and the
 * version (`v123…`). Cap the width where one is stated (scaling a stated
 * height with it), and add a width limit where there is none.
 */
function cloudinary(url: URL, width: number): string | undefined {
  const match = /^(.*?\/image\/(?:upload|fetch)\/)(.*)$/.exec(url.pathname);
  if (!match) return undefined;
  const prefix = match[1] ?? "";
  const rest = match[2] ?? "";
  // `v1/clients/…` has no transformation; `c_limit,w_1200/v1/…` has one.
  const first = rest.split("/")[0] ?? "";
  if (first === "") return undefined;
  const transformation = /^v\d+$/.test(first) ? "" : first;
  const tail =
    transformation === "" ? rest : rest.slice(transformation.length + 1);

  let next: string;
  if (transformation === "") {
    next = `c_limit,w_${width}`;
  } else {
    const parts = transformation.split(",");
    const w = parts.find((p) => /^w_\d+$/.test(p));
    if (!w) {
      if (parts.some((p) => /^(h|ar|c)_/.test(p) && !/^c_limit$/.test(p))) {
        return undefined;
      }
      next = `${transformation},c_limit,w_${width}`;
    } else {
      const current = Number(w.slice(2));
      if (!(current > width)) return undefined;
      const ratio = width / current;
      next = parts
        .map((p) => {
          if (p === w) return `w_${width}`;
          if (/^h_\d+$/.test(p)) {
            return `h_${Math.max(1, Math.round(Number(p.slice(2)) * ratio))}`;
          }
          return p;
        })
        .join(",");
    }
  }
  const out = new URL(url.href);
  out.pathname = `${prefix}${next}/${tail}`;
  return out.href;
}

/** Squarespace serves any of its fixed widths with `?format=<n>w`. */
function squarespace(url: URL, width: number): string | undefined {
  const current = /^(\d+)w$/.exec(url.searchParams.get("format") ?? "");
  if (current && !(Number(current[1]) > width)) return undefined;
  const next = new URL(url.href);
  next.searchParams.set("format", `${width}w`);
  return next.href;
}

/** Widen's `w=` and `h=` are the rendition's size; scale both together. */
function widen(url: URL, width: number): string | undefined {
  const w = Number(url.searchParams.get("w"));
  if (!(w > width)) return undefined;
  const next = new URL(url.href);
  next.searchParams.set("w", String(width));
  const h = Number(url.searchParams.get("h"));
  if (h > 0) {
    next.searchParams.set(
      "h",
      String(Math.max(1, Math.round(h * (width / w)))),
    );
  }
  return next.href;
}

/** Wix states the rendition in the path: `/v1/fill/w_2500,h_1662,al_c/…`. */
function wix(url: URL, width: number): string | undefined {
  const match = /^(.*\/fill\/)w_(\d+),h_(\d+)(.*)$/.exec(url.pathname);
  if (!match) return undefined;
  const w = Number(match[2]);
  if (!(w > width)) return undefined;
  const h = Math.max(1, Math.round(Number(match[3]) * (width / w)));
  const next = new URL(url.href);
  next.pathname = `${match[1]}w_${width},h_${h}${match[4]}`;
  return next.href;
}
