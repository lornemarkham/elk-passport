import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ExplorerNotConfiguredError,
  ExplorerUnreachableError,
  searchAtlas,
  type ExplorerSearchHit,
} from "@/lib/data/explorer-dossier-repo";
import { KindBadge } from "@/components/explorer/primitives";

export const metadata: Metadata = {
  title: "Atlas Explorer",
  robots: { index: false, follow: false },
};

const KINDS = ["Place", "Organization", "Activity", "Event", "Experience"];

const MATCH_NOTE: Record<ExplorerSearchHit["matchedOn"], string> = {
  name: "",
  alias: "matched an alias",
  id: "matched the id",
  description: "matched the description",
};

function Hit({ hit }: { hit: ExplorerSearchHit }) {
  return (
    <li>
      <Link
        href={`/explorer/${hit.id}`}
        className="hover:bg-muted/50 border-border/40 flex gap-3 border-b px-2 py-2.5"
      >
        <div className="bg-muted h-11 w-11 shrink-0 overflow-hidden rounded">
          {hit.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- external Atlas-recorded URL */
            <img
              src={hit.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={hit.kind} />
            <span className="truncate text-sm font-medium">{hit.name}</span>
            {hit.subtype && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {hit.subtype}
              </span>
            )}
            {hit.isRegion && (
              <span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">
                region
              </span>
            )}
            {hit.archived && (
              <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-800 uppercase dark:text-orange-300">
                archived
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
            {hit.description || "no description"}
          </p>
          <p className="text-muted-foreground/70 mt-0.5 flex gap-3 font-mono text-[10px]">
            <span>{hit.mediaCount} media</span>
            {MATCH_NOTE[hit.matchedOn] && (
              <span>{MATCH_NOTE[hit.matchedOn]}</span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}

async function Results({ query, kind }: { query?: string; kind?: string }) {
  let result;
  try {
    result = await searchAtlas({ query, kind, limit: 200 });
  } catch (error) {
    const configured = !(error instanceof ExplorerNotConfiguredError);
    return (
      <div className="border-border/70 rounded-lg border p-6">
        <h2 className="text-sm font-semibold">
          {configured ? "Atlas is unreachable" : "Explorer is not configured"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {(error as Error).message}
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          {error instanceof ExplorerUnreachableError
            ? "Start Atlas, or point ATLAS_API_URL at wherever it is listening."
            : "Set ADMIN_TOKEN in the app's environment to the value Atlas expects."}
        </p>
      </div>
    );
  }

  const total = Object.values(result.countsByKind).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span>
          <span className="text-foreground font-mono">{result.total}</span>{" "}
          {result.total === 1 ? "match" : "matches"}
          {result.hits.length < result.total &&
            ` · showing the first ${result.hits.length}`}
        </span>
        {KINDS.filter((k) => result.countsByKind[k]).map((k) => (
          <span key={k} className="font-mono">
            {k} {result.countsByKind[k]}
          </span>
        ))}
        {total === 0 && <span>nothing in the corpus matches</span>}
      </div>

      <nav className="mb-3 flex flex-wrap gap-1.5">
        <KindLink label="All kinds" query={query} active={!kind} />
        {KINDS.map((k) => (
          <KindLink
            key={k}
            label={k}
            kind={k}
            query={query}
            active={kind === k}
          />
        ))}
      </nav>

      {result.hits.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No entity, alias or id matches that.
        </p>
      ) : (
        <ul className="border-border/70 rounded-lg border px-2 py-1">
          {result.hits.map((hit) => (
            <Hit key={hit.id} hit={hit} />
          ))}
        </ul>
      )}
    </>
  );
}

function KindLink({
  label,
  kind,
  query,
  active,
}: {
  label: string;
  kind?: string;
  query?: string;
  active: boolean;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (kind) params.set("kind", kind);
  const suffix = params.toString();
  return (
    <Link
      href={`/explorer${suffix ? `?${suffix}` : ""}`}
      className={`rounded-full border px-2.5 py-1 text-xs ${
        active
          ? "border-foreground/30 bg-foreground/[0.06] font-medium"
          : "border-border/70 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Search across the **whole** corpus.
 *
 * Not Discovery's search. There is no region scope, no feed policy, no
 * candidate suppression and no readiness gate between the query and the
 * result — an archived Organization in no region with no description is
 * findable here, and that is the requirement rather than an oversight.
 * Discovery's search reaches 316 of 2,523 entities by design; this reaches
 * all of them.
 */
export default async function ExplorerSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const { q, kind } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {q ? `“${q}”` : "Everything Atlas holds"}
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 max-w-2xl text-sm">
        Every entity of every kind, archived included, with no Passport
        filtering of any sort. Open one to see what Atlas actually knows about
        it, where that came from, and what it is connected to.
      </p>

      <Suspense
        key={`${q ?? ""}:${kind ?? ""}`}
        fallback={
          <p className="text-muted-foreground py-8 text-center text-sm">
            Reading the corpus…
          </p>
        }
      >
        <Results query={q} kind={kind} />
      </Suspense>
    </>
  );
}
