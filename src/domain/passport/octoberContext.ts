import { isCurated } from "@/lib/passport/curation/october2026";
import type { SubjectPageView } from "@/lib/passport/subjectPage";

/**
 * **Is this subject part of October?**
 *
 * Answered from the subject itself, on the server, every time — not from a
 * referrer, a query string or browser history. Clicking an October card and
 * landing on a cream Passport dossier was the break; so was arriving at the
 * same page from a bookmark and getting a different product.
 *
 * Two ways in, both explicit:
 *
 * ```
 * curated   a human listed it in the launch register (october2026.ts)
 * dated     its own evidence puts it inside October
 * ```
 *
 * The second matters because October Discovery surfaces far more than the
 * curated few, and every one of those is something a person reached *through
 * October*. Neither test depends on how the page was reached, so the context
 * survives a refresh, a share and a back button.
 *
 * A Place a person found through search in July is not October and keeps its
 * ordinary Passport presentation. This is contextual, not a global repaint.
 */
export function isOctoberSubject(view: SubjectPageView): boolean {
  if (isCurated(view.subject.id)) return true;
  return datedInOctober(view);
}

/** October of whichever year the subject's own evidence names. */
function datedInOctober(view: SubjectPageView): boolean {
  const days = [
    ...view.subject.days,
    ...view.parts.flatMap((p) => p.days),
    ...view.offerings.flatMap((o) => [
      ...o.subject.days,
      ...o.parts.flatMap((p) => p.days),
    ]),
  ];
  if (days.some(isOctoberDay)) return true;

  // An Event carries an interval rather than stated days. It is October's if
  // any part of its run falls inside the month — a festival that opens in
  // September and closes in October is something October can offer.
  const start = view.subject.startTime;
  const end = view.subject.endTime ?? start;
  if (!start || !end) return false;
  const from = start.slice(0, 10);
  const to = end.slice(0, 10);
  const year = Number(from.slice(0, 4));
  for (const y of [year, year + 1]) {
    const octoberFrom = `${y}-10-01`;
    const octoberTo = `${y}-10-31`;
    if (from <= octoberTo && to >= octoberFrom) return true;
  }
  return false;
}

const isOctoberDay = (day: string): boolean => day.slice(5, 7) === "10";
