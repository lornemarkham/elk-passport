import Link from "next/link";

/**
 * **This is a prototype, and it says so on every screen.**
 *
 * A design exploration that looks like the product is one screenshot away from
 * being mistaken for the product. The bar names the direction, says what it is,
 * and links back to the comparison.
 *
 * It used to read *"not live"*, which stopped being true the moment these were
 * deployed so they could be opened on a phone. Reachable and chosen are
 * different things, and the bar now says the second one.
 */
export function LabNote({
  direction,
  tone = "light",
}: {
  readonly direction:
    | "editorial"
    | "cinematic"
    | "playful"
    | "editorial-cinematic"
    | "immersive explorer"
    | "travel journal";
  readonly tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      data-testid="lab-note"
      data-direction={direction}
      className={
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2 text-[11px] tracking-wide sm:px-10 " +
        (dark
          ? "bg-white/[0.07] text-white/55"
          : "bg-[#15130f]/[0.06] text-[#15130f]/55")
      }
    >
      <span className="uppercase">
        Design lab · <strong className="font-semibold">{direction}</strong> ·
        exploration, not the product
      </span>
      <Link href="/labs/design" className="underline underline-offset-2">
        Compare all six
      </Link>
    </div>
  );
}
