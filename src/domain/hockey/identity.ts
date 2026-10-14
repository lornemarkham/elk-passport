/**
 * **How somebody first appears on a night, before they say otherwise.**
 *
 * The lab gave each person an emoji and a hue so they are recognisable across
 * the roster, the picks and the feed without a photo. A real account has
 * neither, so one is chosen from the account id — stable across devices, so
 * "Nathan on his phone" and "Nathan on his laptop" are visibly the same Nathan
 * — and the person can change it on the night.
 */
export const EMOJI = [
  "🧭",
  "🥅",
  "🎤",
  "🚕",
  "📸",
  "🥂",
  "🌭",
  "🧤",
  "🍻",
  "🦆",
  "🐐",
  "🎺",
  "🌮",
  "🧊",
  "🛼",
  "🦫",
  "🍕",
  "🎯",
  "🪩",
  "🧃",
] as const;

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function defaultLook(userId: string): { emoji: string; hue: number } {
  const h = hash(userId);
  return { emoji: EMOJI[h % EMOJI.length], hue: (h >>> 8) % 360 };
}

/** A display name a person might reasonably arrive with, cut to what the table allows. */
export function cleanName(
  name: string | null | undefined,
  fallback: string,
): string {
  const trimmed = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  return trimmed || fallback;
}
