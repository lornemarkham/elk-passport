/**
 * Which run of nights a night belongs to, and where in it. Kept apart from
 * `series.ts` so `night.ts` can say "No. 2" without importing the Cup.
 *
 * Both live in the night's own `details` jsonb, so nothing in the schema had
 * to change for a night to have a sequel.
 */

export interface SeriesDetails {
  /** The id of the night this run started with. Absent: this night is the first. */
  readonly series?: string;
  /** 1 for the first night, 2 for the one after… Absent: 1. */
  readonly edition?: number;
}

export function seriesOf(night: {
  readonly id: string;
  readonly details: SeriesDetails;
}): string {
  return typeof night.details.series === "string"
    ? night.details.series
    : night.id;
}

export function editionOf(night: { readonly details: SeriesDetails }): number {
  const n = night.details.edition;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 1;
}

/** "No. 3". Roman numerals were considered and found to be too much. */
export const editionLabel = (edition: number) => `No. ${edition}`;
