import type { Metadata } from "next";
import Link from "next/link";
import { keptOnThisPage } from "@/lib/october/keptOnThisPage";
import { MAKING, SHELVES, doingsOnShelf } from "@/lib/making/catalogue";
import { DoingTile } from "@/components/october/make/DoingTile";
import { DoingCard } from "@/components/october/make/DoingCard";

export const metadata: Metadata = { title: "Make something — October" };

/**
 * **"What should we make this October?" — not "here are 26 records".**
 *
 * The first version was a three-column grid of equal text cards, and it read
 * exactly like what it was: a well-written database. Two things changed.
 *
 * **Weight.** Eight Doings carry a photograph and an opened-up page; they
 * lead each shelf, one of them large. The other eighteen are still here,
 * lower down, as the light rows they always were — good ideas worth saving
 * without pretending each one is a project.
 *
 * **Somewhere to go.** A tile opens the thing, which is the change that makes
 * a picture worth having: inspiration is only useful if the next tap tells
 * you how.
 */
export default async function MakePage() {
  const page = await keptOnThisPage();
  const enriched = MAKING.filter((d) => d.detail);

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
        <header>
          <p className="text-sm font-medium text-[#d09a4e]">October 2026</p>
          <h1 className="font-heading mt-1 text-4xl font-semibold tracking-tight text-[#f3efe4] sm:text-5xl">
            Make something
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#e9e6da]/50">
            {MAKING.length} things worth an evening. Save one and it goes into
            your October next to everything else — no date needed until you want
            one.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-14">
          {SHELVES.map((shelf) => {
            const all = doingsOnShelf(shelf.id);
            const featured = all.filter((d) => d.detail);
            const rest = all.filter((d) => !d.detail);
            if (all.length === 0) return null;
            // The large slot goes to a photograph if the shelf has one. Leading
            // with the wordiest tile and demoting the picture beside it reads
            // as an accident, and on this page it was one.
            const lead = featured.find((d) => d.image) ?? featured[0];
            const supporting = featured.filter((d) => d !== lead);

            return (
              <section
                key={shelf.id}
                data-testid="make-shelf"
                data-shelf={shelf.id}
              >
                <h2 className="font-heading text-2xl text-[#f3efe4]">
                  {shelf.title}
                </h2>
                <p className="mt-0.5 text-sm text-[#e9e6da]/45">{shelf.line}</p>

                {lead ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    {/* One thing is large. A shelf where everything is the
                        same size is a shelf with no opinion. */}
                    <div
                      className={
                        // A shelf with nothing to put beside the lead gets the
                        // whole width rather than a column of empty page.
                        supporting.length > 0
                          ? "lg:col-span-2"
                          : "lg:col-span-3"
                      }
                    >
                      <DoingTile
                        doing={lead}
                        saved={page.kept.has(lead.id)}
                        signedIn={page.signedIn}
                        lead
                      />
                    </div>
                    {supporting.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {supporting.map((doing) => (
                          <DoingTile
                            key={doing.id}
                            doing={doing}
                            saved={page.kept.has(doing.id)}
                            signedIn={page.signedIn}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {rest.length > 0 ? (
                  // Folded, not dropped. Eighteen more good ideas laid out
                  // flat is the wall of text this page was; one line per shelf
                  // keeps them a tap away without making you scroll past them
                  // to reach the next photograph.
                  <details className="group/more mt-4" data-testid="make-more">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/70 hover:underline">
                      {rest.length} more on this shelf
                      <span className="ml-2 text-[#d09a4e]/70 transition-transform group-open/more:rotate-90">
                        ›
                      </span>
                    </summary>
                    <ul
                      data-testid="make-light"
                      className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {rest.map((doing) => (
                        <li key={doing.id} className="flex">
                          <DoingCard
                            doing={doing}
                            saved={page.kept.has(doing.id)}
                            signedIn={page.signedIn}
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>
            );
          })}
        </div>

        <p className="mt-14 text-sm text-[#e9e6da]/35">
          {enriched.length} of these are opened up with what you need and the
          one trick that matters. The rest are ideas worth keeping.
        </p>

        <Link
          href="/october/mine"
          className="mt-4 inline-flex min-h-11 items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:underline"
        >
          My October
        </Link>
      </div>
    </main>
  );
}
