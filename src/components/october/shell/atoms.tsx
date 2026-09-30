import Link from "next/link";
import type { ReactNode } from "react";
import type { AreaStatus } from "@/domain/october/areas";

/**
 * **The small pieces every October surface is built from.**
 *
 * Kept together and kept few, so the skeleton has one hierarchy rather than
 * eight. Nothing here is October-flavoured decoration — the atmosphere comes
 * from the palette and the space, not from ornament on individual parts.
 */

/**
 * How true a thing is.
 *
 * Only shown when the answer is not "live". A badge on everything is noise and
 * trains a person to stop reading badges, which is the opposite of what this
 * is for: the unmarked case should be the trustworthy one, and the marked
 * cases should be rare enough to still carry meaning.
 */
export function Honesty({ status }: { readonly status: AreaStatus }) {
  if (status === "live") return null;
  const label = status === "prototype" ? "Prototype" : "Not yet";
  return (
    <span
      data-testid={`honesty-${status}`}
      className="inline-flex shrink-0 items-center rounded-full border border-[#e9e6da]/15 px-2 py-0.5 text-[10px] tracking-widest text-[#e9e6da]/40 uppercase"
    >
      {label}
    </span>
  );
}

/** A titled band of the page, with room to breathe and an optional aside. */
export function Section({
  title,
  note,
  action,
  children,
}: {
  readonly title: string;
  readonly note?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[11px] font-medium tracking-[0.2em] text-[#d09a4e] uppercase">
          {title}
        </h2>
        {action}
      </div>
      {note ? (
        <p className="mt-2 max-w-xl text-sm text-[#e9e6da]/45">{note}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * A card. Whole surface is the target, because a person on a phone should not
 * have to find the link inside it.
 *
 * **`href` is optional, and an absent one renders a card that does not
 * navigate.** It must never be defaulted to a list. A card stands for one
 * specific thing, and sending it to "everything" throws away the only piece
 * of information the person supplied by tapping it — which is *which* thing
 * they meant. A card that cannot be opened is an honest outcome; a card that
 * lies about where it goes is not.
 */
export function Card({
  href,
  eyebrow,
  title,
  line,
  status,
  media,
  external,
  options,
  optionsLabel,
}: {
  readonly href?: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly line?: string;
  readonly status?: AreaStatus;
  readonly media?: { src: string; alt: string };
  readonly external?: boolean;
  /**
   * The ways into this Thing that the lane actually matched — the modes of an
   * attraction, the parts of a festival. Named, never counted: "2 options" tells
   * a person nothing they can act on, and "and more" hides what they asked for.
   */
  readonly options?: readonly string[];
  /** What the options are relative to — "Tonight", "This weekend", "In October". */
  readonly optionsLabel?: string;
}) {
  const surface =
    "group flex min-h-24 flex-col justify-between rounded-xl border p-4 transition-colors";
  const body = (
    <>
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.src}
          alt={media.alt}
          loading="lazy"
          className="mb-3 h-28 w-full rounded-lg object-cover opacity-80 transition-opacity group-hover:opacity-100"
        />
      ) : null}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] tracking-wider text-[#e9e6da]/35 uppercase">
                {eyebrow}
              </p>
            ) : null}
            <p className="font-heading mt-0.5 text-lg leading-snug text-[#f3efe4]">
              {title}
            </p>
          </div>
          {status ? <Honesty status={status} /> : null}
        </div>
        {line ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-[#e9e6da]/50">
            {line}
          </p>
        ) : null}
        {options && options.length > 0 ? (
          <p
            data-testid="card-options"
            className="mt-2.5 text-sm text-[#e9e6da]/70"
          >
            {optionsLabel ? (
              <span className="text-[11px] tracking-wider text-[#d09a4e] uppercase">
                {optionsLabel}{" "}
              </span>
            ) : null}
            {options.join(" · ")}
          </p>
        ) : null}
      </div>
      {external ? (
        <p className="mt-3 text-[11px] tracking-widest text-[#d09a4e] uppercase">
          Open
        </p>
      ) : null}
    </>
  );

  if (!href) {
    return (
      <div
        data-testid="october-card"
        data-unopenable="true"
        className={`${surface} border-[#e9e6da]/[0.07] bg-[#e9e6da]/[0.02]`}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      data-testid="october-card"
      className={`${surface} border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] hover:border-[#d09a4e]/40 hover:bg-[#e9e6da]/[0.06]`}
    >
      {body}
    </Link>
  );
}

/**
 * What a surface says when it has nothing. Said plainly and without apology:
 * an empty October is a fact about tonight, not a failure of the page.
 */
export function Nothing({ children }: { readonly children: ReactNode }) {
  return (
    <p
      data-testid="october-nothing"
      className="max-w-xl text-[#e9e6da]/55 italic"
    >
      {children}
    </p>
  );
}

/**
 * **Atlas could not answer, and the page says so.**
 *
 * The one sentence that keeps a fault from reading as a quiet month. It names
 * no credential and no host: which secret is wrong is in the server log, and
 * a visitor is owed the fact that this is our fault rather than the details of
 * how. Deliberately the same weight as `Nothing` — this is not an error
 * screen, it is a lane admitting it cannot see.
 */
export function Unanswered() {
  return (
    <p
      data-testid="atlas-unanswered"
      className="max-w-xl text-[#e9e6da]/55 italic"
    >
      October can&apos;t see what&apos;s on right now — something at our end is
      not answering. This is a fault, not a quiet month.
    </p>
  );
}
