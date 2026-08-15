import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Play,
  Compass,
  Layers,
  Link2,
  Sparkles,
  Telescope,
} from "lucide-react";
import type {
  GrowthItem,
  MissionControlModel,
  NextAction,
} from "@/lib/knowledge/missionControl";
import { formatDate } from "@/lib/knowledge/formatDate";
import { MissionLauncher } from "./MissionLauncher";
import { RegionHealthPanel } from "./RegionHealthPanel";
import type { RegionHealth } from "@/lib/knowledge/regionHealth";

/**
 * Mission Control.
 *
 * ## What this is trying to be
 *
 * Not a dashboard. A **status board for a machine that is learning** — the
 * question it answers on sight is "what is Atlas doing, and what should I
 * do next", not "what happened historically".
 *
 * The composition follows that: the mission banner is the largest thing on
 * the page and states one sentence in present tense; growth is a *feed*,
 * because accumulation over time is the thing worth watching; the run list
 * is demoted to the bottom, where history belongs.
 *
 * ## Where the excitement is allowed to come from
 *
 * From real accumulation only. Nothing here animates to imply progress —
 * the single moving element is a pulse on the status dot, and it appears
 * **only when a run is genuinely in flight**. Numbers do not count up;
 * they are what they are. Restraint is the point: on a page whose whole
 * job is to be trusted, one invented flourish would make every honest
 * number look like decoration too.
 */
export function MissionControl({
  model,
  health,
}: {
  model: MissionControlModel;
  health: RegionHealth;
}) {
  return (
    <div className="flex flex-col gap-12">
      <MissionLauncher />

      <MissionBanner model={model} />

      {model.missionComplete && (
        <MissionCompleteCard complete={model.missionComplete} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <LearningPanel model={model} />
        <QueuePanel model={model} />
        <NextActionsPanel actions={model.nextActions} />
      </div>

      <RegionHealthPanel health={health} />

      {model.attention.length > 0 && <AtlasWantsYou model={model} />}

      <GrowthFeed items={model.growth} />
    </div>
  );
}

/**
 * How the last mission went, in a colleague's words.
 *
 * Ends on somewhere to go rather than on a full stop — the sprint's own
 * framing, and the right one: a mission that ends in "completed" closes a
 * loop, while one that ends in "go look at what changed" opens another.
 */
function MissionCompleteCard({
  complete,
}: {
  complete: NonNullable<MissionControlModel["missionComplete"]>;
}) {
  return (
    <section className="border-border rounded-2xl border p-7">
      <p className="text-xs font-medium tracking-widest text-emerald-700 uppercase dark:text-emerald-500">
        Mission complete
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">
        {complete.label}
      </h3>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        {complete.learned.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Atlas learned</p>
            <ul className="flex flex-col gap-1.5">
              {complete.learned.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {complete.needsYou.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Needs your help</p>
            <ul className="flex flex-col gap-1.5">
              {complete.needsYou.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {complete.passportImprovements.length > 0 && (
        <div className="border-border mt-6 border-t pt-5">
          <p className="mb-2 text-sm font-medium">Passport improved</p>
          <ul className="flex flex-col gap-1.5">
            {complete.passportImprovements.map((item) => (
              <li
                key={item}
                className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {complete.observation && (
        <p className="text-muted-foreground border-border mt-6 border-t pt-5 text-sm leading-relaxed">
          <span className="text-foreground font-medium">Worth noticing.</span>{" "}
          {complete.observation}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {complete.exploreEntityId && (
          <ExploreLink href={`/admin/entities/${complete.exploreEntityId}`}>
            Explore {complete.exploreEntityName}
          </ExploreLink>
        )}
        <ExploreLink href={`/admin/runs/${complete.runId}`}>
          See the full mission
        </ExploreLink>
      </div>
    </section>
  );
}

/** One consistent affordance for "go and look at this". Used everywhere something is explorable. */
function ExploreLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="border-border hover:border-foreground/40 hover:bg-muted/40 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition"
    >
      {children}
      <ArrowRight className="h-3 w-3 opacity-60" />
    </Link>
  );
}

function MissionBanner({ model }: { model: MissionControlModel }) {
  const { mission, knowledge } = model;
  const learning = mission.status === "learning";

  return (
    <section
      className={`rounded-2xl border p-8 ${
        learning
          ? "border-emerald-500/40 bg-emerald-500/[0.04]"
          : mission.status === "attention"
            ? "border-amber-500/30 bg-amber-500/[0.02]"
            : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[280px] flex-1">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {/* The only animation on this page, and only while a run is
                  genuinely in flight. Motion here means work is happening. */}
              {learning && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  learning
                    ? "bg-emerald-500"
                    : mission.status === "attention"
                      ? "bg-amber-500"
                      : "bg-muted-foreground/40"
                }`}
              />
            </span>
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Mission
            </p>
          </div>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {mission.headline}
          </h2>

          {/* State as a to-do list, not a mood. Each line names a real
              quantity and links to where it gets resolved. */}
          <ul className="mt-4 flex max-w-2xl flex-col gap-2">
            {model.statusLines.map((line) => (
              <li
                key={line.text}
                className="flex items-start gap-2.5 text-sm leading-relaxed"
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    line.tone === "attention"
                      ? "bg-amber-500"
                      : line.tone === "ready"
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40"
                  }`}
                />
                {line.href ? (
                  <Link
                    href={line.href}
                    className="underline-offset-4 hover:underline"
                  >
                    {line.text}
                  </Link>
                ) : (
                  <span>{line.text}</span>
                )}
              </li>
            ))}
          </ul>

          {mission.focus && (
            <p className="text-muted-foreground mt-4 text-xs">
              Focus{" "}
              <span className="text-foreground font-medium">
                {mission.focus}
              </span>
              {mission.startedAt ? ` · ${formatDate(mission.startedAt)}` : ""}
              {mission.runId && (
                <>
                  {" · "}
                  <Link
                    href={`/admin/runs/${mission.runId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    open run
                  </Link>
                </>
              )}
            </p>
          )}
        </div>

        {/* What Atlas knows right now — the number that should grow. */}
        <div className="flex gap-8">
          <BigNumber label="Entities" value={knowledge.entities} />
          <BigNumber label="Sources" value={knowledge.sources} />
          <BigNumber label="Connections" value={knowledge.relationships} />
          <BigNumber label="Facts" value={knowledge.facts} accent />
        </div>
      </div>
    </section>
  );
}

function BigNumber({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-4xl font-semibold tabular-nums ${accent ? "text-emerald-700 dark:text-emerald-500" : ""}`}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-muted-foreground mt-1 text-[11px] font-medium tracking-widest uppercase">
        {label}
      </p>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border flex flex-col gap-4 rounded-xl border p-6">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function LearningPanel({ model }: { model: MissionControlModel }) {
  const { lifetime, knowledge } = model;
  const rows: [string, number | string][] = [
    ["Pages explored", lifetime.pagesFetched],
    ["Sources verified", lifetime.sourcesVerified],
    ["Entities discovered", lifetime.entitiesCreated],
    ["Entities enriched", lifetime.entitiesEnriched],
    ["Things learned", lifetime.thingsLearned],
    ["Relationships", lifetime.relationshipsCreated],
    [
      "First-party coverage",
      knowledge.coveragePercent === null
        ? "—"
        : `${knowledge.coveragePercent}%`,
    ],
  ];

  return (
    <Panel icon={<Telescope className="h-3.5 w-3.5" />} title="Learning">
      <dl className="flex flex-col gap-2.5">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function QueuePanel({ model }: { model: MissionControlModel }) {
  const { queue } = model;

  return (
    <Panel icon={<Layers className="h-3.5 w-3.5" />} title="Queue">
      {queue.total === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Nothing queued. Atlas discovers work; it never fetches on its own.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {queue.remaining}
            </span>
            <span className="text-muted-foreground text-sm">waiting</span>
          </div>

          {/* Share of the KNOWN queue — never "progress through the region",
              which Atlas cannot know and must not imply. */}
          {queue.percentOfKnownQueue !== null && (
            <div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-emerald-500/70"
                  style={{ width: `${queue.percentOfKnownQueue}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                {queue.ingested} of {queue.total} known sources read
                {queue.rejected > 0 ? ` · ${queue.rejected} refused` : ""}
              </p>
            </div>
          )}

          {queue.nextUp.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs">Next up</p>
              <ul className="flex flex-col gap-1.5">
                {queue.nextUp.map((item) => (
                  <li key={item.id} className="truncate text-xs">
                    <span className="text-muted-foreground">
                      {item.sourceType} ·{" "}
                    </span>
                    {item.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function NextActionsPanel({ actions }: { actions: readonly NextAction[] }) {
  return (
    <Panel
      icon={<Compass className="h-3.5 w-3.5" />}
      title="Today\u2019s missions"
    >
      <div className="flex flex-col gap-4">
        {actions.map((action) => (
          <div key={action.title} className="flex flex-col gap-1">
            {action.href ? (
              <Link
                href={action.href}
                className="group flex items-start gap-2 text-sm font-medium"
              >
                <Play className="mt-1 h-3 w-3 shrink-0 fill-current opacity-70" />
                <span className="underline-offset-4 group-hover:underline">
                  {action.title}
                </span>
              </Link>
            ) : (
              <p className="flex items-start gap-2 text-sm font-medium">
                <Play className="mt-1 h-3 w-3 shrink-0 fill-current opacity-40" />
                {action.title}
              </p>
            )}
            {/* Why it exists, always. An instruction a curator can't
                evaluate is an order, not a suggestion. */}
            <p className="text-muted-foreground pl-5 text-xs leading-relaxed">
              {action.why}
            </p>
            {action.command && (
              <code className="bg-muted mt-1 ml-5 w-fit rounded px-1.5 py-0.5 text-[11px]">
                {action.command}
              </code>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AtlasWantsYou({ model }: { model: MissionControlModel }) {
  const total = model.attention.reduce((n, g) => n + g.events.length, 0);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">
          Atlas wants you ({total})
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Decisions Atlas deliberately did not make on its own. Each one opens
          where you can resolve it.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {model.attention.map((group) => (
          <div
            key={group.reason}
            className="rounded-xl border border-amber-500/40 bg-amber-500/[0.03] p-4"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
              {group.reason}
              <span className="text-muted-foreground font-normal">
                · {group.events.length}
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {group.why}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {group.events.slice(0, 3).map((event) => (
                <li key={event.id} className="text-xs">
                  {event.entityId ? (
                    <Link
                      href={`/admin/entities/${event.entityId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {event.subject}
                    </Link>
                  ) : (
                    <span className="font-medium">{event.subject}</span>
                  )}
                </li>
              ))}
              {group.events.length > 3 && (
                <li className="text-muted-foreground text-xs">
                  +{group.events.length - 3} more
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const GROWTH_ICON: Record<GrowthItem["kind"], React.ReactNode> = {
  discovered: <Telescope className="h-3.5 w-3.5" />,
  created: <Sparkles className="h-3.5 w-3.5" />,
  enriched: <Activity className="h-3.5 w-3.5" />,
  connected: <Link2 className="h-3.5 w-3.5" />,
  verified: <CheckCircle2 className="h-3.5 w-3.5" />,
  conflict: <AlertTriangle className="h-3.5 w-3.5" />,
};

const GROWTH_LABEL: Record<GrowthItem["kind"], string> = {
  discovered: "discovered",
  created: "created",
  enriched: "learned",
  connected: "connected",
  verified: "verified",
  conflict: "conflict",
};

/**
 * The pulse — every meaningful moment, newest first.
 *
 * A feed rather than a chart because the thing worth watching is
 * *accumulation*, and a chart of six data points is a decoration. When
 * Atlas is running this is where new lines appear.
 */
function GrowthFeed({ items }: { items: readonly GrowthItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">
          Knowledge growth
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Every moment Atlas learned something, newest first. Drawn from
          recorded events — nothing here is generated.
        </p>
      </div>

      <ol className="border-border divide-border divide-y rounded-xl border">
        {items.map((item, index) => (
          <li
            key={`${item.runId}-${item.at}-${index}`}
            className="flex items-start gap-3 p-4"
          >
            <span
              className={`mt-0.5 ${
                item.kind === "conflict"
                  ? "text-amber-600 dark:text-amber-500"
                  : item.kind === "enriched" || item.kind === "created"
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-muted-foreground"
              }`}
            >
              {GROWTH_ICON[item.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                {item.entityId ? (
                  <Link
                    href={`/admin/entities/${item.entityId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {item.subject}
                  </Link>
                ) : (
                  <span className="font-medium">{item.subject}</span>
                )}
                <span className="text-muted-foreground text-xs">
                  {GROWTH_LABEL[item.kind]}
                </span>
              </p>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                {item.message}
              </p>

              {/* Never make someone hunt. Every moment offers the two or
                  three places it could sensibly lead. */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.entityId && (
                  <ExploreLink href={`/admin/entities/${item.entityId}`}>
                    Open entity
                  </ExploreLink>
                )}
                <ExploreLink href={`/admin/runs/${item.runId}`}>
                  See evidence
                </ExploreLink>
                {item.detailUrl && (
                  <a
                    href={item.detailUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="border-border hover:border-foreground/40 hover:bg-muted/40 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition"
                  >
                    Open website
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
