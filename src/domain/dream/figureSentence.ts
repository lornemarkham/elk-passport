import type { FigureOption } from "./figure";

/**
 * **The sentence four taps make**, in the order a day is lived. Shown to the
 * person before anything is read, so the reading is theirs to correct.
 */
export function sentenceFrom(picks: readonly FigureOption[]): string {
  const things = picks
    .filter((p) => !["day", "near", "far"].includes(p.id))
    .map((p) => p.phrase);
  const when = picks.find((p) => p.id === "day")?.phrase;
  const reach = picks.find((p) => p.id === "near" || p.id === "far")?.phrase;
  const list =
    things.length > 1
      ? `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`
      : (things[0] ?? "something good");
  const tail = [when, reach].filter(Boolean).join(", ");
  const sentence = `${list}${tail ? `, ${tail}` : ""}.`;
  return sentence[0]!.toUpperCase() + sentence.slice(1);
}
