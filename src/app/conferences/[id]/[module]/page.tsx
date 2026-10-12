import Link from "next/link";
import { notFound } from "next/navigation";
import { moduleById } from "@/domain/conference/modules";
import { conferenceContext } from "@/lib/conference/request";

export const dynamic = "force-dynamic";

/**
 * **A module that isn't built yet.**
 *
 * Every module id has a page from day one, so navigation exists before the
 * modules do. A workstream replaces this by adding its own static folder,
 * `src/app/conferences/[id]/<module>/`, which Next prefers to this dynamic
 * one. Until then it says plainly what will be here, and that it isn't yet.
 */
export default async function ModulePlaceholder({
  params,
}: {
  params: Promise<{ id: string; module: string }>;
}) {
  const { id, module } = await params;
  const ctx = await conferenceContext(id);
  const m = moduleById(module);
  if (!ctx || !m) notFound();
  const organiser = ctx.viewer.role === "organiser";
  if (!ctx.conference.modules.includes(m.id) && !organiser) notFound();

  return (
    <div className="mx-auto max-w-[560px] px-5 pt-10">
      <Link
        href={`/conferences/${id}`}
        className="text-[15px] text-black/55 underline"
      >
        ← {ctx.conference.name}
      </Link>
      <h1 className="mt-3 text-[36px] leading-none font-black tracking-[-0.03em]">
        {m.label}
      </h1>
      <p className="mt-3 text-[18px] text-black/70">{m.promise}</p>
      <p className="mt-6 rounded-2xl bg-black/5 p-4 text-[15px] text-black/65">
        This part isn&apos;t built yet. When it is, it&apos;ll be right here.
      </p>
      {organiser ? (
        <p className="mt-4 text-[13px] text-black/45">
          Organisers only: owned by {m.workstream}
          {m.prototype ? `; starts from ${m.prototype}` : ""}. Switch it off in
          Organiser settings if you&apos;d rather people didn&apos;t see it yet.
        </p>
      ) : null}
    </div>
  );
}
