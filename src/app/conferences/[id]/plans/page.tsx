import { notFound } from "next/navigation";
import { ModuleTop, NotOpen } from "@/components/conference-together/ModuleTop";
import { PlansBoard } from "@/components/conference-together/PlansBoard";
import { Reminders } from "@/components/conference-together/Reminders";
import {
  ACTIVITY_KINDS,
  type ActivityKind,
} from "@/domain/conference-plans/types";
import { curatedFor } from "@/lib/conference-explore/places";
import { readPlans } from "@/lib/conference-plans/service";
import { modulePage, planDays } from "@/lib/conference-together/page";
import { plansDeps } from "@/lib/conference-together/request";

export const dynamic = "force-dynamic";

/**
 * **The `plans` module: make a plan, or join one.** `?kind=lunch&venue=<id>`
 * opens the form already filled in, which is how Explore's "Plan this"
 * arrives here.
 */
export default async function PlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const page = await modulePage((await params).id, "plans");
  if (!page) notFound();
  const { ctx, identity, open } = page;
  const c = ctx.conference;
  if (!open)
    return (
      <>
        <ModuleTop conferenceId={c.id} conferenceName={c.name} title="Plans" />
        <NotOpen what="Plans" />
      </>
    );
  const board = await readPlans(await plansDeps(c), identity, c.id);
  if (!board) notFound();
  const q = await searchParams;
  const kind = ACTIVITY_KINDS.includes(q.kind as ActivityKind)
    ? (q.kind as ActivityKind)
    : undefined;
  return (
    <>
      <ModuleTop
        conferenceId={c.id}
        conferenceName={c.name}
        title="Plans"
        lede="Somebody says “coffee at 8?” and three people turn up. That's the whole idea."
      />
      <div className="mx-auto max-w-[1180px] px-4 *:max-w-[820px] sm:px-8">
        <Reminders conferenceId={c.id} />
      </div>
      <PlansBoard
        conferenceId={c.id}
        initial={board}
        days={planDays(c)}
        meetingIdeas={curatedFor(c)
          .filter((p) => p.kind === "meeting")
          .map((p) => ({ id: p.id, name: p.name }))}
        prefill={
          kind || q.venue
            ? {
                kind,
                venueId: q.venue,
                venueName: q.venueName,
                title: q.title?.slice(0, 80),
                meeting: q.meeting?.slice(0, 80),
                day: q.day,
                time: /^([01]\d|2[0-3]):[0-5]\d$/.test(q.time ?? "")
                  ? q.time
                  : undefined,
                open: true,
              }
            : undefined
        }
      />
    </>
  );
}
