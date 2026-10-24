import { notFound } from "next/navigation";
import { FindMyPeople } from "@/components/conference-together/FindMyPeople";
import { ModuleTop, NotOpen } from "@/components/conference-together/ModuleTop";
import { safeAccent } from "@/domain/conference/branding";
import { anchorsFor } from "@/lib/conference-explore/places";
import { readPeople } from "@/lib/conference-people/service";
import { readPlans } from "@/lib/conference-plans/service";
import { modulePage } from "@/lib/conference-together/page";
import { peopleDeps, plansDeps } from "@/lib/conference-together/request";

export const dynamic = "force-dynamic";

/** **The `people` module: find my people.** See ADR 011. */
export default async function PeoplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const page = await modulePage((await params).id, "people");
  if (!page) notFound();
  const { ctx, identity, open } = page;
  const c = ctx.conference;
  if (!open)
    return (
      <>
        <ModuleTop
          conferenceId={c.id}
          conferenceName={c.name}
          title="Find my people"
        />
        <NotOpen what="Find my people" />
      </>
    );
  const view = await readPeople(peopleDeps(), identity, c.id);
  if (!view) notFound();
  const anchor = anchorsFor(c)[0];
  // Where upcoming plans meet, when it's a place Passport can put on a map.
  const board = c.modules.includes("plans")
    ? await readPlans(await plansDeps(c, 1500), identity, c.id)
    : null;
  const pins = (board?.plans ?? [])
    .filter((p) => p.next && p.meeting?.place?.at)
    .map((p) => ({
      id: p.id,
      name: p.meeting!.label,
      at: p.meeting!.place!.at!,
    }));
  return (
    <>
      <ModuleTop
        conferenceId={c.id}
        conferenceName={c.name}
        title="Find my people"
        lede="Lost the group between the hotel and the restaurant? Share where you are for a while, see who else is, and walk over."
      />
      <FindMyPeople
        conferenceId={c.id}
        initial={view}
        centre={anchor?.at ?? view.people[0]?.at ?? null}
        pins={pins}
        accent={safeAccent(c.branding.accent)}
      />
    </>
  );
}
