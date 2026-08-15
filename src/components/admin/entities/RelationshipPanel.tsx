import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import type { RelationshipView } from "@/lib/knowledge/entityKnowledge";

/**
 * Relationships, rendered so direction is impossible to miss.
 *
 * The motivating defect: the old Content Explorer showed Big White a
 * suggested parent of "Telus Park" — meaning *Telus Park contains Big
 * White Ski Resort* — with Confirm / Reject buttons and no indication of
 * which way the claim pointed. Telus Park is a terrain park inside Big
 * White, so the claim is exactly inverted, and the interface gave a
 * curator no way to see that.
 *
 * The fix is not a redesign (that's a later milestone): it's rendering
 * every relationship as a full subject-verb-object sentence in real-world
 * order, so an inverted claim reads as the nonsense it is. The direction
 * chip states plainly whether this entity is the subject or the object.
 */
export function RelationshipPanel({
  relationships,
  entityName,
}: {
  relationships: readonly RelationshipView[];
  entityName: string;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          How this connects
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Each connection is written as a sentence in real-world order. If a
          sentence reads backwards, the relationship is stored backwards.
        </p>
      </div>

      {relationships.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm">
          No relationships recorded beyond source evidence.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {relationships.map((r) => (
            <div
              key={r.id}
              className="border-border flex flex-wrap items-center gap-3 rounded-xl border p-4"
            >
              <span
                className="text-muted-foreground shrink-0"
                title={
                  r.direction === "outgoing"
                    ? `${entityName} is the subject of this relationship.`
                    : `${entityName} is the object — something else claims this about it.`
                }
              >
                {r.direction === "outgoing" ? (
                  <ArrowRight className="h-4 w-4" />
                ) : (
                  <ArrowLeft className="h-4 w-4" />
                )}
              </span>

              <p className="min-w-0 flex-1 text-sm">
                {r.statement.split(` ${r.type} `).map((part, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span className="bg-muted mx-1.5 rounded px-1.5 py-0.5 font-medium">
                        {r.type}
                      </span>
                    )}
                    {part}
                  </span>
                ))}
              </p>

              <span className="text-muted-foreground shrink-0 text-xs">
                {r.thisEntityIsTarget
                  ? "this entity is the object"
                  : "this entity is the subject"}
              </span>

              <Link
                href={`/admin/entities/${r.otherId}`}
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline underline-offset-4"
              >
                Open {r.otherKind}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
