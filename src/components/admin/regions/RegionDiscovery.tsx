"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CircleSlash,
  HelpCircle,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * **Teach Atlas something new.**
 *
 * Discovery V1 (ADR 031). One input, one name, and an honest account of
 * which publishers Atlas could consult and which it could not.
 *
 * ## It is not a search box
 *
 * A search box returns answers. This asks **who would know?** and returns
 * *sources* — each with a publisher, a reason and what reading it could
 * establish. Nothing here is a fact about the world until Atlas has
 * fetched the page and the identity gate has passed.
 *
 * ## The refusals are the honest part
 *
 * Atlas can construct a Wikipedia hypothesis from a name, and it can search
 * OpenStreetMap inside a Discovery Scope. It still cannot guess an
 * operator's domain. **Every refusal is shown with its reason** rather than
 * quietly omitted — a short list of participating publishers looks broken
 * until you can see the others were considered and declined.
 *
 * ## Where Atlas looked comes before what Atlas found
 *
 * Strategy #4 (ADR 032) searches a bounded area, so the scope is rendered
 * *above* the results. A result read without its scope is unreadable: "no
 * lakes found" is a fact about a rectangle, and only the rectangle can say
 * how much that is worth.
 *
 * ## Progress is real, not theatre
 *
 * The states below correspond to actual work: a request in flight, then a
 * result. No fake staged animation pretending to think — the design
 * system's rule is that movement is earned only when state changed.
 */

interface Lead {
  url: string;
  publisher: string;
  sourceType: string;
  basis: string;
  reason: string;
  couldEstablish: string[];
  state: "new" | "queued" | "read";
  /** Present once queued — needed to read it. */
  candidateSourceId?: string;
  /**
   * The entity this source taught Atlas. **Absent means read but not
   * learned** — a decision that is still waiting, not one that was made.
   */
  learnedEntityId?: string;
}

interface Consulted {
  publisher: string;
  participated: boolean;
  note: string;
}

type StrategyStatus =
  "succeeded" | "multiple-candidates" | "failed" | "not-applicable" | "skipped";

interface Strategy {
  number: number;
  name: string;
  status: StrategyStatus;
  detail: string;
}

interface DiscoveryScope {
  bbox: { south: number; west: number; north: number; east: number };
  source: "curator-asserted" | "member-derived";
  label: string;
  derivedFrom?: { id: string; name: string }[];
}

interface OSMCandidate {
  osmType: string;
  osmId: number;
  externalId: string;
  name: string;
  coordinates?: [number, number];
  tags: Record<string, string>;
  url: string;
  whyConsidered: string;
  identity: { hasIdentity: boolean; signals: string[]; reason?: string };
}

interface Report {
  name: string;
  outcome: "already-known" | "leads-found" | "queued-unread" | "no-sources";
  possibleMatches: { id: string; name: string; kind: string }[];
  leads: Lead[];
  consulted: Consulted[];
  strategies: Strategy[];
  scope?: DiscoveryScope;
  scopeRefusal?: { reason: string; remedy: string };
  osmCandidates: OSMCandidate[];
  osmQuery?: string;
  summary: string;
}

export function RegionDiscovery({
  regionId,
  regionName,
}: {
  regionId: string;
  regionName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<Record<string, "queuing" | "done">>({});
  const [reads, setReads] = useState<Record<string, ReadState>>({});

  async function investigate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    setReport(null);
    setQueued({});
    try {
      const res = await fetch("/api/admin/discovery/named", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, regionId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Atlas could not investigate that.");
      else setReport(data as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
    } finally {
      setBusy(false);
    }
  }

  async function queue(lead: Lead) {
    setQueued((q) => ({ ...q, [lead.url]: "queuing" }));
    try {
      const res = await fetch("/api/admin/candidate-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: lead.url,
          sourceType: lead.sourceType,
          reason: lead.reason,
          discoveryBasis: lead.basis,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas refused to queue that source.");
        setQueued((q) => {
          const next = { ...q };
          delete next[lead.url];
          return next;
        });
        return;
      }
      setQueued((q) => ({ ...q, [lead.url]: "done" }));
      if (data?.candidate?.id)
        setReads((r) => ({ ...r, [lead.url]: { id: data.candidate.id } }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setQueued((q) => {
        const next = { ...q };
        delete next[lead.url];
        return next;
      });
    }
  }

  async function readNow(lead: Lead, candidateSourceId: string) {
    setReads((r) => ({
      ...r,
      [lead.url]: { id: candidateSourceId, busy: true },
    }));
    try {
      const res = await fetch(
        `/api/admin/candidate-sources/${encodeURIComponent(candidateSourceId)}/read-targetless`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas could not read that source.");
        setReads((r) => ({ ...r, [lead.url]: { id: candidateSourceId } }));
        return;
      }
      setReads((r) => ({
        ...r,
        [lead.url]: { id: candidateSourceId, result: data },
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setReads((r) => ({ ...r, [lead.url]: { id: candidateSourceId } }));
    }
  }

  /**
   * **The write.** Everything before this was reversible; this creates an
   * entity, so it happens only because a person clicked it.
   *
   * The name is sent so Atlas can *refuse a mismatch* — it re-reads the
   * stored evidence in full and will not create a subject the curator did
   * not review.
   */
  async function learn(
    lead: Lead,
    id: string,
    confirmedName: string,
    acknowledgeDuplicate = false,
  ) {
    setReads((r) => ({
      ...r,
      [lead.url]: { ...r[lead.url]!, learning: true },
    }));
    try {
      const res = await fetch(
        `/api/admin/candidate-sources/${encodeURIComponent(id)}/learn`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmedName, acknowledgeDuplicate }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas could not create that entity.");
        setReads((r) => ({
          ...r,
          [lead.url]: { ...r[lead.url]!, learning: false },
        }));
        return;
      }
      setReads((r) => ({
        ...r,
        [lead.url]: {
          ...r[lead.url]!,
          learning: false,
          learned: data as LearnResult,
        },
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setReads((r) => ({
        ...r,
        [lead.url]: { ...r[lead.url]!, learning: false },
      }));
    }
  }

  /**
   * **Placing is a second statement.** Creating an entity says it exists;
   * this says it belongs here (ADR 025). Two acts, two clicks, on purpose.
   */
  async function place(lead: Lead, entityId: string, entityName: string) {
    setReads((r) => ({ ...r, [lead.url]: { ...r[lead.url]!, placing: true } }));
    try {
      const res = await fetch("/api/admin/relationships/contains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: regionId,
          childId: entityId,
          reason: `Curator placed ${entityName} in ${regionName} after learning it from a discovered source.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas could not place that entity.");
        setReads((r) => ({
          ...r,
          [lead.url]: { ...r[lead.url]!, placing: false },
        }));
        return;
      }
      setReads((r) => ({
        ...r,
        [lead.url]: { ...r[lead.url]!, placing: false, placed: true },
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setReads((r) => ({
        ...r,
        [lead.url]: { ...r[lead.url]!, placing: false },
      }));
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-4 w-4" />
          Teach Atlas something new
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed">
          Name one thing. Atlas works out <em>who would know</em> about it and
          what it could read — it does not search for answers. It investigates
          from {regionName}, which narrows where it looks and proves nothing
          about where anything belongs.
        </p>
      </div>

      <form onSubmit={investigate} className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should Atlas learn about?"
          className="h-10 min-w-[260px] flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {busy ? "Investigating…" : "Investigate"}
        </button>
      </form>

      {/* One name at a time, and it says so rather than silently ignoring
          a category. Faking category discovery is the failure ADR 031 was
          written to prevent. */}
      <p className="text-muted-foreground/80 text-[12px]">
        One named thing — <em>Hidden Lake</em>, <em>Vernon Vipers</em>.
        Categories like <em>fishing lakes</em> are not supported yet: Atlas
        cannot search, so it would have nothing truthful to return.
      </p>

      {error && (
        <p className="rounded-lg border border-amber-600/40 bg-amber-500/[0.05] px-4 py-3 text-[13px]">
          {error}
        </p>
      )}

      {report && (
        <div className="border-border overflow-hidden rounded-xl border-2">
          <div className="border-border bg-muted/30 border-b px-5 py-4">
            <p className="text-sm font-semibold">{report.summary}</p>
          </div>

          {report.possibleMatches.length > 0 && (
            <div className="border-border border-b px-5 py-4">
              <p className="text-[13px] font-medium">
                Atlas already holds this name
              </p>
              <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
                Shown so you can judge whether it is the same place. Atlas does
                not decide that — several real places share a name.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {report.possibleMatches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/admin/entities/${m.id}`}
                      className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px]"
                    >
                      {m.name}
                      <span className="text-muted-foreground">{m.kind}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* WHERE ATLAS LOOKED — the scope, before anything it found.
              Reading a result without knowing the area it came from is how a
              bounded zero gets mistaken for a fact about the world. */}
          <ScopePanel
            scope={report.scope}
            refusal={report.scopeRefusal}
            regionName={regionName}
          />

          {/* WHAT ATLAS TRIED — the ladder, in order, with real outcomes. */}
          <div className="border-border border-b px-5 py-4">
            <p className="text-[13px] font-medium">What Atlas tried</p>
            <ol className="mt-2 space-y-2">
              {report.strategies.map((s) => (
                <li key={s.number} className="flex gap-2.5">
                  <StrategyIcon status={s.status} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-medium">{s.name}</span>
                      <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                        {s.status.replace("-", " ")}
                      </span>
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[12px] leading-relaxed">
                      {s.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {report.osmCandidates.length > 0 && (
            <OSMCandidates
              candidates={report.osmCandidates}
              query={report.osmQuery}
            />
          )}

          {/* WHO WOULD KNOW — participants and refusals together. */}
          <div className="border-border border-b px-5 py-4">
            <p className="text-[13px] font-medium">Who would know?</p>
            <ul className="mt-2 space-y-2">
              {report.consulted.map((c) => (
                <li key={c.publisher} className="flex gap-2.5">
                  {c.participated ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
                  ) : (
                    <CircleSlash className="text-muted-foreground/40 mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span
                      className={`text-[13px] font-medium ${c.participated ? "" : "text-muted-foreground"}`}
                    >
                      {c.publisher}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[12px] leading-relaxed">
                      {c.note}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {report.leads.length > 0 ? (
            <div className="divide-border divide-y">
              {report.leads.map((lead) => {
                const local = queued[lead.url];
                // **Read is not learned.** Evidence is stored before the
                // curator decides, so a page read in a previous session and
                // never acted on used to render as finished work with
                // nothing to click — a decision nobody made, shown as one
                // that was. Only the `describes` edge means learned.
                const isLearned = Boolean(lead.learnedEntityId);
                const isQueued =
                  local === "done" ||
                  lead.state === "queued" ||
                  (lead.state === "read" && !isLearned);
                const readNotLearned = lead.state === "read" && !isLearned;
                return (
                  <div key={lead.url} className="px-5 py-4">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-semibold">
                        {lead.publisher}
                      </span>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase">
                        {lead.basis}
                      </span>
                    </p>
                    <a
                      href={lead.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground mt-0.5 block truncate text-[12px] underline underline-offset-2"
                    >
                      {lead.url}
                    </a>
                    <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
                      {lead.reason}
                    </p>
                    <p className="mt-2.5 text-[12px] font-medium">
                      Reading it could establish
                    </p>
                    <ul className="text-muted-foreground mt-1 space-y-0.5">
                      {lead.couldEstablish.map((c) => (
                        <li
                          key={c}
                          className="text-[12px] leading-relaxed before:mr-1.5 before:content-['—']"
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      {isLearned ? (
                        <div>
                          <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-500">
                            <Check className="h-3.5 w-3.5" />
                            Atlas has read this and learned from it
                          </p>
                          <Link
                            href={`/admin/entities/${lead.learnedEntityId}`}
                            className="text-muted-foreground hover:text-foreground mt-1 block text-[12px] underline underline-offset-2"
                          >
                            Open what it created
                          </Link>
                        </div>
                      ) : isQueued ? (
                        <ReadPanel
                          state={reads[lead.url]}
                          alreadyRead={readNotLearned}
                          regionName={regionName}
                          candidateSourceId={
                            reads[lead.url]?.id ?? lead.candidateSourceId
                          }
                          onRead={(id) => void readNow(lead, id)}
                          onLearn={(id, name, ack) =>
                            void learn(lead, id, name, ack)
                          }
                          onPlace={(entityId, entityName) =>
                            void place(lead, entityId, entityName)
                          }
                        />
                      ) : (
                        <button
                          onClick={() => void queue(lead)}
                          disabled={local === "queuing"}
                          className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
                        >
                          {local === "queuing" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Queue this source for reading
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-6">
              <p className="text-muted-foreground flex gap-2 text-[13px] leading-relaxed">
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                No source Atlas can construct. That is a statement about what is
                publicly published in a form Atlas can reach — not evidence that{" "}
                {report.name} does not exist. Give Atlas a URL and it will read
                it.
              </p>
            </div>
          )}

          <div className="border-border bg-muted/20 border-t px-5 py-3">
            <p className="text-muted-foreground text-[12px] leading-relaxed">
              Queuing writes nothing about {report.name}. Atlas reads the page,
              verifies it identifies the place, and only then can an entity
              exist — after which you confirm whether it belongs to {regionName}
              .
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * **The area Atlas was allowed to search — shown before its results.**
 *
 * ADR 032. A Discovery Scope proves nothing; it only says where Atlas
 * looked. That makes it the single most important thing to read *before* a
 * result, because "nothing found" means nothing without it.
 *
 * When there is no scope, the refusal and its remedy are shown rather than
 * an empty search — Atlas does not have a fallback radius and the interface
 * should not imply one exists.
 */
function ScopePanel({
  scope,
  refusal,
  regionName,
}: {
  scope?: DiscoveryScope;
  refusal?: { reason: string; remedy: string };
  regionName: string;
}) {
  if (!scope) {
    if (!refusal) return null;
    return (
      <div className="border-border border-b px-5 py-4">
        <p className="flex items-center gap-1.5 text-[13px] font-medium">
          <CircleSlash className="text-muted-foreground h-3.5 w-3.5" />
          No Discovery Scope for {regionName}
        </p>
        <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
          {refusal.reason} Location-based sources are searched by area, and
          Atlas will not pick a radius to fill the gap.
        </p>
        <p className="mt-1 text-[12px] leading-relaxed">{refusal.remedy}</p>
      </div>
    );
  }

  const { south, west, north, east } = scope.bbox;
  return (
    <div className="border-border border-b px-5 py-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium">
        <MapPin className="h-3.5 w-3.5" />
        Where Atlas looked
      </p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
        {scope.label}
      </p>
      <p className="text-muted-foreground/80 mt-1.5 font-mono text-[11px]">
        {south}, {west} → {north}, {east}
        <span className="ml-2 tracking-wide uppercase">{scope.source}</span>
      </p>
      {scope.derivedFrom && scope.derivedFrom.length > 0 && (
        <details className="mt-1.5">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[12px] underline-offset-2 hover:underline">
            The {scope.derivedFrom.length} entities that define this area
          </summary>
          <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
            {scope.derivedFrom.map((d) => d.name).join(" · ")}
          </p>
        </details>
      )}
    </div>
  );
}

function StrategyIcon({ status }: { status: StrategyStatus }) {
  const shared = "mt-0.5 h-3.5 w-3.5 shrink-0";
  if (status === "succeeded")
    return (
      <Check className={`${shared} text-emerald-600 dark:text-emerald-500`} />
    );
  if (status === "multiple-candidates")
    return (
      <HelpCircle className={`${shared} text-amber-600 dark:text-amber-500`} />
    );
  if (status === "failed") return <X className={`${shared} text-amber-600`} />;
  return <CircleSlash className={`${shared} text-muted-foreground/40`} />;
}

/**
 * **Candidates, deliberately not a shortlist.**
 *
 * Every feature OpenStreetMap returned inside the scope, in the order OSM
 * returned them. Nothing is ranked and nothing is marked "best": the
 * nearest one is nearest to the entities a curator already placed, which
 * would be Atlas's own bias presented as relevance.
 *
 * Each carries a real identifier, so each passes the identity gate — and
 * that is precisely why the ambiguity is real. **The gate answers "is this
 * a thing?", not "is this the thing?"**
 */
function OSMCandidates({
  candidates,
  query,
}: {
  candidates: OSMCandidate[];
  query?: string;
}) {
  return (
    <div className="border-border border-b px-5 py-4">
      <p className="text-[13px] font-medium">
        OpenStreetMap found {candidates.length}{" "}
        {candidates.length === 1 ? "feature" : "features"} in that area
      </p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
        Evidence to judge, not entities. Atlas has not chosen between these and
        will not — each is independently identified, and being closest to what
        Atlas already knows is not evidence of being right.
      </p>

      <ul className="mt-3 space-y-3">
        {candidates.map((c) => (
          <li
            key={c.externalId}
            className="border-border rounded-lg border p-3"
          >
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-semibold">{c.name}</span>
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]">
                {c.externalId}
              </span>
            </p>
            {c.coordinates && (
              <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                {c.coordinates[1]}, {c.coordinates[0]}
              </p>
            )}
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {c.identity.signals.map((s) => (
                <span key={s} className="text-[12px]">
                  ✓ {s}
                </span>
              ))}
            </p>
            {Object.keys(c.tags).length > 0 && (
              <details className="mt-1.5">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[12px] underline-offset-2 hover:underline">
                  What OpenStreetMap says about it
                </summary>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {Object.entries(c.tags).map(([k, v]) => (
                    <Fragment key={k}>
                      <dt className="text-muted-foreground font-mono text-[11px]">
                        {k}
                      </dt>
                      <dd className="text-[11px]">{v}</dd>
                    </Fragment>
                  ))}
                </dl>
              </details>
            )}
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground mt-1.5 inline-block text-[12px] underline underline-offset-2"
            >
              View on OpenStreetMap
            </a>
          </li>
        ))}
      </ul>

      {/* Why there is no button here. Queueing an OSM element page would
          create work nothing can currently do — the existing OSM loader
          reads the Overpass API, not openstreetmap.org's rendered page.
          That failure already happened once, with discovery sources that sat
          in the queue forever. */}
      <p className="text-muted-foreground/80 mt-3 text-[12px] leading-relaxed">
        Atlas is not offering to queue these. Reading an OpenStreetMap feature
        is a different operation from reading a web page, and creating an entity
        from one is a separate, deliberate step that does not exist yet.
      </p>

      {query && (
        <details className="mt-2">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[12px] underline-offset-2 hover:underline">
            The exact query Atlas sent
          </summary>
          <pre className="text-muted-foreground mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed">
            {query}
          </pre>
        </details>
      )}
    </div>
  );
}

interface ReadResult {
  outcome:
    | "identified"
    | "unresolved"
    | "not-targetless"
    | "fetch-failed"
    | "extraction-failed";
  summary: string;
  claim?: { name: string };
  assessment?: { hasIdentity: boolean; signals: string[]; reason?: string };
  sourceRecordId?: string;
}

/**
 * **What happened when Atlas tried to learn it.**
 *
 * Every outcome except `learned` is a refusal, and each refusal names what
 * would resolve it. A refusal with no next step is where a curator gets
 * stuck, and the failure they blame is the product rather than the page.
 *
 * The two writes are shown separately because they are separate claims:
 * *this exists* and *this belongs to {region}*. A single "Add to Okanagan"
 * button would collapse them and quietly make membership a side effect of
 * creation — the inference ADR 025 exists to forbid.
 */
function LearnedPanel({
  learned,
  regionName,
  placing,
  placed,
  onPlace,
  onRetryAsDistinct,
}: {
  learned: LearnResult;
  regionName: string;
  placing?: boolean;
  placed?: boolean;
  onPlace: (entityId: string, entityName: string) => void;
  onRetryAsDistinct?: () => void;
}) {
  const created = learned.outcome === "learned";

  return (
    <div
      className={`rounded-lg border px-3.5 py-3 ${
        created
          ? "border-emerald-600/40 bg-emerald-500/[0.05]"
          : "border-amber-600/40 bg-amber-500/[0.05]"
      }`}
    >
      <p className="flex items-center gap-1.5 text-[13px] font-medium">
        {created ? (
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
        ) : (
          <CircleSlash className="text-muted-foreground h-3.5 w-3.5" />
        )}
        {created ? "Atlas has learned it" : "Not created"}
      </p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
        {learned.summary}
      </p>

      {/* Every write, named. A write a curator cannot see is a hidden one. */}
      {learned.written.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {learned.written.map((w) => (
            <li
              key={w}
              className="text-[12px] leading-relaxed before:mr-1.5 before:content-['✓']"
            >
              {w}
            </li>
          ))}
        </ul>
      )}

      {learned.matchedEntityId && (
        <Link
          href={`/admin/entities/${learned.matchedEntityId}`}
          className="border-border hover:bg-muted mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px]"
        >
          {learned.matchedEntityName}
        </Link>
      )}

      {onRetryAsDistinct && (
        <button
          onClick={onRetryAsDistinct}
          className="border-border hover:bg-muted mt-2 ml-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium"
        >
          This is a different place — create it anyway
        </button>
      )}

      {/* The second statement. Deliberately not automatic. */}
      {created && learned.entityId && (
        <div className="border-border/60 mt-3 border-t pt-3">
          {placed ? (
            <p className="flex items-center gap-1.5 text-[13px] font-medium">
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
              Placed in {regionName} — coverage now counts it
            </p>
          ) : (
            <>
              <p className="text-[13px] font-medium">
                It belongs to no region yet
              </p>
              <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
                {learned.nextStep}
              </p>
              <button
                onClick={() =>
                  onPlace(learned.entityId!, learned.entityName ?? "it")
                }
                disabled={placing}
                className="border-border bg-background hover:bg-muted mt-2 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
              >
                {placing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Place it in {regionName}
              </button>
            </>
          )}
          {learned.entityId && (
            <Link
              href={`/admin/entities/${learned.entityId}`}
              className="text-muted-foreground hover:text-foreground mt-2 block text-[12px] underline underline-offset-2"
            >
              Open {learned.entityName}
            </Link>
          )}
        </div>
      )}

      {!created && learned.nextStep && (
        <p className="mt-2 text-[12px] leading-relaxed">{learned.nextStep}</p>
      )}
    </div>
  );
}

interface LearnResult {
  outcome:
    | "learned"
    | "already-known"
    | "possible-duplicate"
    | "subject-changed"
    | "no-identity"
    | "not-read"
    | "extraction-failed";
  entityId?: string;
  entityName?: string;
  placeType?: string;
  matchedEntityId?: string;
  matchedEntityName?: string;
  written: string[];
  summary: string;
  nextStep?: string;
}

interface ReadState {
  id: string;
  busy?: boolean;
  result?: ReadResult;
  learning?: boolean;
  learned?: LearnResult;
  placing?: boolean;
  placed?: boolean;
}

/**
 * **Queued is a waiting state, and reading it is a real action.**
 *
 * Nothing drains this queue on its own — the runner only reads pages whose
 * target entity is already known, and a discovered source is by definition
 * about something Atlas does not hold. So the panel offers the read rather
 * than implying one is scheduled.
 *
 * The result never claims more than the identity gate allowed. *Identified*
 * means Atlas can tell which thing this is and **still created nothing**;
 * *unresolved* means it read the page and the page was not enough.
 */
function ReadPanel({
  state,
  alreadyRead,
  regionName,
  candidateSourceId,
  onRead,
  onLearn,
  onPlace,
}: {
  state?: ReadState;
  /** Atlas already stored evidence for this page and created nothing from it. */
  alreadyRead?: boolean;
  regionName: string;
  candidateSourceId?: string;
  onRead: (id: string) => void;
  onLearn: (
    id: string,
    confirmedName: string,
    acknowledgeDuplicate?: boolean,
  ) => void;
  onPlace: (entityId: string, entityName: string) => void;
}) {
  const result = state?.result;

  // Once Atlas has learned it, the read result is history — the panel shows
  // what exists now and what is still undone.
  if (state?.learned) {
    return (
      <LearnedPanel
        learned={state.learned}
        regionName={regionName}
        placing={state.placing}
        placed={state.placed}
        onPlace={onPlace}
        onRetryAsDistinct={
          state.learned.outcome === "possible-duplicate" && candidateSourceId
            ? () => onLearn(candidateSourceId, result?.claim?.name ?? "", true)
            : undefined
        }
      />
    );
  }

  if (result) {
    const good = result.outcome === "identified";
    return (
      <div
        className={`rounded-lg border px-3.5 py-2.5 ${
          good
            ? "border-emerald-600/40 bg-emerald-500/[0.05]"
            : "border-border bg-muted/30"
        }`}
      >
        <p className="flex items-center gap-1.5 text-[13px] font-medium">
          {good ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
          ) : (
            <CircleSlash className="text-muted-foreground h-3.5 w-3.5" />
          )}
          {good ? "Source read · identity found" : "Source read · unresolved"}
        </p>
        {result.assessment && result.assessment.signals.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {result.assessment.signals.map((s) => (
              <li key={s} className="text-[12px]">
                ✓ {s}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-1.5 text-[12px] leading-relaxed">
          {result.summary}
        </p>
        {/* The reasoning, one click away rather than in the way. */}
        {result.assessment?.reason && !good && (
          <details className="mt-1.5">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[12px] underline-offset-2 hover:underline">
              Why?
            </summary>
            <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
              {result.assessment.reason}
            </p>
          </details>
        )}

        {/* The decision. Atlas has said what it believes and stopped —
            this is the first click in the whole journey that writes. */}
        {good && result.claim?.name && candidateSourceId && (
          <div className="border-border mt-3 border-t pt-3">
            <p className="text-[13px] font-medium">
              Atlas has not learned this yet
            </p>
            <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
              It read the page and can tell which place it describes. Nothing
              exists in Atlas until you say so — and creating it says only that
              it exists, not that it belongs to {regionName}.
            </p>
            <button
              onClick={() => onLearn(candidateSourceId, result.claim!.name)}
              disabled={state?.learning}
              className="bg-foreground text-background mt-2.5 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {state?.learning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {state?.learning
                ? "Reading it properly…"
                : `Create ${result.claim.name}`}
            </button>
            {state?.learning && (
              <p className="text-muted-foreground/80 mt-1.5 text-[12px] leading-relaxed">
                Re-reading the stored page in full — the identity check was
                deliberately shallow, and this is the read worth paying for.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-500/[0.05] px-3.5 py-2.5">
      <p className="text-[13px] font-medium">
        {alreadyRead
          ? "Read, but nothing was created"
          : "Queued — nothing has read it"}
      </p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
        {alreadyRead
          ? "Atlas fetched this page and stored the evidence, and no entity came of it — the decision is still yours. Reading it again brings back what it found."
          : "Atlas will not pick this up on its own: the queue runner only reads pages whose subject it already holds."}
      </p>
      {candidateSourceId ? (
        <button
          onClick={() => onRead(candidateSourceId)}
          disabled={state?.busy}
          className="border-border bg-background hover:bg-muted mt-2.5 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
        >
          {state?.busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {state?.busy
            ? "Reading…"
            : alreadyRead
              ? "Review it again"
              : "Read now"}
        </button>
      ) : (
        <p className="text-muted-foreground/70 mt-2 text-[12px]">
          Investigate again to get a read action for this source.
        </p>
      )}
    </div>
  );
}
