import type { Possibility } from "@/lib/labs/october/possibility";
import { stableJitter } from "@/lib/labs/october/intents";

/**
 * **The two presentation primitives all three labs share.**
 *
 * They are here rather than in each lab because the brief is explicit that the
 * experiments must differ in *discovery model*, not in CSS — and because both
 * of these encode a rule that must not be allowed to drift between prototypes.
 */

/**
 * **A picture, or something deliberate instead of one.**
 *
 * Roughly a third of October's Atlas inventory has a usable photograph, every
 * film has a trailer still, and six Doings have a Commons photograph. The rest
 * have nothing, and the current Discover renders that nothing as a large black
 * rectangle, which is why it looks unfinished.
 *
 * So a possibility with no image never gets an image-shaped hole. It gets a
 * tinted ground carrying **when it is**, set large — a treatment, not a
 * fallback. The tint is derived from the id, so the same thing looks the same
 * on every surface and a row of them does not read as one block of colour.
 *
 * It carries the time rather than the title because the card underneath
 * already carries the title. The first version set the title here too, and a
 * tile for a long-named event read its own name twice in a row, which looks
 * like a bug rather than a design. The time is the one thing that is never
 * duplicated — and it is the property this whole lab is organised around.
 */
export function Shot({
  p,
  className = "",
  children,
}: {
  readonly p: Possibility;
  readonly className?: string;
  readonly children?: React.ReactNode;
}) {
  if (p.image) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image.src}
          alt={p.image.alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#0c0a0c] via-[#0c0a0c]/20 to-transparent"
        />
        {children}
      </div>
    );
  }

  const tint = TINTS[stableJitter(p.id, TINTS.length)];
  return (
    <div
      data-testid="no-photo"
      className={`relative flex items-center justify-center overflow-hidden ${tint} ${className}`}
    >
      <p
        aria-hidden
        className="px-4 text-center text-sm leading-tight tracking-[0.18em] text-balance text-[#f3efe4]/55 uppercase tabular-nums"
      >
        {p.availability.label}
      </p>
      {children}
    </div>
  );
}

/** Grounds for the no-photograph treatment. Dark, October, never grey. */
const TINTS = [
  "bg-gradient-to-br from-[#2a1608] to-[#120c10]",
  "bg-gradient-to-br from-[#1d1226] to-[#0f0c14]",
  "bg-gradient-to-br from-[#231206] to-[#141015]",
  "bg-gradient-to-br from-[#12201d] to-[#0d1013]",
  "bg-gradient-to-br from-[#2a1016] to-[#140e11]",
] as const;

/**
 * The time badge a card shows **unless the card's own picture slot is already
 * showing it** — which it is whenever there is no photograph. Without this the
 * no-photo tile printed `THU · 8 PM` twice, one line apart.
 */
export function CardWhen({ p }: { readonly p: Possibility }) {
  return p.image ? <When p={p} /> : null;
}

/**
 * **When, said the same way for everything.**
 *
 * `FRI · 7 PM`, `OCT 1–31`, `ANY NIGHT`, `BEFORE HALLOWEEN`, `DATES NOT
 * STATED`. A person reading a column of these can answer *can I do this
 * tonight* without being told which of five tables the row came from, which
 * is the whole hypothesis.
 *
 * Only `tonight` gets colour. If everything is emphasised nothing is, and the
 * one distinction that matters at six o'clock is tonight or not tonight.
 */
export function When({
  p,
  className = "",
}: {
  readonly p: Possibility;
  readonly className?: string;
}) {
  const on = p.availability.tonight && p.availability.shape !== "anytime";
  return (
    <span
      data-testid="when"
      data-shape={p.availability.shape}
      className={`inline-block text-[10px] tracking-[0.18em] uppercase tabular-nums ${
        on ? "text-[#d09a4e]" : "text-[#e9e6da]/40"
      } ${className}`}
    >
      {p.availability.label}
    </span>
  );
}

/**
 * The reason a possibility is where it is, when there is an honest one.
 *
 * Rendered as October's own voice rather than a system label — "Clear sky
 * tonight — the one thing this needs", not "weather match: 0.8". A fit with no
 * reason renders nothing at all, which is most of them.
 */
export function Because({ because }: { readonly because?: string }) {
  if (!because) return null;
  return (
    <p
      data-testid="because"
      className="mt-2 text-sm leading-snug text-[#d09a4e]/85"
    >
      {because}
    </p>
  );
}

/** Says out loud that a page is showing a simulated evening. Dev only. */
export function Simulated({ label }: { readonly label?: string }) {
  if (!label) return null;
  return (
    <p className="mb-4 inline-block rounded-full border border-[#d09a4e]/40 bg-[#d09a4e]/10 px-3 py-1 text-[11px] tracking-[0.16em] text-[#f0c88a] uppercase">
      Simulated · {label}
    </p>
  );
}
