import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ThemeProvider } from "./theme";

/**
 * **The one step between reading about somewhere and going there.**
 *
 * An entity page answers *what is this?* exhaustively and then stopped. This
 * is the step the brief's journey turns on — find it, open it, **say yes** —
 * and it carries the day and the age forward so the plan is about the Sunday
 * somebody actually picked rather than about today in general.
 *
 * Deliberately a band above the existing page rather than a redesign of it:
 * the entity architecture stays exactly as it is, and the identity arrives as
 * an addition that can be removed in one line.
 */
export function LetsDoThis({
  id,
  on,
  childAge,
  back,
}: {
  readonly id: string;
  /** The day they picked, `YYYY-MM-DD`, where they picked one. */
  readonly on?: string;
  readonly childAge?: number;
  /** Where to send them back to. Same-site, already checked by the caller. */
  readonly back?: string;
}) {
  const query = new URLSearchParams();
  if (on) query.set("on", on);
  if (childAge !== undefined) query.set("childAge", String(childAge));
  if (back) query.set("back", back);
  const href = `/day/${id}${query.size > 0 ? `?${query}` : ""}`;

  return (
    <ThemeProvider>
      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-[13px] text-black/50">
            {on
              ? "Decided? Here is what Atlas knows about going on that day — and what it does not."
              : "Decided? Here is what Atlas knows about going — and what it does not."}
          </p>
          <Link
            href={href}
            data-testid="lets-do-this"
            style={{
              backgroundColor: "var(--ghad-accent)",
              color: "var(--ghad-accent-ink)",
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-semibold"
          >
            Let’s do this
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </ThemeProvider>
  );
}
