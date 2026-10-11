import Link from "next/link";
import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

/**
 * **CINEMATIC — the subject as a place you are standing in.**
 *
 * The photograph fills the screen and the page scrolls up over it. Facts
 * arrive as a quiet dark panel underneath, so the emotional register belongs
 * to the image and the information belongs to the type.
 */
export default async function CinematicDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await subject(id);
  if (!found) notFound();

  return (
    <main className="min-h-screen bg-[#0b0d0c] text-white">
      <LabNote direction="cinematic" tone="dark" />

      <section className="relative h-[72vh] min-h-[420px] w-full overflow-hidden">
        {found.heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={found.heroUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d0c] via-[#0b0d0c]/30 to-black/35" />

        <div className="absolute inset-x-0 top-0 px-5 pt-5 sm:px-12">
          <Link
            href="/labs/design/cinematic"
            className="text-[11px] tracking-[0.2em] text-white/65 uppercase hover:text-white"
          >
            ← Back
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-5 pb-10 sm:px-12 sm:pb-14">
          {(found.place ?? found.area) && (
            <p className="text-[10px] tracking-[0.3em] text-white/60 uppercase">
              {found.place ?? found.area}
            </p>
          )}
          <h1 className="font-heading mt-3 max-w-[15ch] text-[3rem] leading-[0.92] tracking-[-0.03em] text-balance sm:text-[5.5rem]">
            {found.title}
          </h1>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-12 sm:py-20">
        <div className="grid gap-10 sm:grid-cols-[1.1fr_1fr] sm:gap-16">
          <div>
            {found.doing.length > 0 && (
              <>
                <p className="text-[10px] tracking-[0.3em] text-white/40 uppercase">
                  What you can do here
                </p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {found.doing.map((doing) => (
                    <li
                      key={doing}
                      className="font-heading text-[1.6rem] leading-tight tracking-[-0.02em] text-[#ff9d5c] first-letter:uppercase sm:text-[2.1rem]"
                    >
                      {doing}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {found.blurb && (
              <p className="mt-8 max-w-[58ch] text-[15.5px] leading-[1.75] text-white/70">
                {found.blurb}
              </p>
            )}
          </div>

          {found.facts.length > 0 && (
            <dl className="flex flex-col divide-y divide-white/10 border-t border-white/10">
              {found.facts.map((fact) => (
                <div key={fact.label} className="py-4">
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
        </div>

        {found.where && (
          <p className="mt-12 border-t border-white/10 pt-5 text-[13px] text-white/45">
            {found.where}
          </p>
        )}
      </section>
    </main>
  );
}
