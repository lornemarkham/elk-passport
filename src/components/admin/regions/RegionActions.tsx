import Link from "next/link";
import {
  ArrowRight,
  FilePlus2,
  Link2,
  MessageSquareQuote,
  Plus,
  Tags,
  Waves,
} from "lucide-react";

/**
 * **What *you* can do** — as distinct from what Atlas can do.
 *
 * ## Why the split matters
 *
 * The workspace has two kinds of verb and a curator needs to tell them
 * apart instantly. **Atlas's verbs are operations** — bounded, automatic,
 * reversible, watched. **The curator's verbs are decisions** — placing an
 * entity, accepting a finding, giving Atlas a source it could not have
 * guessed. Mixing them into one list of buttons hides the most important
 * fact about Atlas: it proposes, and a person decides.
 *
 * ## Unbuilt actions still appear
 *
 * Several of these are not built. They render anyway, visibly disabled,
 * with a note naming what exists today and what is missing.
 *
 * A button that pretended would be a lie. But omitting it entirely hides
 * the shape of the product — a curator cannot tell *"Atlas will never do
 * this"* from *"Atlas cannot do this yet"*, and the second is an
 * invitation while the first is a dead end. **Honesty about a gap is not
 * the same as silence about it.**
 *
 * The ones that are real are real: review surfaces exist and are linked.
 */

interface Action {
  readonly label: string;
  readonly detail: string;
  readonly icon: React.ReactNode;
  readonly href?: string;
  /** Present when the action is not built. Says what exists and what does not. */
  readonly soon?: string;
  readonly badge?: number;
}

export function RegionActions({
  regionName,
  waitingCount,
  untypedCount,
  isolatedCount,
}: {
  regionName: string;
  waitingCount: number;
  untypedCount: number;
  isolatedCount: number;
}) {
  const actions: Action[] = [
    {
      label: "Review research",
      detail:
        waitingCount > 0
          ? "Atlas found things and stopped before writing them. It proposes; you decide."
          : "Nothing is waiting on a decision right now.",
      icon: <MessageSquareQuote className="h-4 w-4" />,
      href: "/admin/review",
      badge: waitingCount || undefined,
    },
    {
      label: "Watch what Atlas did",
      detail:
        "Every fetch, extraction and merge, in the order it happened. Technical detail, kept out of your way until you want it.",
      icon: <Waves className="h-4 w-4" />,
      href: "/admin/runs",
    },
    {
      label: "Fix types",
      detail: `${untypedCount} ${untypedCount === 1 ? "entity has" : "entities have"} no type. Setting one by hand needs an edit surface on the entity page.`,
      icon: <Tags className="h-4 w-4" />,
      soon: "Atlas can already research what a place is, one entity at a time, from that entity's page. Editing a type directly, or fixing several at once, is not built.",
      badge: untypedCount || undefined,
    },
    {
      label: "Review relationships",
      detail: `Atlas proposes connections it finds while reading. ${isolatedCount > 0 ? `${isolatedCount} here are connected to nothing.` : "Nothing here is unconnected."}`,
      icon: <Link2 className="h-4 w-4" />,
      soon: "`RelationshipCandidate` exists and Atlas writes proposals into it. A region-scoped surface for confirming them is not built.",
      badge: isolatedCount || undefined,
    },
    {
      label: "Add an entity",
      detail: `Place something in ${regionName} yourself, when Atlas has no way to discover it.`,
      icon: <Plus className="h-4 w-4" />,
      soon:
        '`npm run define-region -- "' +
        regionName +
        '" --assign "<entity>"` does this from a terminal today. Creating an entity from the browser needs an identity gate — an entity with only a name is a tag, not a thing.',
    },
    {
      label: "Add a source",
      detail:
        "Give Atlas a page to read. It will never guess an organisation's website — a curator has to supply it.",
      icon: <FilePlus2 className="h-4 w-4" />,
      soon: "Atlas queues sources it discovers while reading. Seeding one by hand from the browser is not built; `queue-benchmark` is the closest thing today.",
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-semibold tracking-wide uppercase">
          What you can do
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-[13px]">
          Decisions only a person can make. Atlas proposes and runs the work;
          these are the places it needs you.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => (
          <ActionCard key={a.label} action={a} />
        ))}
      </div>
    </section>
  );
}

function ActionCard({ action }: { action: Action }) {
  const inner = (
    <>
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground">{action.icon}</span>
        <span className="text-sm font-medium">{action.label}</span>
        {action.badge !== undefined && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 tabular-nums dark:text-amber-400">
            {action.badge}
          </span>
        )}
        {action.soon ? (
          <span className="text-muted-foreground/70 ml-auto rounded border border-dashed px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
            soon
          </span>
        ) : (
          <ArrowRight className="text-muted-foreground/0 group-hover:text-muted-foreground ml-auto h-4 w-4 transition-colors" />
        )}
      </span>
      <span className="text-muted-foreground mt-1.5 block text-[13px] leading-relaxed">
        {action.detail}
      </span>
    </>
  );

  const classes =
    "flex flex-col rounded-lg border px-4 py-3.5 text-left transition-colors";

  if (action.soon) {
    return (
      <div
        title={action.soon}
        aria-disabled="true"
        className={`${classes} border-border border-dashed opacity-70`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={action.href!}
      className={`${classes} border-border hover:border-foreground/30 hover:bg-muted/40 group`}
    >
      {inner}
    </Link>
  );
}
