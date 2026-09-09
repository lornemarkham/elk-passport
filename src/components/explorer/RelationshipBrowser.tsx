import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import type {
  DossierEdge,
  DossierEdgeGroup,
} from "@/lib/data/explorer-dossier-repo";
import { Empty, EntityLink, Flag, Id, Panel } from "./primitives";

/**
 * **Every edge Atlas stores, from both ends, grouped by its real type.**
 *
 * ## What this refuses to do
 *
 * It does not deduplicate, does not drop `describes`, does not hide a
 * self-referential edge, and does not collapse a reciprocal pair into one
 * row. Passport's place page is right to do all four — a traveller wants
 * destinations, not graph rows — and this is the tool that exists because
 * doing it there made the underlying facts invisible. A duplicate here is
 * information.
 *
 * ## Why direction is a heading rather than an arrow in a list
 *
 * `contains` means opposite things depending on which end you are standing
 * on: the Okanagan *contains* Kalamalka Lake Park, and Kalamalka Lake Park
 * *contains* nothing. Mixing both into one list of arrows makes a reader
 * decode each row. Splitting them means the reader decodes the heading once.
 *
 * The type names are Atlas's own, verbatim — `possible-duplicate-of`, not
 * "possible duplicate". Renaming them here would mean this page and the
 * database disagree about what a thing is called, in the one tool where
 * that has to hold.
 */

function EdgeRow({ edge }: { edge: DossierEdge }) {
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-1.5">
      {edge.other ? (
        <EntityLink entity={edge.other} />
      ) : edge.otherSourceRecord ? (
        <Link
          href={`/explorer/sources/${edge.otherSourceRecord.id}`}
          className="hover:bg-muted/60 group flex min-w-0 items-center gap-2 rounded px-1.5 py-1"
        >
          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Source
          </span>
          <span className="group-hover:text-foreground truncate font-mono text-xs underline-offset-2 group-hover:underline">
            {edge.otherSourceRecord.source}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {edge.otherSourceRecord.sourceType}
          </span>
        </Link>
      ) : (
        <span className="flex items-center gap-2 px-1.5 py-1">
          <Flag>dangling</Flag>
          <Id value={edge.otherId} />
        </span>
      )}

      {edge.flags.selfReferential && <Flag>points at itself</Flag>}
      {edge.flags.reciprocal && <Flag>reciprocal</Flag>}
      {edge.flags.repeated && <Flag>repeated edge</Flag>}
    </li>
  );
}

function Direction({
  icon,
  label,
  edges,
}: {
  icon: React.ReactNode;
  label: string;
  edges: readonly DossierEdge[];
}) {
  if (edges.length === 0) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[11px] tracking-wide uppercase">
        {icon}
        {label}
        <span className="font-mono">{edges.length}</span>
      </p>
      <ul className="flex flex-col">
        {edges.map((edge) => (
          <EdgeRow key={edge.id} edge={edge} />
        ))}
      </ul>
    </div>
  );
}

export function RelationshipBrowser({
  name,
  groups,
  counts,
}: {
  name: string;
  groups: DossierEdgeGroup[];
  counts: {
    relationships: number;
    selfReferential: number;
    reciprocal: number;
    repeated: number;
    danglingEdges: number;
    relationshipTypes: number;
  };
}) {
  const oddities = [
    counts.selfReferential > 0 && `${counts.selfReferential} self-referential`,
    counts.reciprocal > 0 && `${counts.reciprocal} reciprocal`,
    counts.repeated > 0 && `${counts.repeated} repeated`,
    counts.danglingEdges > 0 && `${counts.danglingEdges} dangling`,
  ].filter(Boolean) as string[];

  return (
    <Panel
      title="Relationships"
      count={counts.relationships}
      subtitle={
        counts.relationshipTypes === 0
          ? undefined
          : `${counts.relationshipTypes} ${counts.relationshipTypes === 1 ? "type" : "types"}${
              oddities.length > 0 ? ` · ${oddities.join(" · ")}` : ""
            }`
      }
    >
      {groups.length === 0 ? (
        <Empty>
          Atlas stores no relationship with this entity at either end — not even
          a <code className="font-mono">describes</code> edge from a source,
          which means nothing has been read about it.
        </Empty>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.type}>
              <h3 className="mb-1.5 flex items-baseline gap-2">
                <code className="text-foreground font-mono text-sm font-semibold">
                  {group.type}
                </code>
                <span className="text-muted-foreground font-mono text-xs">
                  {group.total}
                </span>
              </h3>
              <div className="border-border/60 flex flex-col gap-3 border-l pl-3">
                <Direction
                  icon={<ArrowRight className="h-3 w-3" />}
                  label={`${name} → …`}
                  edges={group.outgoing}
                />
                <Direction
                  icon={<ArrowLeft className="h-3 w-3" />}
                  label={`… → ${name}`}
                  edges={group.incoming}
                />
                <Direction
                  icon={<RotateCcw className="h-3 w-3" />}
                  label="points at itself"
                  edges={group.selfReferential}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
