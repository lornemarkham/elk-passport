/**
 * The few marks every section of the printed guide shares: headings, a box
 * to tick, a line to write on. Black on white, no fills, so a home printer
 * spends its ink on words.
 */

export const H2 =
  "ghad-display text-[19px] font-extrabold tracking-[-0.01em] uppercase";

export const H3 =
  "ghad-display text-[14px] font-bold tracking-[0.06em] uppercase";

export function Box() {
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-block h-4 w-4 shrink-0 border-2 border-[#111]"
    />
  );
}

export function Rule() {
  return <span aria-hidden className="block h-8 border-b border-[#777]" />;
}

/** A blank to write a clock time in. */
export function TimeBlank({ label }: { readonly label: string }) {
  return (
    <span className="inline-flex items-end gap-1 whitespace-nowrap">
      <span className="sr-only">{label}: </span>
      <span
        aria-hidden
        className="inline-block h-5 w-6 border-b border-[#777]"
      />
      <span aria-hidden className="pb-0.5">
        :
      </span>
      <span
        aria-hidden
        className="inline-block h-5 w-6 border-b border-[#777]"
      />
    </span>
  );
}

/** "A, B and C". */
export const listOf = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
