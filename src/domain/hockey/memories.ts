import { z } from "zod";

/**
 * **Memories: the night's photographs, kept by the group.**
 *
 * A photo is a small JPEG the phone has already shrunk, stored against the
 * night (`passport_occasion_photos`, `memories-migration.sql`). Everyone on
 * the night sees all of them; the person who took one, or the host, may take
 * it down. Nothing is public and nothing leaves the night.
 *
 * The rules a picture must pass live here so the browser, the route and the
 * tests share one definition. The database repeats the size cap.
 */

/** Longest edge after the phone shrinks it. */
export const PHOTO_EDGE_PX = 1280;
/** The most pictures one night keeps, so an album cannot grow without limit. */
export const PHOTOS_PER_NIGHT = 120;
/** Base64 characters, about 600 KB of picture. Matches the table's check. */
export const PHOTO_MAX_CHARS = 800_000;

/** JPEG files in base64 always begin with these characters (`FF D8 FF`). */
const JPEG_BASE64 = /^\/9j\/[A-Za-z0-9+/]+={0,2}$/;

export const PhotoInputSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(140)
    .transform((s) => s.replace(/\s+/g, " "))
    .optional()
    .default(""),
  /** Base64 of a JPEG, without a `data:` prefix. */
  data: z
    .string()
    .min(100, "That isn't a photo.")
    .max(PHOTO_MAX_CHARS, "That photo is too big — try another.")
    .regex(JPEG_BASE64, "Photos have to be JPEGs."),
});

export type PhotoInput = z.infer<typeof PhotoInputSchema>;

/** What the album shows for one picture. The bytes are fetched separately. */
export interface Memory {
  readonly id: string;
  readonly by: string;
  readonly byName: string;
  readonly byEmoji: string;
  readonly caption: string;
  readonly at: string;
  /** True when this person took it, or is the host: they may take it down. */
  readonly mine: boolean;
  readonly canRemove: boolean;
}

export interface MemoriesView {
  /** False until the photos migration is applied. The rest of the night works. */
  readonly available: boolean;
  readonly photos: readonly Memory[];
}

/** Things to take a picture of: the night's own photo challenges, as captions. */
export function photoPrompts(opponent: string): readonly string[] {
  return [
    `All of us plus one ${opponent} fan`,
    "The worst item of merchandise in the building",
    "Us, before the first goal",
    "Someone looking far too serious about a pretzel",
    "The view from our seats",
  ];
}
