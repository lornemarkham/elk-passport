import { notFound } from "next/navigation";
import { Doors } from "@/components/conference/Doors";
import { Explore } from "@/components/conference-together/Explore";
import { ModuleTop } from "@/components/conference-together/ModuleTop";
import { doorsFor } from "@/domain/conference/modules";
import { conferenceContext, readIdentity } from "@/lib/conference/request";
import { conferenceSetup } from "@/lib/conference/config";
import { readPlans } from "@/lib/conference-plans/service";
import { plansDeps } from "@/lib/conference-together/request";
import { togetherEnabled } from "@/lib/conference-together/enabled";

export const dynamic = "force-dynamic";

/**
 * **The `discover` module: explore the city, and free time.**
 *
 * Real places from Atlas (Discovery's own corpus, photographed first, the
 * shared curated list where Atlas has nothing), near the venue or wherever
 * the person chooses, each a tap from a plan. Below them, the module's first
 * version stays: doors into Go Have A Day from the conference's town, which
 * build a whole free day out of the same places.
 *
 * Still the worked example of the module contract: a static folder that wins
 * over `[module]`, and a `conferenceContext` that is `null` for anybody who
 * isn't a member.
 */
export default async function DiscoverModule({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) notFound();
  const { conference: c } = ctx;
  if (!c.modules.includes("discover") && ctx.viewer.role !== "organiser")
    notFound();
  const doors = doorsFor(c);
  const plansOn = c.modules.includes("plans") && togetherEnabled();
  let plans: { id: string; title: string; votes: boolean }[] = [];
  if (plansOn) {
    const setup = conferenceSetup();
    const identity = setup.open ? await readIdentity(setup.config) : null;
    const board = identity
      ? await readPlans(await plansDeps(null), identity, c.id)
      : null;
    plans = (board?.plans ?? [])
      .filter((p) => p.next)
      .map((p) => ({ id: p.id, title: p.title, votes: p.votes }));
  }

  return (
    <div className="pb-16">
      <ModuleTop
        conferenceId={c.id}
        conferenceName={c.name}
        title={`Explore ${c.place.label}`}
        lede="Real places a walk away. Find one, then make it a plan so it actually happens."
      />
      <div className="mx-auto max-w-[760px] px-5">
        {doors.length ? (
          <Explore conferenceId={c.id} plans={plans} plansOn={plansOn} />
        ) : (
          <p className="mt-4 text-black/60">
            Passport doesn&apos;t know {c.place.label} well enough to suggest
            anything yet, and it won&apos;t pretend to.
            {ctx.viewer.role === "organiser"
              ? " If it's one of the towns Passport knows, pick it in Organiser settings."
              : ""}
          </p>
        )}
        {doors.length ? (
          <>
            <h2 className="mt-12 text-[24px] leading-tight font-black tracking-[-0.02em]">
              A whole free day
            </h2>
            <p className="mt-2 mb-4 text-black/60">
              Say what kind of time you&apos;ve got. Go Have A Day builds it out
              of real places.
            </p>
            <Doors doors={doors} />
          </>
        ) : null}
      </div>
    </div>
  );
}
