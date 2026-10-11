import Link from "next/link";
import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

/**
 * **EDITORIAL CINEMATIC — the opening spread of a feature.**
 *
 * The photograph runs to the edges and the headline is lifted over its lower
 * third, in the warm ground's own colour, so the two read as one object. Below
 * it the page becomes a magazine: a held text column, the verbs as a
 * standfirst, and Atlas's key facts in a hairline-ruled sidebar.
 */
export default async function EditorialCinematicDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await subject(id);
  if (!found) notFound();

  return (
    <main className="min-h-screen bg-[#efe7da] text-[#241d15]">
      <LabNote direction="editorial-cinematic" />

      <div className="mx-auto max-w-[1240px] px-5 pt-6 sm:px-10">
        <Link
          href="/labs/design/v2/editorial-cinematic"
          className="text-[10.5px] tracking-[0.2em] text-[#241d15]/50 uppercase hover:text-[#9a5f1c]"
        >
          ← Passport
        </Link>
      </div>

      {/* Headline inside the frame, never hanging off its lower edge. */}
      {found.heroUrl && (
        <div className="relative mt-5 h-[44vh] min-h-[260px] w-full overflow-hidden sm:h-[64vh]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted */}
          <img
            src={found.heroUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#241d15]/80 via-[#241d15]/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-[1240px] px-5 pb-6 sm:px-10 sm:pb-9">
              <h1 className="font-heading max-w-[14ch] text-[2.7rem] leading-[0.92] tracking-[-0.035em] text-balance text-[#efe7da] sm:text-[5rem]">
                {found.title}
              </h1>
            </div>
          </div>
        </div>
      )}

      <article className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-10">
        {!found.heroUrl && (
          <h1 className="font-heading mt-10 max-w-[14ch] text-[2.7rem] leading-[0.92] tracking-[-0.035em] text-balance sm:text-[5rem]">
            {found.title}
          </h1>
        )}

        {found.doing.length > 0 && (
          <p className="font-heading mt-5 max-w-[32ch] text-[1.3rem] leading-[1.25] text-[#9a5f1c] sm:text-[1.8rem]">
            {found.doing.join(". ")}.
          </p>
        )}

        <div className="mt-10 grid gap-10 sm:grid-cols-[7fr_4fr] sm:gap-16">
          <div>
            {found.blurb && (
              <p className="max-w-[60ch] text-[16.5px] leading-[1.72] text-[#241d15]/80">
                {found.blurb}
              </p>
            )}
            {found.where && (
              <p className="mt-7 border-t border-[#241d15]/18 pt-4 text-[13px] text-[#241d15]/55">
                {found.where}
              </p>
            )}
          </div>

          {found.facts.length > 0 && (
            <aside>
              <p className="border-b border-[#241d15]/30 pb-2 text-[10px] tracking-[0.2em] text-[#241d15]/50 uppercase">
                What Atlas knows
              </p>
              <dl className="mt-3 flex flex-col gap-3.5">
                {found.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="font-heading text-[13.5px]">{fact.label}</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-[1.55] text-[#241d15]/60">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          )}
        </div>
      </article>
    </main>
  );
}
