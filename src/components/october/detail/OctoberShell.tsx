import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * **The frame every October subject is shown in.**
 *
 * October provides the frame; the subject provides the colour. The canvas is
 * dark and the type is October's, but nothing here tints an image or filters
 * artwork — Fall Fest's orange scarecrow stays orange, a concert photograph
 * stays photographic, and the night sky is allowed to be black.
 *
 * Its whole job is that a person who entered through October never falls out
 * of it: the page they land on looks like where they came from, and there is
 * always a way back and a way to keep the thing.
 */
export function OctoberShell({
  children,
  actions,
  backTo = "/october/discover",
  backLabel = "Back to October",
}: {
  readonly children: ReactNode;
  /** Save, and whatever the publisher genuinely published. */
  readonly actions?: ReactNode;
  /**
   * **Where "back" goes.**
   *
   * `/october/discover` by default, which is October's one discovery surface
   * — and which, since the synthesis was promoted, is the surface a reader
   * actually came from. For a while it was not: Discover had been replaced
   * and this still returned people to the page it replaced, with their search
   * and filters gone. Overridable because this shell is not only October's.
   */
  readonly backTo?: string;
  readonly backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-8">
        <Link
          href={backTo}
          data-testid="back-to-october"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-[#e9e6da]/45 transition-colors hover:text-[#e9e6da]/85"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>
      {children}
      {actions}
    </div>
  );
}

/**
 * Provenance, kept and kept quiet.
 *
 * A count a normal reader can skip and a sceptical one can open. Removing it
 * would throw away the thing that makes any of this trustworthy; leading with
 * it makes a consumer feel they are reading an evidence audit.
 *
 * `hidden` is the other half of the promise. An October page prints a fact
 * once, in the place it reads best, which means it declines to print some of
 * what Atlas holds — `Start` and `End` under a WHEN block that already says
 * both. Listing those here, with the rule that dropped each one, is what
 * separates a page that composes its evidence from a page that edits it.
 */
export function OctoberProvenance({
  sources,
  hidden = [],
}: {
  readonly sources: readonly {
    id: string;
    url: string;
    sourceType?: string;
  }[];
  readonly hidden?: readonly {
    label: string;
    value: string;
    rule: string;
  }[];
}) {
  if (sources.length === 0) return null;
  return (
    <details
      data-testid="october-provenance"
      className="mx-auto mt-14 max-w-5xl px-5 sm:px-8"
    >
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-[#e9e6da]/35 transition-colors hover:text-[#e9e6da]/70">
        {/* **Where this came from**, not *how sure we are*. The evidence is
            unchanged in the data and still one press away; what has gone is
            the internal verification language — "Verified from 1 source" is
            Atlas talking to its curators, in a page a traveller is reading. */}
        Where this came from
      </summary>
      <ul className="mt-4 flex flex-col gap-2 pb-4">
        {sources.map((source) => (
          <li key={source.id} className="text-sm">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[#e9e6da]/55 underline-offset-4 hover:text-[#e9e6da]/85 hover:underline"
            >
              {source.url.replace(/^https?:\/\//, "").slice(0, 80)}
            </a>
            {source.sourceType && (
              <span className="ml-2 text-xs text-[#e9e6da]/25">
                {source.sourceType}
              </span>
            )}
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <div className="pb-4">
          <p className="text-xs tracking-widest text-[#e9e6da]/35 uppercase">
            Held by Atlas, not printed above
          </p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#e9e6da]/35">
            Nothing is removed from Atlas. These are facts this page already
            says somewhere it reads better.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {hidden.map((fact) => (
              <li
                key={`${fact.label}|${fact.value}|${fact.rule}`}
                className="text-xs text-[#e9e6da]/45"
              >
                <span className="font-medium">{fact.label}</span> — {fact.rule}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
