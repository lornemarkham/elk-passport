import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import type { AdventureSummary } from "@/lib/adventures/store";
import { whenLabel } from "@/lib/adventures/present";
import { splitMine } from "@/domain/christmas/mine";

/**
 * **A person's own Christmas adventures** — compact and text-first: a title
 * once, when, where. Coming-up ones lead (soonest first); finished ones fold
 * behind a count so last season's tests never push this season's plans down.
 * Read by the signed-in person's own session, so it only ever holds theirs.
 */
export function MyAdventures({
  adventures,
  today,
}: {
  readonly adventures: readonly AdventureSummary[];
  readonly today: string;
}) {
  const { upcoming, past, hidden } = splitMine(adventures, today);
  return (
    <div data-testid="my-adventures">
      {upcoming.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {upcoming.map((a) => (
            <li key={a.id}>
              <Row adventure={a} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[22px] bg-white p-5 text-base ring-1 ring-black/5">
          Nothing coming up yet. Make a plan above — it appears here, for you
          and the people you invite.
        </p>
      )}
      {past.length > 0 && (
        <details className="mt-4 rounded-[22px] bg-white ring-1 ring-black/5">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 text-sm font-bold">
            Past adventures ({past.length})
          </summary>
          <ul className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
            {past.map((a) => (
              <li key={a.id}>
                <Row adventure={a} quiet />
              </li>
            ))}
          </ul>
        </details>
      )}
      {hidden > 0 && (
        <p className="mt-3 text-sm text-[var(--gh-ink-soft)]">
          {hidden} repeat{hidden === 1 ? "" : "s"} of the same plan{" "}
          {hidden === 1 ? "is" : "are"} tucked away — find{" "}
          {hidden === 1 ? "it" : "them"} in My Stuff.
        </p>
      )}
    </div>
  );
}

function Row({
  adventure,
  quiet = false,
}: {
  readonly adventure: AdventureSummary;
  readonly quiet?: boolean;
}) {
  const when = whenLabel(adventure.startsOn, adventure.endsOn);
  return (
    <Link
      href={`/adventures/${adventure.id}`}
      data-testid="my-adventure"
      className={`group flex min-h-16 items-center gap-3 rounded-[20px] p-4 ring-1 transition hover:ring-black/30 ${
        quiet ? "bg-[#f6f1e6] ring-black/5" : "bg-white ring-black/10"
      }`}
    >
      <span
        className={`h-10 w-1.5 shrink-0 rounded-full ${quiet ? "bg-[#cfc4ad]" : "bg-[#b3242f]"}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="ghad-display line-clamp-2 block text-lg leading-tight font-extrabold text-balance">
          {adventure.title}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-[var(--gh-ink-soft)]">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {when ?? "No date yet"}
          </span>
          {adventure.destinationLabel && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {adventure.destinationLabel}
            </span>
          )}
          {adventure.role === "participant" && <span>Joined</span>}
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 opacity-50 group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}
