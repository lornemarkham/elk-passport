import Link from "next/link";
import { notFound } from "next/navigation";
import { doorsFor } from "@/domain/conference/modules";
import { conferenceContext } from "@/lib/conference/request";
import { Doors } from "@/components/conference/Doors";

export const dynamic = "force-dynamic";

/**
 * **The `discover` module: free time, from where the conference is.**
 *
 * Its whole first version is doors into Go Have A Day from the conference's
 * town, which works with Discovery as it stands (vision principle 4). The
 * `passport-discovery` workstream owns this route from here: shared maps,
 * between-session timing and Atlas place cards land here.
 *
 * It is also the worked example of the module contract: a static folder
 * that wins over `[module]`, and a `conferenceContext` that is `null` for
 * anybody who isn't a member.
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

  return (
    <div className="mx-auto max-w-[760px] px-5 pt-10">
      <Link
        href={`/conferences/${c.id}`}
        className="text-[15px] text-black/55 underline"
      >
        ← {c.name}
      </Link>
      <h1 className="mt-3 text-[36px] leading-none font-black tracking-[-0.03em]">
        Free time in {c.place.label}
      </h1>
      {doors.length ? (
        <>
          <p className="mt-3 mb-6 text-black/60">
            Say what kind of time you&apos;ve got. Go Have A Day builds it out
            of real places.
          </p>
          <Doors doors={doors} />
        </>
      ) : (
        <p className="mt-4 text-black/60">
          Passport doesn&apos;t know {c.place.label} well enough to suggest
          anything yet, and it won&apos;t pretend to.
          {ctx.viewer.role === "organiser"
            ? " If it's one of the towns Passport knows, pick it in Organiser settings."
            : ""}
        </p>
      )}
    </div>
  );
}
