import Link from "next/link";

/**
 * **GO HAVE A DAY.**
 *
 * Three words, set tight and heavy in the product's own grotesk, with a short
 * accent rule beneath. No serif, no all-caps shouting at body sizes, and no
 * coloured full stop — the round-four gimmick was the first thing to go.
 *
 * It has to sit above a toddler's playground, a winery and a hockey game with
 * equal comfort, so there is no mountain, no compass and no arc of text. The
 * confidence is in the weight and the tracking.
 *
 * ## Passport is still the name of the thing that runs it
 *
 * The repository, the architecture, the Atlas boundary and every internal
 * document keep the name. This is the name a person sees, and it is the only
 * place the two differ.
 */
export function Wordmark({
  size = "normal",
  href = "/discovery",
  lines = 2,
}: {
  readonly size?: "normal" | "large";
  readonly href?: string;
  /** Two lines for a page's own mark, one for a bar it has to sit along. */
  readonly lines?: 1 | 2;
}) {
  const type =
    size === "large"
      ? "text-[26px] sm:text-[34px] leading-[0.92]"
      : "text-[15px] sm:text-[17px] leading-[0.95]";
  return (
    <Link
      href={href}
      data-testid="ghad-wordmark"
      aria-label="Go Have A Day"
      className={
        lines === 1 ? "inline-flex items-center gap-2" : "inline-block"
      }
    >
      <span
        className={`ghad-display block font-extrabold tracking-[-0.045em] text-[#111] uppercase ${type}`}
      >
        {lines === 1 ? (
          "Go have a day"
        ) : (
          <>
            Go have
            <br />a day
          </>
        )}
      </span>
      <span
        aria-hidden
        className={
          lines === 1 ? "block h-[3px] w-4 shrink-0" : "mt-1 block h-[3px] w-7"
        }
        style={{ backgroundColor: "var(--ghad-accent)" }}
      />
    </Link>
  );
}
