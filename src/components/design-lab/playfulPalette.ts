/**
 * **Colour derived from Atlas's own word, not from a table Passport keeps.**
 *
 * The playful direction colour-codes what you can do. The obvious way to do
 * that is a map of verb → colour, which is a taxonomy: it has to be written,
 * maintained, and it silently drops any verb nobody thought of — and Atlas's
 * affordance vocabulary is open (`Hiking`, `mountain biking`, `Spotting koi in
 * the pond`).
 *
 * So the hue is a hash of the string. Every verb gets one, the same one
 * everywhere, and nothing has to be listed.
 */
export const PALETTE = [
  { bg: "#1f6b4f", ink: "#eafff4" }, // pine
  { bg: "#1b5f8c", ink: "#e8f6ff" }, // lake
  { bg: "#b4541f", ink: "#fff1e6" }, // clay
  { bg: "#6b3f86", ink: "#f8edff" }, // plum
  { bg: "#8a6a12", ink: "#fff8e2" }, // wheat
  { bg: "#9c2f47", ink: "#ffeef2" }, // rosehip
] as const;

export function colourOf(label: string): (typeof PALETTE)[number] {
  let hash = 0;
  for (const character of label.toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}
