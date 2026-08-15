import Link from "next/link";
import { ExternalLink, CornerDownRight, Clock } from "lucide-react";
import type { RelationshipView } from "@/lib/knowledge/entityKnowledge";
import type { WorkspaceCandidateSource } from "@/lib/knowledge/workspaceData";
import { formatDate } from "@/lib/knowledge/formatDate";

/**
 * What this entity **contains** — the children discovered from its own
 * directory pages — and where Atlas knows it could learn more about each.
 *
 * Separated from `RelationshipPanel` (which shows every connection
 * generically) because containment answers a different question. A curator
 * looking at Big White wants to see *"these six real businesses are on this
 * mountain, and Atlas knows where to read about each one"* — not a list of
 * typed edges among which six happen to be `contains`.
 *
 * The three columns are the three things the directory-expansion
 * experiment has to prove, made visible without opening a database:
 * the child exists, the relationship points the right way, and the next
 * learning step is queued rather than taken.
 */
export function ChildrenPanel({
  relationships,
  entityName,
  candidateSources,
}: {
  relationships: readonly RelationshipView[];
  entityName: string;
  candidateSources: readonly WorkspaceCandidateSource[];
}) {
  // Only outgoing containment: things this entity contains, not things
  // that contain it. An incoming `contains` is shown by RelationshipPanel,
  // where its direction is legible as a sentence.
  const children = relationships.filter(
    (r) => r.type === "contains" && r.direction === "outgoing",
  );

  if (children.length === 0) return null;

  const queuedByEntity = new Map(
    candidateSources.map((c) => [c.aboutEntityId, c]),
  );

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          What {entityName} contains
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Real child entities discovered from this entity&apos;s own pages.
          Direction comes from the discovery path — the page&apos;s owner is the
          parent — never from a mention in the text.
        </p>
      </div>

      <div className="border-border divide-border divide-y rounded-xl border">
        {children.map((child) => {
          const queued = queuedByEntity.get(child.otherId);
          return (
            <div
              key={child.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
            >
              <CornerDownRight className="text-muted-foreground h-4 w-4 shrink-0" />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/entities/${child.otherId}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {child.otherName}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {child.otherKind}
                </p>
              </div>

              {queued ? (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <a
                    href={queued.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs break-all"
                  >
                    {queued.url.replace(/^https?:\/\/(www\.)?/, "")}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <span
                    className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]"
                    title={`${queued.reason} — discovered ${formatDate(queued.discoveredAt)}. Not fetched.`}
                  >
                    <Clock className="h-3 w-3" />
                    queued to learn · {queued.status}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground flex-1 text-xs">
                  no detail page discovered yet
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Queued pages have <strong>not</strong> been fetched. Atlas records where
        it could learn more; expanding is a separate, deliberate act.
      </p>
    </section>
  );
}
