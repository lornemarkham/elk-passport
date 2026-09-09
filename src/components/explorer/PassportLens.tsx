import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PassportView } from "@/lib/explorer/passportView";
import { STAGE_LABEL } from "@/lib/explorer/passportView";
import { Chip, Field } from "./primitives";

/**
 * **How Passport sees this — deliberately the only panel that is not Atlas truth.**
 *
 * Everything else on the page is what Atlas stores. This is what one
 * consumer would do with it, and it is boxed, labelled and placed apart so
 * the two can never be mistaken for each other. Atlas is not responsible for
 * any statement in here, and nothing in here is stored anywhere.
 *
 * It earns its place because the question that made Explorer necessary is
 * comparative: *Atlas knows all this — so why is the Passport page thin?*
 * Answering that needs both halves on one screen.
 */

const STAGE_TONE: Record<PassportView["stage"], string> = {
  "suppressed-by-atlas": "bg-red-500/12 text-red-800 dark:text-red-300",
  "outside-scope": "bg-orange-500/15 text-orange-900 dark:text-orange-300",
  "excluded-from-feed": "bg-amber-500/15 text-amber-900 dark:text-amber-300",
  "in-feed": "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
};

/** The pipeline, drawn once, with the entity's own position marked. */
const STAGES: PassportView["stage"][] = [
  "suppressed-by-atlas",
  "outside-scope",
  "excluded-from-feed",
  "in-feed",
];

export function PassportLens({
  view,
  scopeLabel,
}: {
  view: PassportView;
  scopeLabel?: string;
}) {
  const reached = STAGES.indexOf(view.stage);

  return (
    <section className="rounded-lg border border-dashed border-sky-500/40 bg-sky-500/[0.03]">
      <header className="flex items-baseline gap-2 border-b border-dashed border-sky-500/30 px-4 py-2.5">
        <h2 className="text-sm font-semibold">How Passport sees this</h2>
        <span className="text-muted-foreground text-xs">
          not Atlas truth — Passport policy, run live
        </span>
      </header>

      <div className="px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {STAGES.map((stage, index) => (
            <span
              key={stage}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                stage === view.stage
                  ? STAGE_TONE[stage]
                  : index < reached
                    ? "bg-muted text-muted-foreground/70"
                    : "text-muted-foreground/40"
              }`}
            >
              {STAGE_LABEL[stage]}
            </span>
          ))}
        </div>

        <p className="mb-3 text-sm">{view.explanation}</p>

        <dl>
          {view.suppressionReason && (
            <Field label="Atlas suppression">
              <code className="font-mono text-xs">
                {view.suppressionReason}
              </code>
            </Field>
          )}
          <Field
            label="Active scope"
            empty={!scopeLabel}
            emptyLabel="none — Passport is looking at the whole corpus"
          >
            {scopeLabel}
          </Field>
          <Field label="In scope">{view.inScope ? "yes" : "no"}</Field>
          {view.feedExclusion && (
            <Field label="Feed exclusion">
              <code className="font-mono text-xs">{view.feedExclusion}</code>
            </Field>
          )}
          <Field label="Detail-ready">
            {view.detailReady
              ? "yes — Atlas holds every field a Passport page renders"
              : "no — a Passport page would be missing something it renders"}
          </Field>
          <Field
            label="Card destination"
            empty={!view.destination}
            emptyLabel="nowhere — no Passport page exists for this"
          >
            {view.destination && (
              <Link
                href={view.destination}
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <code className="font-mono text-xs">{view.destination}</code>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </Field>
          {view.candidate && (
            <Field label="Discovery card carries">
              <span className="flex flex-wrap gap-1">
                <Chip>
                  {view.candidate.heroUrl ? "hero image" : "no image"}
                </Chip>
                <Chip>
                  {view.candidate.coordinates
                    ? "coordinates"
                    : "no coordinates"}
                </Chip>
                <Chip>
                  {view.candidate.context
                    ? `at ${view.candidate.context.name}`
                    : "no container"}
                </Chip>
                <Chip>{view.candidate.containsCount} contained</Chip>
              </span>
            </Field>
          )}
        </dl>

        {!view.destination && view.stage === "in-feed" && (
          <p className="text-muted-foreground mt-2 text-xs">
            Passport has no detail template for this kind, and Atlas asserts no
            containing Place to fall back to — so the card appears and does
            nothing when clicked.
          </p>
        )}
      </div>
    </section>
  );
}
