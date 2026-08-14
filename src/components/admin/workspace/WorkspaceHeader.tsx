import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { EntityKnowledge } from "@/lib/knowledge/entityKnowledge";
import { formatDate } from "@/lib/knowledge/formatDate";

/**
 * The persistent entity header. Establishes context once, at the top, so
 * every mode below it can assume the reader knows what they're looking at.
 *
 * **Page Readiness is deliberately not a percentage.** The design proposal
 * argued for it as a real second score, but nothing computes it honestly
 * yet — inventing a number here to fill the slot is exactly the failure
 * the Quality Standard's "never invent content" rule exists to prevent,
 * and it would be worse in admin tooling than on a traveler page, because
 * a curator would act on it. It's shown as an explicit "not yet measured"
 * state instead, with the one thing that *is* honestly derivable — how
 * much known knowledge the page actually surfaces — beside it.
 */
export function WorkspaceHeader({
  knowledge,
  score,
  sourceCategoriesChecked,
  sourceCategoriesTotal,
  lastRetrievedAt,
}: {
  knowledge: EntityKnowledge;
  score: number | null;
  sourceCategoriesChecked: number;
  sourceCategoriesTotal: number;
  lastRetrievedAt: string | null;
}) {
  const { counts } = knowledge;
  const surfaced =
    counts.total > 0 ? Math.round((counts.used / counts.total) * 100) : null;

  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/admin/workspace"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          All entities
        </Link>
        <span className="text-muted-foreground/40">·</span>
        <Link
          href="/admin/content"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Curator Workbench
        </Link>
        {knowledge.kind === "Place" && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <Link
              href={`/places/${knowledge.entityId}`}
              target="_blank"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
            >
              View traveler page
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            {knowledge.name}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {knowledge.kind}
            {knowledge.subtype ? ` · ${knowledge.subtype}` : ""}
            {lastRetrievedAt
              ? ` · last source retrieved ${formatDate(lastRetrievedAt)}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          <Stat
            label="Knowledge Score"
            value={score !== null ? `${score}%` : "—"}
            hint="Atlas's own completeness measure."
          />
          <Stat
            label="Surfaced to travelers"
            value={surfaced !== null ? `${surfaced}%` : "—"}
            hint={`${counts.used} of ${counts.total} pieces of knowledge appear on the traveler page.`}
          />
          <Stat
            label="Source categories"
            value={`${sourceCategoriesChecked}/${sourceCategoriesTotal}`}
            hint="Trusted source categories ever checked for this entity."
          />
          <Stat
            label="Page readiness"
            value="Not measured"
            muted
            hint="No honest measure exists yet. Deliberately not a number — see WorkspaceHeader's own comment."
          />
          {counts.unsupported > 0 && (
            <Stat
              label="Unverified"
              value={String(counts.unsupported)}
              warn
              hint="Values that could not be located in any attached source."
            />
          )}
        </div>
      </div>

      <ModeTabs />
    </header>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  muted?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      title={hint}
      className={`border-border min-w-[130px] rounded-xl border px-4 py-3 ${warn ? "border-amber-500/50 bg-amber-500/5" : ""}`}
    >
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          muted ? "text-muted-foreground text-sm font-normal" : ""
        } ${warn ? "text-amber-700 dark:text-amber-500" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The four approved modes. Only Understand exists; the rest are shown
 * disabled rather than as empty screens — the information architecture is
 * real and worth signalling, but a clickable tab leading to a stub would
 * be a fake screen.
 */
function ModeTabs() {
  const modes: {
    key: string;
    label: string;
    enabled: boolean;
    hint?: string;
  }[] = [
    { key: "understand", label: "Understand", enabled: true },
    {
      key: "compose",
      label: "Compose",
      enabled: false,
      hint: "Milestone 3 — needs Composition storage.",
    },
    {
      key: "evaluate",
      label: "Evaluate",
      enabled: false,
      hint: "Milestone 2 — gap list with one action each.",
    },
    {
      key: "verify",
      label: "Verify",
      enabled: false,
      hint: "Milestone 4 — full-width page preview.",
    },
  ];

  return (
    <nav className="border-border flex gap-1 border-b">
      {modes.map((m) => (
        <span
          key={m.key}
          title={m.hint}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${
            m.enabled
              ? "border-foreground font-medium"
              : "text-muted-foreground/50 cursor-not-allowed border-transparent"
          }`}
        >
          {m.label}
          {!m.enabled && (
            <span className="ml-1.5 text-[10px] tracking-wide uppercase">
              soon
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
