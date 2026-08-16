import { ArrowRight, BookOpen, HelpCircle, Layers } from "lucide-react";
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
          How well does Atlas know {regionName}?
        </h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-[13px] leading-relaxed">
          What it holds, by category. There is no percentage because{" "}
          <strong>nothing Atlas has read says how many exist</strong> — so the
          last column names who would know.
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
                  that quietly loses places makes a region look tidier than it
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
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="h-4 w-4" />
              If Atlas read one more thing
            </h3>
            <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed">
              The thinnest categories, and what each publisher would actually
              change. Nothing here is fetched or queued — reading it is your
              call.
            </p>
          </div>
          <div className="divide-border divide-y">
            {opportunities.map((cat) => (
              <div key={cat.categoryId} className="px-5 py-4">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold">{cat.categoryLabel}</span>
                  <span className="text-muted-foreground text-[13px]">
                    {cat.known === 0
                      ? "Atlas holds none"
                      : `Atlas holds ${cat.known}`}
                  </span>
                </p>
                <div className="mt-3 space-y-3">
                  {cat.opportunities.map((o) => (
                    <div
                      key={o.publisher + o.what}
                      className="border-border rounded-lg border px-4 py-3"
                    >
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13px] font-semibold">
                          {o.publisher}
                        </span>
                        {/* Register vs directory is not a label — it decides
                            whether reading it can produce a denominator. */}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase ${
                            o.kind === "register"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {o.kind}
                        </span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[13px]">
                        {o.what}
                      </p>

                      <p className="mt-2.5 text-[12px] font-medium">
                        What this would unlock
                      </p>
                      <ul className="mt-1 space-y-1">
                        {o.unlocks.map((u) => (
                          <li
                            key={u}
                            className="flex gap-2 text-[12px] leading-relaxed"
                          >
                            <ArrowRight className="text-primary mt-0.5 h-3 w-3 shrink-0" />
                            <span>{u}</span>
                          </li>
                        ))}
                      </ul>

                      {o.kind === "register" && (
                        <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
                          A register is complete for its own domain, so reading
                          it would give this category a real denominator for the
                          first time.
                        </p>
                      )}

                      {o.urlVerified && o.url ? (
                        <a
                          href={o.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground mt-2 block truncate text-[12px] underline underline-offset-2"
                        >
                          {o.url}
                          <span className="ml-1.5 no-underline">
                            · Atlas fetched this {o.verifiedOn}
                          </span>
                        </a>
                      ) : (
                        <p className="text-muted-foreground/70 mt-2 text-[12px]">
                          Atlas has not fetched an address for this publisher —
                          confirm it before queueing.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
