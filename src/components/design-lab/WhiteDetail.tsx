import Link from "next/link";
import type { Subject } from "@/lib/design-lab/sample";

/**
 * **One subject on white, in three arrangements.**
 *
 * Round three's directions differ in how they *compose a page of many things*;
 * a single subject is the same problem for all three, so they share this and
 * vary the opening. Duplicating it three times would be three places for the
 * same evidence rule to drift.
 */
export function WhiteDetail({
  subject,
  back,
  backLabel,
  /** `band` runs the photograph full-bleed; `plate` insets it beside the text. */
  opening = "band",
}: {
  readonly subject: Subject;
  readonly back: string;
  readonly backLabel: string;
  readonly opening?: "band" | "plate";
}) {
  const meta = [
    subject.place ?? subject.area,
    subject.recurs,
    subject.startTime ? dated(subject.startTime) : undefined,
  ].filter(Boolean);

  return (
    <>
      <div className="mx-auto max-w-[1680px] px-5 pt-5 sm:px-10">
        <Link
          href={back}
          className="text-[14px] font-semibold text-black/45 hover:text-black"
        >
          ← {backLabel}
        </Link>
      </div>

      {opening === "band" ? (
        <>
          {subject.heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
            <img
              src={subject.heroUrl}
              alt=""
              className="mt-5 aspect-[16/10] w-full object-cover sm:aspect-[21/9]"
            />
          ) : (
            <div className="mt-5 border-t border-black/15" />
          )}
          <header className="mx-auto max-w-[1680px] px-5 pt-7 sm:px-10">
            <h1 className="max-w-[18ch] text-[36px] leading-[0.94] font-bold tracking-[-0.045em] text-balance sm:text-[76px]">
              {subject.title}
            </h1>
            {meta.length > 0 && (
              <p className="mt-3 text-[15px] text-black/45">
                {meta.join("  ·  ")}
              </p>
            )}
          </header>
        </>
      ) : (
        <header className="mx-auto grid max-w-[1680px] gap-7 px-5 pt-8 sm:grid-cols-[1fr_1fr] sm:gap-14 sm:px-10">
          <div>
            <h1 className="max-w-[16ch] text-[36px] leading-[0.94] font-bold tracking-[-0.045em] text-balance sm:text-[68px]">
              {subject.title}
            </h1>
            {meta.length > 0 && (
              <p className="mt-3 text-[15px] text-black/45">
                {meta.join("  ·  ")}
              </p>
            )}
          </div>
          {subject.heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
            <img
              src={subject.heroUrl}
              alt=""
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-end border-t border-black/15 p-4 text-[13px] text-black/35">
              No photograph
            </div>
          )}
        </header>
      )}

      <section className="mx-auto max-w-[1680px] px-5 pt-10 pb-24 sm:px-10 sm:pt-14">
        <div className="grid gap-10 sm:grid-cols-[1.15fr_1fr] sm:gap-16">
          <div>
            {subject.doing.length > 0 && (
              <>
                <h2 className="text-[12px] font-semibold tracking-[0.1em] text-black/35 uppercase">
                  What Atlas says you can do here
                </h2>
                <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-1">
                  {subject.doing.map((doing) => (
                    <li
                      key={doing}
                      data-testid="white-doing"
                      className="text-[22px] font-bold tracking-[-0.03em] first-letter:uppercase sm:text-[30px]"
                    >
                      {doing}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {subject.blurb && (
              <p
                className={
                  "mt-8 max-w-[64ch] leading-[1.7] " +
                  (subject.weakBlurb
                    ? "text-[14px] text-black/40"
                    : "text-[17px] text-black/70")
                }
              >
                {subject.blurb}
              </p>
            )}
            {/* Atlas says when its own sentence merely narrates a passing
                mention. Demoted, and said — not quietly deleted. */}
            {subject.weakBlurb && (
              <p className="mt-1.5 text-[12px] text-black/30">
                Atlas says this sentence adds little about the place itself.
              </p>
            )}
          </div>

          {subject.facts.length > 0 && (
            <dl className="flex flex-col divide-y divide-black/10 border-t border-black/15">
              {subject.facts.map((fact) => (
                <div key={fact.label} className="py-4">
                  <dt className="text-[12px] font-semibold tracking-[0.08em] text-black/35 uppercase">
                    {fact.label}
                  </dt>
                  <dd className="mt-1.5 text-[15px] leading-[1.6] text-black/70">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {subject.where && (
          <p className="mt-12 border-t border-black/10 pt-5 text-[14px] text-black/40">
            {subject.where}
          </p>
        )}
      </section>
    </>
  );
}

/** Atlas's stated start, in the reader's words. Never invented. */
function dated(startTime: string): string | undefined {
  const at = Date.parse(startTime);
  if (Number.isNaN(at)) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Vancouver",
  }).format(new Date(at));
}
