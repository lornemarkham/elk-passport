import type { Place, PlaceOperator } from "@/lib/data/types";
import { SectionShell } from "./SectionShell";
import { groupKeyFacts } from "./keyFactSelection";

/**
 * **What the sources actually said about this place.**
 *
 * A definition list, because that is what these are: a publisher's label and a
 * publisher's sentence. Both are rendered verbatim — Passport chooses which
 * facts appear and nothing else, so a reader is never shown a claim no source
 * made.
 *
 * Renders nothing when Atlas holds nothing usable, rather than an empty
 * heading.
 */
export function PlaceKeyFacts({
  place,
  operatedBy,
}: {
  place: Place;
  operatedBy?: readonly PlaceOperator[];
}) {
  const groups = groupKeyFacts(place, operatedBy ?? []);
  if (groups.length === 0) return null;

  return (
    <SectionShell title="Good to know">
      <div className="flex flex-col gap-6" data-testid="place-key-facts">
        {groups.map((group, index) => (
          <div
            key={`${group.operator?.id ?? "place"}-${group.category ?? `ungrouped-${index}`}`}
          >
            {/* Said plainly. These facts belong to the operator, not to the
                Place, and Atlas keeps them on separate entities — the page
                should not blur what the graph is careful about. */}
            {group.operator && (
              <p className="text-muted-foreground mb-2 text-xs">
                From <span className="font-medium">{group.operator.name}</span>,
                which operates this place
              </p>
            )}
            {group.category && (
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                {group.category}
              </h3>
            )}
            <dl className="flex flex-col gap-3">
              {group.facts.map((fact) => (
                <div key={`${fact.label}-${fact.value.slice(0, 24)}`}>
                  <dt className="text-sm font-medium">{fact.label}</dt>
                  <dd className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
