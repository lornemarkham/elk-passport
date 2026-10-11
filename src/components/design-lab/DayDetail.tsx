import Link from "next/link";
import type { Subject } from "@/lib/design-lab/sample";
import { ACCENT, Wordmark } from "@/components/design-lab/brand";

/**
 * **One subject, in a layout built for what is coming rather than what is here.**
 *
 * Atlas holds a sentence, a handful of verbs and a few free-text facts today.
 * It will hold galleries, schedules, prices, maps, related subjects and
 * events. A detail page designed around today's thin content would have to be
 * rebuilt the week any of that lands, so this is a **stack of independent
 * sections**, each of which renders only when it has evidence:
 *
 * ```
 * title band       always
 * photography      one plate now; a gallery later, same slot, same width
 * what you can do  Atlas's verbs
 * about            Atlas's sentence, demoted when Atlas says it is weak
 * practical        free-text key facts as a definition list
 * when             dates and recurrence
 * where            the stated venue and town
 * ── everything below is a slot that is empty today, and says so ──
 * ```
 *
 * The empty slots are **shown, not hidden**: a faint line naming what Atlas
 * does not hold yet. That is the opposite of a mockup that invents a map and a
 * price to look finished, and it means the page's proportions are already the
 * ones it will have when the evidence arrives.
 */
export function DayDetail({
  subject,
  back,
  backLabel,
}: {
  readonly subject: Subject;
  readonly back: string;
  readonly backLabel: string;
}) {
  const when = [
    subject.recurs,
    subject.startTime ? stated(subject.startTime) : undefined,
  ].filter(Boolean);

  return (
    <>
      <header className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-5 sm:px-10">
        <Wordmark href={back} />
        <Link
          href={back}
          className="text-[13px] font-semibold text-black/45 hover:text-black"
        >
          ← {backLabel}
        </Link>
      </header>

      <section className="mx-auto max-w-[1800px] px-5 pt-2 sm:px-10">
        <h1 className="max-w-[17ch] text-[40px] leading-[0.88] font-extrabold tracking-[-0.05em] text-balance uppercase sm:text-[104px]">
          {subject.title}
        </h1>
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] font-semibold text-black/45">
          {(subject.place ?? subject.area) && (
            <span>{subject.place ?? subject.area}</span>
          )}
          <span className="text-black/30">{subject.kind}</span>
          {subject.audience?.adultsOnly && (
            <span data-testid="detail-adults" style={{ color: ACCENT }}>
              Adults only
            </span>
          )}
        </p>
      </section>

      {/* The photography slot. One plate today at the width a gallery will
          use, so nothing moves when more than one arrives. */}
      <section className="mt-7 sm:mt-10">
        {subject.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={subject.heroUrl}
            alt=""
            className="aspect-[4/5] w-full object-cover sm:aspect-[21/9]"
          />
        ) : (
          <div className="mx-auto max-w-[1800px] px-5 sm:px-10">
            <div className="flex aspect-[16/9] items-end border-t border-black/15 p-5 text-[13px] text-black/35 sm:aspect-[21/9]">
              Atlas holds no photograph it will vouch for. We will not borrow
              one.
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1800px] px-5 pt-10 pb-24 sm:px-10 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          <div>
            {subject.doing.length > 0 && (
              <Block title="What you can do here">
                <ul className="flex flex-wrap gap-x-8 gap-y-1.5">
                  {subject.doing.map((doing) => (
                    <li
                      key={doing}
                      data-testid="detail-doing"
                      className="text-[24px] font-extrabold tracking-[-0.035em] first-letter:uppercase sm:text-[34px]"
                    >
                      {doing}
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {subject.blurb && (
              <Block title="About">
                <p
                  className={
                    "max-w-[64ch] leading-[1.7] " +
                    (subject.weakBlurb
                      ? "text-[14px] text-black/40"
                      : "text-[17px] text-black/75 sm:text-[19px]")
                  }
                >
                  {subject.blurb}
                </p>
                {subject.weakBlurb && (
                  <p className="mt-1.5 text-[12px] text-black/30">
                    Atlas says this sentence adds little about the place itself.
                  </p>
                )}
              </Block>
            )}

            {subject.audience?.says && (
              <Block title="Who it is for">
                <p className="max-w-[64ch] text-[15px] leading-[1.65] text-black/60">
                  “{subject.audience.says}”
                </p>
              </Block>
            )}
          </div>

          <div>
            {when.length > 0 && (
              <Block title="When">
                <p className="text-[20px] font-bold tracking-[-0.02em] sm:text-[24px]">
                  {when.join(" · ")}
                </p>
              </Block>
            )}

            {subject.facts.length > 0 && (
              <Block title="Practical">
                <dl className="flex flex-col divide-y divide-black/10 border-t border-black/15">
                  {subject.facts.map((fact) => (
                    <div key={fact.label} className="py-3.5">
                      <dt className="text-[11px] font-semibold tracking-[0.1em] text-black/35 uppercase">
                        {fact.label}
                      </dt>
                      <dd className="mt-1 text-[15px] leading-[1.6] text-black/70">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Block>
            )}

            {subject.where && (
              <Block title="Where">
                <p className="text-[15px] leading-[1.6] text-black/60">
                  {subject.where}
                </p>
              </Block>
            )}
          </div>
        </div>

        {/* **The slots that are empty today.** Named rather than hidden, so
            the page already has the shape it will have when Atlas fills them
            — and so nobody mistakes a thin page for a finished one. */}
        <div className="mt-16 border-t border-black/10 pt-6">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-black/30 uppercase">
            Not yet held for this subject
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-1.5">
            {[
              "More photographs",
              "Opening hours",
              "Prices",
              "A map",
              "Events here",
              "Nearby subjects",
            ].map((slot) => (
              <li
                key={slot}
                data-testid="detail-slot"
                className="text-[14px] text-black/30"
              >
                {slot}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function Block({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-black/35 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Atlas's stated start, in the reader's words. Never invented. */
function stated(startTime: string): string | undefined {
  const at = Date.parse(startTime);
  if (Number.isNaN(at)) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Vancouver",
  }).format(new Date(at));
}
