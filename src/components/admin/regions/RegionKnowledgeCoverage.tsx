import { BookOpen, HelpCircle, Layers } from "lucide-react";
import type { RegionCoverage } from "@/lib/knowledge/regionCoverage";
import type { CategoryOpportunities } from "@/lib/knowledge/sourceOpportunities";

/**
 * **What this region holds, by category — and what Atlas would have to
 * read to know whether that is a lot or a little.**
 *
 * ## The empty column is the honest part
 *
 * Every row shows a real count and an explicitly absent denominator.
 * Atlas knows it holds four lakes. **Nothing it holds says how many lakes
 * there are**, so there is no percentage, no bar, and no "62% covered".
 *
 * > A coverage figure with an invented denominator is a claim about the
 * > world that Atlas made up, and a curator would plan around it. The
 * > empty column is not a gap in the feature — **it is the feature**.
 *
 * ## Which is why the next column names a publisher
 *
 * The fix for an unknown denominator is not a better estimate. It is an
 * **authoritative register** — a body that publishes the list and is
 * definitionally complete for its own domain. So every row ends in the
 * source that would answer it, and the section below turns the thinnest
 * categories into a reading list.
 *
 * **Atlas becomes smart because its evidence becomes richer, not because
 * its inference becomes cleverer.**
 */
export function RegionKnowledgeCoverage({
  regionName,
  coverage,
  opportunities,
}: {
  regionName: string;
  coverage: RegionCoverage;
  opportunities: readonly CategoryOpportunities[];
}) {
  if (coverage.total === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-4 w-4" />
          What {regionName} holds
        </h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-[13px] leading-relaxed">
          A count of what Atlas has, by category. There is no coverage
          percentage because <strong>Atlas has no denominator</strong> — it
          knows what it holds, and nothing it holds says how many exist. The
          right-hand column names the publisher who would know.
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-xl border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="w-24 px-4 py-2.5 text-right font-medium">
                Atlas holds
              </th>
              <th className="w-28 px-4 py-2.5 text-right font-medium">
                Exist in {regionName}
              </th>
              <th className="px-4 py-2.5 font-medium">
                What would answer that
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {coverage.categories.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-medium">{c.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {c.known}
                </td>
                <td className="text-muted-foreground px-4 py-2.5 text-right">
                  {/* Never a number. See the module docstring. */}
                  <span className="inline-flex items-center gap-1">
                    <HelpCircle className="h-3.5 w-3.5" />
                    unknown
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-2.5 leading-relaxed">
                  {c.wouldNeed}
                </td>
              </tr>
            ))}
            {coverage.uncategorised > 0 && (
              <tr className="bg-muted/20">
                <td className="text-muted-foreground px-4 py-2.5 italic">
                  Uncategorised
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {coverage.uncategorised}
                </td>
                <td className="text-muted-foreground px-4 py-2.5 text-right">
                  —
                </td>
                <td className="text-muted-foreground px-4 py-2.5 leading-relaxed">
                  Matched no category. Reported rather than dropped — a list
                  that quietly loses entities makes a region look tidier than it
                  is.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {opportunities.length > 0 && (
        <div className="border-border rounded-xl border">
          <div className="border-border border-b px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4" />
              Where Atlas should read next
            </h3>
            <p className="text-muted-foreground mt-1 max-w-3xl text-[13px] leading-relaxed">
              The categories Atlas holds least of, and the publishers who would
              fix that. Nothing here has been fetched or queued — it is a
              reading list, and acting on it is your call.
            </p>
          </div>
          <div className="divide-border divide-y">
            {opportunities.map((cat) => (
              <div key={cat.categoryId} className="px-5 py-4">
                <p className="text-sm font-medium">
                  {cat.categoryLabel}
                  <span className="text-muted-foreground ml-2 font-normal">
                    Atlas holds {cat.known}
                  </span>
                </p>
                <ul className="mt-2.5 space-y-2.5">
                  {cat.opportunities.map((o) => (
                    <li key={o.publisher + o.what} className="flex gap-2.5">
                      <span className="bg-muted-foreground/40 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                      <span className="min-w-0">
                        <span className="text-[13px] font-medium">
                          {o.publisher}
                        </span>
                        <span className="text-muted-foreground text-[13px]">
                          {" "}
                          — {o.what}
                        </span>
                        {/* A URL Atlas has not fetched is a URL Atlas is
                            guessing at. The distinction is stated, never
                            implied by the presence of a link. */}
                        {o.urlVerified && o.url ? (
                          <a
                            href={o.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground mt-0.5 block truncate text-[12px] underline underline-offset-2"
                          >
                            {o.url}
                            <span className="ml-1.5 no-underline">
                              · fetched {o.verifiedOn}
                            </span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground/70 mt-0.5 block text-[12px]">
                            Atlas has not fetched an address for this publisher
                            — find and confirm it before queueing.
                          </span>
                        )}
                        <span className="text-muted-foreground/80 mt-0.5 block text-[12px] leading-relaxed">
                          {o.why}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
