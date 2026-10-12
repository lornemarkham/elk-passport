import Link from "next/link";
import { notFound } from "next/navigation";
import { inkOn, safeAccent } from "@/domain/conference/branding";
import { conferenceContext } from "@/lib/conference/request";
import { arrivalsEnabled } from "@/lib/conference-arrivals/enabled";
import { ArrivalsBoard } from "@/components/conference-arrivals/ArrivalsBoard";

export const dynamic = "force-dynamic";

/**
 * **The `arrivals` module: everyone's aircraft, live, on one map.**
 *
 * Members only, like every module: `conferenceContext` is `null` for anybody
 * else, and they get the same 404 as a mistyped URL. The board itself is
 * fetched by the page from `/api/conferences/{id}/arrivals`, which runs the
 * same membership check and is the only thing that talks to ADS-B.
 */
export default async function ArrivalsModule({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) notFound();
  const { conference: c } = ctx;
  if (!c.modules.includes("arrivals") && ctx.viewer.role !== "organiser")
    notFound();
  if (!arrivalsEnabled())
    return (
      <div className="mx-auto max-w-[560px] px-5 pt-10">
        <Link
          href={`/conferences/${c.id}`}
          className="text-[15px] text-black/55 underline"
        >
          ← {c.name}
        </Link>
        <h1 className="mt-3 text-[36px] leading-none font-black tracking-[-0.03em]">
          Arrivals
        </h1>
        <p className="mt-6 rounded-2xl bg-black/5 p-4 text-[15px] text-black/65">
          Arrivals isn&apos;t open yet. It will be here soon.
        </p>
      </div>
    );
  const accent = safeAccent(c.branding.accent);

  return (
    <ArrivalsBoard
      conferenceId={c.id}
      name={c.name}
      kind={c.kind}
      timeZone={c.timeZone}
      accent={accent}
      ink={inkOn(accent)}
    />
  );
}
