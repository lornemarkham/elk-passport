import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type {
  AttributedObservation,
  DossierSource,
  EntityCorrection,
  GeographicObservation,
  MergeRecord,
  ResearchDossierView,
  TemporalClaim,
  TemporalValidityClaim,
} from "@/lib/data/explorer-dossier-repo";
import { Chip, Empty, Id, Panel } from "./primitives";

/**
 * **Where the knowledge came from.**
 *
 * Four distinct concepts, kept distinct — the mission's "do not flatten
 * distinct evidence concepts merely for UI simplicity", and the reason is
 * practical rather than pedantic:
 *
 * ```
 * SourceRecord            a page Atlas read
 * AttributedObservation   something a source said, with the sentence
 * GeographicObservation   a stated location, with who stated it
 * TemporalClaim           a stated time, with the passage it came from
 * ```
 *
 * A page can produce none of the three and still be real evidence; an
 * observation always names the record it came from. Merging them into one
 * "evidence" list would answer "is there evidence" and destroy "evidence of
 * what, said by whom, in which sentence" — which is the actual question when
 * a Passport page looks thin.
 */

function hostOf(source: string): string {
  try {
    return new URL(source).host;
  } catch {
    return source;
  }
}

export function SourcesPanel({ sources }: { sources: DossierSource[] }) {
  return (
    <Panel
      title="Sources"
      count={sources.length}
      subtitle="pages Atlas read that describe this"
    >
      {sources.length === 0 ? (
        <Empty>
          No source record describes this entity. Whatever Atlas holds about it
          arrived some other way — a merge, or a projection from another
          entity&apos;s fields.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {sources.map((source) => (
            <li
              key={source.id}
              className="border-border/40 border-b pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Chip>{source.sourceType}</Chip>
                <Link
                  href={`/explorer/sources/${source.id}`}
                  className="text-sm font-medium underline-offset-2 hover:underline"
                >
                  {hostOf(source.source)}
                </Link>
                <a
                  href={source.source}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open the original page"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <span className="text-muted-foreground ml-auto text-xs">
                  {new Date(source.retrievedAt).toISOString().slice(0, 10)}
                </span>
              </div>

              <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                <span className="font-mono">
                  {source.rawContentChars.toLocaleString()} chars read
                </span>
                <span className="font-mono">{source.mediaCount} media</span>
                <span className="font-mono">
                  {source.observationCount} observations
                </span>
                {source.interpretedUnder && (
                  <span>extraction contract v{source.interpretedUnder}</span>
                )}
                {source.mediaSubject && (
                  <span>media subject: {source.mediaSubject}</span>
                )}
                {source.role && (
                  <span>
                    voice: {source.role}
                    {source.publishesAsSubject
                      ? " (the entity is the publisher)"
                      : ""}
                  </span>
                )}
                {source.about && (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    about this entity: {source.about}
                  </span>
                )}
                {source.discovered && (
                  <span title={source.discovered.reason}>
                    discovered: {source.discovered.basis}
                  </span>
                )}
              </p>

              <p className="text-muted-foreground/80 mt-1.5 line-clamp-3 font-mono text-[11px] break-all">
                {source.rawContentExcerpt.slice(0, 400) || "(empty)"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ObservationsPanel({
  attributed,
  geographic,
  temporal,
}: {
  attributed: AttributedObservation[];
  geographic: GeographicObservation[];
  temporal: TemporalClaim[];
}) {
  const total = attributed.length + geographic.length + temporal.length;

  return (
    <Panel
      title="Observations"
      count={total}
      subtitle="what a source said, kept apart from what Atlas concluded"
    >
      {total === 0 ? (
        <Empty>
          Atlas has recorded no attributed observation, stated location or
          temporal claim for this entity. Its fields, if it has any, were
          written by extraction rather than by the observation pipeline.
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {attributed.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
                Attributed · {attributed.length}
              </p>
              <ul className="flex flex-col gap-2">
                {attributed.map((observation) => (
                  <li key={observation.id} className="text-sm">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Chip>{observation.observationKind}</Chip>
                      <Chip>{observation.sourceRole}</Chip>
                    </span>
                    <p className="mt-0.5">{observation.statement}</p>
                    <p className="text-muted-foreground border-border/60 mt-0.5 border-l pl-2 text-xs italic">
                      {observation.supportingPassage}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {geographic.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
                Stated location · {geographic.length}
              </p>
              <ul className="flex flex-col gap-1.5">
                {geographic.map((observation) => (
                  <li key={observation.id} className="text-sm">
                    {[
                      observation.streetAddress,
                      observation.locality,
                      observation.region,
                      observation.postalCode,
                      observation.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "(no address stated)"}
                    {observation.coordinate && (
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        {observation.coordinate[0]}, {observation.coordinate[1]}
                      </span>
                    )}
                    {observation.locationRole && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        as {observation.locationRole}
                      </span>
                    )}
                    {observation.statedAs && (
                      <p className="text-muted-foreground border-border/60 mt-0.5 border-l pl-2 text-xs italic">
                        {observation.statedAs}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {temporal.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
                Temporal claims · {temporal.length}
              </p>
              <ul className="flex flex-col gap-1.5">
                {temporal.map((claim) => (
                  <li key={claim.id} className="text-sm">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Chip>{claim.shape}</Chip>
                      {claim.editionLabel && <Chip>{claim.editionLabel}</Chip>}
                      {claim.unresolved && <Chip>unresolved</Chip>}
                    </span>
                    <p className="text-muted-foreground border-border/60 mt-0.5 border-l pl-2 text-xs italic">
                      {claim.supportingPassage}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/**
 * Temporal validity (Atlas ADR 072): every time-bound claim with the three
 * things Atlas keeps apart — when it was observed, what it states about its
 * own validity, and whether Atlas will assert it now. A claim that is not
 * current is withheld from Passport and shown here with the reason.
 */
export function TemporalValidityPanel({
  claims,
  lapsed,
}: {
  claims: TemporalValidityClaim[];
  lapsed?: number;
}) {
  const stale = claims.filter((c) => !c.current).length;
  const day = (iso?: string) => (iso ? iso.slice(0, 10) : "undated");
  return (
    <Panel
      title="Temporal validity"
      count={claims.length}
      subtitle={`observed at, validity and current eligibility, kept apart${lapsed ? ` · ${lapsed} lapsed in history` : ""}`}
    >
      {claims.length === 0 ? (
        <Empty>
          Nothing time-bound is held about this entity: every claim is timeless
          and never expires.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {stale > 0 && (
            <li className="text-xs text-amber-700 dark:text-amber-400">
              {stale} of {claims.length} not current — withheld from Passport
            </li>
          )}
          {claims.map((c, i) => (
            <li key={i} className="text-sm">
              <span className="flex flex-wrap items-center gap-1.5">
                <Chip>{c.class}</Chip>
                <Chip>{c.current ? "current" : "not current"}</Chip>
                <span className="font-medium">{c.label ?? c.field}</span>
                <span className="text-muted-foreground">
                  {c.value.length > 120 ? `${c.value.slice(0, 120)}…` : c.value}
                </span>
              </span>
              <p className="text-muted-foreground border-border/60 mt-0.5 border-l pl-2 text-xs">
                observed {day(c.observedAt)}
                {(c.validFrom || c.validUntil) &&
                  ` · valid ${day(c.validFrom)} to ${day(c.validUntil)}`}
                {" · "}
                {c.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * What has been done *to* this record — merges it survived or was absorbed
 * by, corrections that retired or replaced it, and what Atlas has tried to
 * find out about it.
 *
 * This is the section that answers "why are there four O'Keefe Ranches" and
 * "has anybody actually gone looking for more about this".
 */
export function HistoryPanel({
  merges,
  corrections,
  research,
}: {
  merges: MergeRecord[];
  corrections: EntityCorrection[];
  research?: ResearchDossierView;
}) {
  const total = merges.length + corrections.length + (research ? 1 : 0);

  return (
    <Panel
      title="Curation & research"
      count={total}
      subtitle="what has happened to this record"
    >
      {total === 0 ? (
        <Empty>
          Never merged, never corrected, and Atlas has opened no research
          dossier on it — so nothing has deliberately looked into this entity.
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {research && (
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
                Research
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <Chip>{research.state}</Chip>
                <span className="text-muted-foreground text-xs">
                  policy {research.policyId} v{research.policyVersion} · ladder
                  v{research.ladderVersion} · {research.attempts.length}{" "}
                  attempts
                </span>
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {research.stateReason}
              </p>
              {research.attempts.length > 0 && (
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {research.attempts.map((attempt, index) => (
                    <li
                      key={`${attempt.rungName ?? "rung"}-${index}`}
                      className="text-muted-foreground text-xs"
                    >
                      <span className="font-mono">
                        rung {attempt.rungNumber ?? "?"}
                      </span>{" "}
                      {attempt.rungName} — {attempt.outcome}
                      {attempt.publisher ? ` · ${attempt.publisher}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {merges.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
                Merges · {merges.length}
              </p>
              <ul className="flex flex-col gap-1">
                {merges.map((merge) => (
                  <li key={merge.id} className="text-sm">
                    absorbed <Id value={merge.absorbedId} /> into{" "}
                    <Id value={merge.survivingId} />
                    {merge.reason && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {merge.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {corrections.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
                Corrections · {corrections.length}
              </p>
              <ul className="flex flex-col gap-1.5">
                {corrections.map((correction) => (
                  <li key={correction.id} className="text-sm">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {correction.correctionType && (
                        <Chip>{correction.correctionType}</Chip>
                      )}
                      <Chip>{correction.ontologyRule}</Chip>
                    </span>
                    <p className="mt-0.5">{correction.reason}</p>
                    {correction.evidencePassage && (
                      <p className="text-muted-foreground border-border/60 mt-0.5 border-l pl-2 text-xs italic">
                        {correction.evidencePassage}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
