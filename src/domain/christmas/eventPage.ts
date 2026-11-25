import type { Experience } from "@/domain/experience/types";

/**
 * **A Christmas find opens on a Christmas page.** `/passport/[id]` is the
 * neutral traveller page for every kind and wears Passport's own shell; a card
 * inside Christmas goes to its own page, under Christmas's bar and colours, so
 * a family does not leave the experience to read about a market.
 */
export const eventHref = (id: string): string => `/christmas/event/${id}`;

const PRICE_LABEL = /\b(price|prices|admission|tickets?|cost|fee|fares?)\b/i;
const PLACE_LABEL =
  /^(location|venue|where|address|place|website|web|url|link|more info|information|contact)$/i;

/**
 * **What to expect** — the labelled facts a publisher stated that are not
 * already said elsewhere on the page (price and place have their own lines).
 * Atlas's words, verbatim; none is composed.
 */
export function expectLines(
  e: Experience,
): readonly { label: string; value: string }[] {
  const seen = new Set<string>();
  return (e.knowledge?.practical ?? [])
    .filter(
      (p) =>
        p.label.trim() &&
        p.value.trim() &&
        !PRICE_LABEL.test(p.label) &&
        !PLACE_LABEL.test(p.label.trim()),
    )
    .filter((p) => {
      const key = `${p.label}|${p.value}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((p) => ({ label: p.label.trim(), value: p.value.trim() }));
}
