import Link from "next/link";

/**
 * **ONE HELL OF A DAY — a wordmark, not a logo system.**
 *
 * The brief asked for a confident identity and explicitly not an elaborate
 * mark, so this is type and one rule. It has to carry a winery tasting and a
 * toddler's playground as comfortably as a mountain, which is why the
 * personality lives in the **words** — the full stop is part of the name, and
 * the tagline does the rest — rather than in anything mountain-shaped.
 *
 * One accent, a single vivid orange, used only where something is live or
 * chosen. Everything else is black on white, so the photographs are the only
 * other colour on the page.
 */
export const ACCENT = "#FF3B00";

export function Wordmark({
  size = "normal",
  href = "#",
}: {
  readonly size?: "normal" | "large" | "huge";
  readonly href?: string;
}) {
  const type =
    size === "huge"
      ? "text-[34px] sm:text-[72px] leading-[0.88]"
      : size === "large"
        ? "text-[22px] sm:text-[34px] leading-[0.9]"
        : "text-[15px] sm:text-[17px] leading-none";
  return (
    <Link href={href} className="inline-block">
      <span
        data-testid="wordmark"
        className={`block font-extrabold tracking-[-0.045em] text-balance uppercase ${type}`}
      >
        One hell of a day<span style={{ color: ACCENT }}>.</span>
      </span>
    </Link>
  );
}

/** The tagline. Small, lowercase, and never shouted alongside the wordmark. */
export function Tagline({ className = "" }: { readonly className?: string }) {
  return (
    <span className={`text-[13px] font-medium text-black/45 ${className}`}>
      Go have a day.
    </span>
  );
}

/**
 * The one piece of chrome every round-four prototype shares: wordmark left,
 * a count right. No nav, because Discovery is the page.
 */
export function BrandBar({
  total,
  href = "#",
}: {
  readonly total: number;
  readonly href?: string;
}) {
  return (
    <header className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-5 sm:px-10">
      <Wordmark href={href} />
      <p className="text-[12px] text-black/40 tabular-nums">
        {total.toLocaleString("en-CA")} real places · the Okanagan
      </p>
    </header>
  );
}
