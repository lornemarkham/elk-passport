import Link from "next/link";
import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

/**
 * **EDITORIAL — the subject as a feature article.**
 *
 * A masthead, a full-bleed opening photograph, a headline set at magazine
 * scale, and then Atlas's sentence in a measured column with the facts beside
 * it as a margin note. The verbs are a standfirst, not chips.
 */
export default async function EditorialDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await subject(id);
  if (!found) notFound();

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#15130f]">
      <LabNote direction="editorial" />

      <div className="mx-auto max-w-[1180px] px-5 pt-8 sm:px-10">
        <Link
          href="/labs/design/editorial"
          className="text-[10.5px] tracking-[0.2em] text-[#15130f]/50 uppercase hover:text-[#a9681f]"
        >
          ← Passport
        </Link>
      </div>

      <article className="mx-auto max-w-[1180px] px-5 pt-7 pb-24 sm:px-10">
        <p className="text-[10.5px] tracking-[0.22em] text-[#a9681f] uppercase">
          {found.kind}
          {found.place ? ` · ${found.place}` : ""}
        </p>
        <h1 className="font-heading mt-3 max-w-[16ch] text-[2.8rem] leading-[0.93] tracking-[-0.035em] text-balance sm:text-[5rem]">
          {found.title}
        </h1>

        {found.doing.length > 0 && (
          <p className="font-heading mt-5 max-w-[34ch] text-[1.35rem] leading-[1.25] text-[#15130f]/60 sm:text-[1.7rem]">
            {found.doing.join(". ")}.
          </p>
        )}

        {found.heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={found.heroUrl}
            alt=""
            className="mt-9 aspect-[3/2] w-full object-cover sm:aspect-[21/9]"
          />
        )}

        <div className="mt-12 grid gap-10 sm:grid-cols-[1fr_280px] sm:gap-16">
          <div>
            {found.blurb && (
              <p className="max-w-[62ch] text-[17px] leading-[1.7] first-letter:float-left first-letter:mt-1.5 first-letter:mr-2.5 first-letter:text-[4rem] first-letter:leading-[0.78] first-letter:font-[var(--font-fraunces)] first-letter:text-[#a9681f]">
                {found.blurb}
              </p>
            )}
            {found.where && (
              <p className="mt-8 border-t border-[#15130f]/15 pt-4 text-[13px] text-[#15130f]/60">
                {found.where}
              </p>
            )}
          </div>

          {/* The margin note: Atlas's own key facts, label and value, unedited. */}
          {found.facts.length > 0 && (
            <aside className="border-t-2 border-[#15130f] pt-4">
              <p className="text-[10px] tracking-[0.2em] text-[#15130f]/50 uppercase">
                What is known
              </p>
              <dl className="mt-3 flex flex-col gap-3">
                {found.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="font-heading text-[13px] text-[#15130f]">
                      {fact.label}
                    </dt>
                    <dd className="mt-0.5 text-[12.5px] leading-[1.55] text-[#15130f]/60">
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
