"use client";

/**
 * Photos, session-only and honestly so.
 *
 * The lab has no network and no storage worth putting an image in, so a
 * picked photo lives in memory for as long as the tab does and no longer. The
 * *caption* is the answer and is persisted normally; the image is a bonus.
 *
 * This is deliberate rather than lazy. What the photo mechanics are actually
 * testing — submit blind, open together, vote, and the winner ends up in the
 * memory — is entirely about the social shape, and that shape works perfectly
 * with a coloured tile. Building an upload pipeline first would have answered
 * a question nobody asked.
 */

const session = new Map<string, string>();

export const photoKey = (promptId: string, participantId: string) =>
  `${promptId}::${participantId}`;

export function putPhoto(key: string, dataUrl: string): void {
  session.set(key, dataUrl);
}

export function getPhoto(key: string): string | undefined {
  return session.get(key);
}

/** A stable, pleasant stand-in derived from the caption. Never random. */
export function tileFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  const a = hash;
  const b = (hash + 70) % 360;
  return `linear-gradient(135deg, oklch(0.55 0.13 ${a}), oklch(0.32 0.09 ${b}))`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
