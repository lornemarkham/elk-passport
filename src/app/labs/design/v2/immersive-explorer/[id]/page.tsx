import Link from "next/link";
import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

/**
 * **IMMERSIVE EXPLORER — the subject as a place you have arrived at.**
 *
 * Full-height photograph, then the information laid out as a wide band rather
 * than a column: verbs across the top as large type, facts in a three-up row
 * beneath. Horizontal where the feed was horizontal.
 */
export default async function ImmersiveExplorerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await subject(id);
  if (!found) notFound();

  return (
    <main className="min-h-screen bg-[#0e1a1c] text-white">
      <LabNote direction="immersive explorer" tone="dark" />

      <section className="relative h-[62vh] min-h-[360px] w-full overflow-hidden">
        {found.heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={found.heroUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-75"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1a1c] via-[#0e1a1c]/15 to-[#0e1a1c]/55" />

        <div className="absolute inset-x-0 top-0 px-5 pt-5 sm:px-10">
          <Link
            href="/labs/design/v2/immersive-explorer"
            className="text-[11px] tracking-[0.2em] text-white/70 uppercase hover:text-[#7fe3c4]"
          >
            ← Explore
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 sm:px-10 sm:pb-12">
          {(found.place ?? found.area) && (
            <p className="text-[10px] tracking-[0.28em] text-[#7fe3c4] uppercase">
              {found.place ?? found.area}
            </p>
          )}
          <h1 className="font-heading mt-2.5 max-w-[16ch] text-[2.6rem] leading-[0.93] tracking-[-0.03em] text-balance sm:text-[4.6rem]">
            {found.title}
          </h1>
        </div>
      </section>

      {found.doing.length > 0 && (
        <section className="border-b border-white/10 px-5 py-7 sm:px-10">
          <p className="text-[10px] tracking-[0.28em] text-white/40 uppercase">
            What you can do here
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-1.5">
            {found.doing.map((doing) => (
              <li
                key={doing}
                data-testid="explorer-doing"
                className="font-heading text-[1.5rem] leading-tight tracking-[-0.02em] text-[#7fe3c4] first-letter:uppercase sm:text-[2.1rem]"
              >
                {doing}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 py-10 sm:px-10 sm:py-14">
        {found.blurb && (
          <p className="max-w-[66ch] text-[16px] leading-[1.75] text-white/75">
            {found.blurb}
          </p>
        )}

        {found.facts.length > 0 && (
          <dl className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-3">
            {found.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10px] tracking-[0.22em] text-white/40 uppercase">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-[14px] leading-[1.6] text-white/75">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {found.where && (
          <p className="mt-10 border-t border-white/10 pt-5 text-[13px] text-white/45">
            {found.where}
          </p>
        )}
      </section>
    </main>
  );
}
