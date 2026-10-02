import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { keptOnThisPage } from "@/lib/october/keptOnThisPage";
import { doingById } from "@/lib/making/catalogue";
import { SaveToOctober } from "@/components/october/detail/SaveToOctober";
import { keepableDoing } from "@/components/october/make/keepableDoing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const doing = doingById((await params).slug);
  return { title: doing ? `${doing.title} — October` : "Make — October" };
}

/**
 * **Enough to get from "that looks good" to "we could actually do that".**
 *
 * Not a detail page in the reference sense and deliberately short: a picture,
 * the hook, what you need, the one piece of advice that changes the result,
 * and a couple of ways to push it further. No numbered steps, no materials
 * table, no printable version — the moment this becomes an instruction manual
 * it stops being October and becomes a craft site.
 *
 * Save sits at the top, beside the title, because deciding to do a thing and
 * reading how to do it are different acts and the first must not require the
 * second.
 */
export default async function DoingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const doing = doingById((await params).slug);
  if (!doing) notFound();
  const page = await keptOnThisPage();
  const detail = doing.detail;

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-3xl px-5 pt-6 pb-24 sm:px-6">
        <Link
          href="/october/make"
          className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:underline"
        >
          ← Make something
        </Link>

        {doing.image ? (
          <figure className="mt-3 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doing.image.src}
              alt={doing.image.alt}
              className="aspect-[16/10] w-full object-cover"
            />
            {/* The licence requires this, so it is rendered rather than
                remembered — and it says whose it is, never that it is yours. */}
            <figcaption className="mt-1.5 text-[11px] text-[#e9e6da]/25">
              <a
                href={doing.image.page}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {doing.image.credit} · {doing.image.licence}
              </a>
            </figcaption>
          </figure>
        ) : null}

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl leading-tight tracking-tight text-[#f3efe4] sm:text-4xl">
              {doing.title}
            </h1>
            {detail ? (
              <p className="mt-2 max-w-lg text-lg text-[#e9e6da]/70">
                {detail.hook}
              </p>
            ) : (
              <p className="mt-2 max-w-lg text-lg text-[#e9e6da]/70">
                {doing.line}
              </p>
            )}
          </div>
          <SaveToOctober
            entityId={doing.id}
            entityKind="Doing"
            name={keepableDoing(doing).name}
            startsAt={null}
            initiallySaved={page.kept.has(doing.id)}
            signedIn={page.signedIn}
            returnTo={`/october/make/${doing.id}`}
          />
        </header>

        {detail ? (
          <>
            {/* `doing.line` is deliberately not repeated here. It is the card's
                sentence, and the hook is usually drawn from it — printing both
                put the same clause on screen twice, six lines apart. What the
                line carried that the hook did not was the materials, and those
                are right below in a form you can actually check against a
                cupboard. */}
            <section className="mt-8" data-testid="doing-need">
              <h2 className="text-[11px] tracking-[0.2em] text-[#d09a4e] uppercase">
                What you need
              </h2>
              <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-2">
                {detail.need.map((item) => (
                  <li
                    key={item}
                    className="rounded-full bg-[#e9e6da]/[0.06] px-3 py-1 text-sm text-[#e9e6da]/70"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="mt-9 border-l-2 border-[#d09a4e]/50 pl-4"
              data-testid="doing-trick"
            >
              <h2 className="text-[11px] tracking-[0.2em] text-[#d09a4e] uppercase">
                The trick
              </h2>
              <p className="font-heading mt-1 text-xl text-[#f3efe4]">
                {detail.trick.title}
              </p>
              <p className="mt-1 leading-relaxed text-[#e9e6da]/70">
                {detail.trick.body}
              </p>
            </section>

            {detail.tryThis ? (
              <section className="mt-9" data-testid="doing-try">
                <h2 className="text-[11px] tracking-[0.2em] text-[#d09a4e] uppercase">
                  Try this
                </h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {detail.tryThis.map((idea) => (
                    // Grid rather than a ::before, so the second line of a
                    // wrapping idea hangs under the first instead of sliding
                    // back under the dash.
                    <li
                      key={idea}
                      className="grid grid-cols-[auto_1fr] gap-x-2 leading-relaxed text-[#e9e6da]/65"
                    >
                      <span aria-hidden className="text-[#d09a4e]/60">
                        —
                      </span>
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <ul
              className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#e9e6da]/10 pt-5 text-sm text-[#e9e6da]/45"
              data-testid="doing-facts"
            >
              {detail.time ? <li>{detail.time}</li> : null}
              {detail.mess ? <li>{detail.mess} mess</li> : null}
              {detail.withAnAdult ? <li>Better with an adult</li> : null}
              {doing.withKids ? <li>Small hands welcome</li> : null}
            </ul>
          </>
        ) : (
          <p className="mt-6 text-sm text-[#e9e6da]/45">
            A good idea, and that is all this one is so far. Save it and work
            the rest out on the night.
          </p>
        )}
      </div>
    </main>
  );
}
