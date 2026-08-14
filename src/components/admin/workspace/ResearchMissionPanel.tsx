import { Check, Loader2, Search, X } from "lucide-react";
import {
  awaitsReview,
  isOpen,
  statusLabel,
  type ResearchMission,
} from "@/lib/knowledge/researchMissions";
import { MediaGallery } from "./MediaGallery";
import { decideResearch } from "@/app/admin/workspace/[id]/actions";

/**
 * **Findings, shown beside what Atlas knows — never folded into it.**
 *
 * The whole value of a review step evaporates if a proposed fact looks
 * identical to an accepted one: the reviewer would be approving something
 * whose edges they cannot see. So this panel is visually separate, and
 * every row in it is explicitly labelled as *not yet applied*.
 *
 * ## `no-findings` is rendered as an answer, not as a failure
 *
 * A mission that read three sources and found nothing has produced the most
 * actionable result a research tool can: *this is not published anywhere we
 * can see.* That sends a curator to a phone call rather than to another web
 * page. Rendering it as an error, or hiding it, would throw that away.
 */
export function ResearchMissionPanel({
  missions,
  entityId,
}: {
  missions: readonly ResearchMission[];
  entityId: string;
}) {
  if (missions.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Research</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          What Atlas was asked to go and find out. Nothing here has been applied
          to the entity.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {missions.map((mission) => (
          <MissionCard key={mission.id} mission={mission} entityId={entityId} />
        ))}
      </div>
    </section>
  );
}

function MissionCard({
  mission,
  entityId,
}: {
  mission: ResearchMission;
  entityId: string;
}) {
  const facts = mission.findings?.keyFacts ?? [];
  const media = mission.findings?.media ?? [];
  const conflicts = mission.findings?.conflicts ?? [];

  return (
    <div className="border-border rounded-xl border p-5">
      <div className="flex flex-wrap items-center gap-2">
        {isOpen(mission) ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : (
          <Search className="text-muted-foreground h-4 w-4" />
        )}
        <p className="text-sm font-medium capitalize">{mission.topic}</p>
        <span className="text-muted-foreground text-xs">
          {statusLabel(mission.status)}
        </span>
      </div>

      {mission.summary && (
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {mission.summary}
        </p>
      )}

      {mission.status === "requested" && (
        <p className="text-muted-foreground mt-2 text-xs">
          Queued. Run{" "}
          <code className="bg-muted rounded px-1.5 py-0.5">
            npm run run-missions
          </code>{" "}
          to answer it.
        </p>
      )}

      {facts.length > 0 && (
        <dl className="mt-4 flex flex-col gap-2.5">
          {facts.map((fact) => (
            <div
              key={`${fact.label}-${fact.value}`}
              className="flex flex-col gap-0.5 sm:flex-row sm:gap-4"
            >
              <dt className="text-muted-foreground min-w-[140px] shrink-0 text-sm">
                {fact.label}
              </dt>
              <dd className="text-sm leading-relaxed">
                {fact.value}
                {fact.category && (
                  <span className="text-muted-foreground ml-2 text-[11px]">
                    from &ldquo;{fact.category}&rdquo;
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {media.length > 0 && (
        <div className="mt-4">
          <MediaGallery
            media={media.map((m) => ({ ...m, isHero: false }))}
            columns={4}
          />
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-medium">
            {conflicts.length} disagreement{conflicts.length === 1 ? "" : "s"}{" "}
            with what Atlas already holds
          </p>
          <ul className="text-muted-foreground mt-1.5 flex flex-col gap-1 text-xs">
            {conflicts.map((c) => (
              <li key={c.field}>
                <span className="font-medium">{c.field}</span> — holds &ldquo;
                {c.existing}&rdquo;, source says &ldquo;{c.incoming}&rdquo;
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            Resolving these is a human decision, not an automatic one.
          </p>
        </div>
      )}

      {awaitsReview(mission) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={decideResearch}>
            <input type="hidden" name="missionId" value={mission.id} />
            <input type="hidden" name="entityId" value={entityId} />
            <input type="hidden" name="decision" value="accept" />
            <button className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-700">
              <Check className="h-3.5 w-3.5" />
              Accept findings
            </button>
          </form>
          <form action={decideResearch}>
            <input type="hidden" name="missionId" value={mission.id} />
            <input type="hidden" name="entityId" value={entityId} />
            <input type="hidden" name="decision" value="reject" />
            <button className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition">
              <X className="h-3.5 w-3.5" />
              Decline
            </button>
          </form>
          {/* Accepting re-merges against the entity as it stands now, so what
              lands can differ from what is proposed here if the entity moved
              in between. Said plainly rather than implied. */}
          <span className="text-muted-foreground text-[11px]">
            Accepting merges these into the entity. Anything Atlas already holds
            is kept.
          </span>
        </div>
      )}
    </div>
  );
}
