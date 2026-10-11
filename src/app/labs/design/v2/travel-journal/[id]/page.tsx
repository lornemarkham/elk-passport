import Link from "next/link";
import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

/**
 * **TRAVEL JOURNAL — one page of the notebook.**
 *
 * A narrow measure, a margin that carries the town and the verbs, and the
 * photograph as an inset plate with Atlas's own key fact as its caption. The
 * opposite of a hero image, on purpose.
 */
export default async function TravelJournalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await subject(id);
  if (!found) notFound();

  return (
    <main className="min-h-screen bg-[#f6f1e6] text-[#2a2620]">
      <LabNote direction="travel journal" />

      <div className="mx-auto max-w-[1080px] px-5 pt-6 sm:px-10">
        <Link
          href="/labs/design/v2/travel-journal"
          className="text-[10.5px] tracking-[0.2em] text-[#2a2620]/50 uppercase hover:text-[#4f6b3f]"
        >
          ← The notebook
        </Link>
      </div>

      <article className="mx-auto max-w-[1080px] px-5 pt-8 pb-24 sm:px-10">
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-[150px_1fr]">
          <aside className="sm:pt-3">
            {(found.place ?? found.area) && (
              <p className="text-[10.5px] tracking-[0.18em] text-[#2a2620]/50 uppercase">
                {found.place ?? found.area}
              </p>
            )}
            {found.doing.length > 0 && (
              <p className="mt-2 text-[12.5px] leading-[1.6] text-[#4f6b3f] italic">
                {found.doing.join(", ")}
              </p>
            )}
          </aside>

          <div>
            <h1 className="font-heading max-w-[18ch] text-[2.4rem] leading-[1] tracking-[-0.03em] text-balance sm:text-[3.4rem]">
              {found.title}
            </h1>

            {found.blurb && (
              <p className="mt-5 max-w-[62ch] text-[16.5px] leading-[1.78] text-[#2a2620]/80">
                {found.blurb}
              </p>
            )}

            {found.heroUrl && (
              <figure className="mt-7 max-w-[680px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted */}
                <img
                  src={found.heroUrl}
                  alt=""
                  className="aspect-[3/2] w-full object-cover"
                />
                {found.where && (
                  <figcaption className="mt-2 text-[11.5px] text-[#2a2620]/50 italic">
                    {found.where}
                  </figcaption>
                )}
              </figure>
            )}

            {found.facts.length > 0 && (
              <section className="mt-9 border-t border-[#2a2620]/18 pt-5">
                <p className="text-[10px] tracking-[0.22em] text-[#2a2620]/45 uppercase">
                  Notes
                </p>
                <dl className="mt-3 flex max-w-[64ch] flex-col gap-3">
                  {found.facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="grid gap-x-4 sm:grid-cols-[130px_1fr]"
                    >
                      <dt className="font-heading text-[13.5px] text-[#4f6b3f]">
                        {fact.label}
                      </dt>
                      <dd className="text-[14px] leading-[1.6] text-[#2a2620]/70">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
