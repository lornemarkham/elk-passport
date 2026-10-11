import Link from "next/link";
import { notFound } from "next/navigation";
import { subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { colourOf } from "@/components/design-lab/playfulPalette";

/**
 * **PLAYFUL — the subject as a thing you could go and do.**
 *
 * A colour block the width of the page carrying the name, the photograph
 * framed like an object, the verbs as big tappable blocks, and the facts as
 * plain rows. Everything is at least 44px and reads at arm's length in a car
 * park.
 */
export default async function PlayfulDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await subject(id);
  if (!found) notFound();

  const colour = found.doing[0]
    ? colourOf(found.doing[0])
    : { bg: "#1f1a16", ink: "#fff6e9" };

  return (
    <main className="min-h-screen bg-[#fff6e9] text-[#1f1a16]">
      <LabNote direction="playful" />

      <div className="mx-auto max-w-[1180px] px-5 pt-5 sm:px-10">
        <Link
          href="/labs/design/playful"
          className="inline-flex min-h-11 items-center text-[14px] font-bold text-[#1f1a16]/60 hover:text-[#1f1a16]"
        >
          ← All ideas
        </Link>
      </div>

      <section className="mx-auto max-w-[1180px] px-5 sm:px-10">
        <div
          style={{ backgroundColor: colour.bg, color: colour.ink }}
          className="rounded-[30px] border-[3px] border-[#1f1a16] p-6 shadow-[6px_7px_0_0_#1f1a16] sm:p-10"
        >
          {(found.place ?? found.area) && (
            <p className="text-[12px] font-bold tracking-wide uppercase opacity-75">
              {found.place ?? found.area}
            </p>
          )}
          <h1 className="mt-2 max-w-[18ch] font-sans text-[2.3rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance sm:text-[3.6rem]">
            {found.title}
          </h1>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[1.15fr_1fr] sm:gap-9">
          <div>
            {found.heroUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
              <img
                src={found.heroUrl}
                alt=""
                className="aspect-[5/4] w-full rounded-[26px] border-[3px] border-[#1f1a16] object-cover shadow-[5px_6px_0_0_#1f1a16]"
              />
            )}
            {found.blurb && (
              <p className="mt-5 text-[15.5px] leading-[1.65] text-[#1f1a16]/75">
                {found.blurb}
              </p>
            )}
          </div>

          <div>
            {found.doing.length > 0 && (
              <>
                <h2 className="font-sans text-[13px] font-bold tracking-wide text-[#1f1a16]/55 uppercase">
                  Things you can do here
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {found.doing.map((doing) => {
                    const tone = colourOf(doing);
                    return (
                      <li
                        key={doing}
                        data-testid="playful-doing"
                        style={{ backgroundColor: tone.bg, color: tone.ink }}
                        className="min-h-12 rounded-2xl px-4 py-3 text-[1.05rem] font-extrabold first-letter:uppercase"
                      >
                        {doing}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {found.facts.length > 0 && (
              <>
                <h2 className="mt-7 font-sans text-[13px] font-bold tracking-wide text-[#1f1a16]/55 uppercase">
                  Good to know
                </h2>
                <dl className="mt-3 flex flex-col gap-2">
                  {found.facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="rounded-2xl border-[2.5px] border-[#1f1a16]/15 bg-white px-4 py-3"
                    >
                      <dt className="text-[12.5px] font-bold text-[#1f1a16]/60">
                        {fact.label}
                      </dt>
                      <dd className="mt-0.5 text-[14px] leading-[1.5]">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>

        {found.where && (
          <p className="mt-8 pb-16 text-[14px] font-semibold text-[#1f1a16]/55">
            {found.where}
          </p>
        )}
      </section>
    </main>
  );
}
