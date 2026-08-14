/**
 * Which workspace gaps Atlas can actually be sent to research.
 *
 * ## Why this is a fallback rather than the answer
 *
 * The list Atlas actually holds is served from `/admin/research-topics` and
 * fetched alongside the missions. This file exists so a rendering component
 * can answer *"is this gap actionable?"* synchronously, and so the page
 * still behaves sensibly if Atlas is unreachable.
 *
 * The previous version was a hardcoded set of one, which was honest at one
 * topic and becomes a drift hazard at twenty: a button drawn for a topic
 * Atlas has no profile for is a button that 400s on click.
 *
 * ## The two gaps that deliberately have no button
 *
 * - **`local-tips`** — ADR 020. Local knowledge needs repeated independent
 *   observation, not one source. A mission would find a marketing page
 *   calling itself a hidden gem and record it as one.
 * - **`relationships`** — connecting entities is containment and the
 *   near-relationship computation, not reading a page. One label over two
 *   unrelated mechanisms would be a lie about what the button does.
 *
 * Both still render as named gaps, stating what they honestly are.
 */

/**
 * Mirrors `RESEARCH_TOPIC_IDS` in
 * `atlas/src/application/research/ResearchTopic.ts`.
 *
 * Used only when Atlas has not answered. When it has, the served list wins
 * — so drift shows up as a missing button rather than a broken one, which
 * is the safe direction for this to fail.
 */
const KNOWN_TOPICS: readonly string[] = [
  "overview",
  "hours",
  "contact",
  "location",
  "food",
  "menus",
  "prices",
  "policies",
  "activities",
  "facilities",
  "accommodation",
  "events",
  "media",
  "accessibility",
  "getting-there",
  "family",
  "winter",
  "summer",
  "seasonal",
  "history",
];

export function isResearchable(
  sectionId: string,
  servedTopics?: readonly string[],
): boolean {
  const topics =
    servedTopics && servedTopics.length > 0 ? servedTopics : KNOWN_TOPICS;
  return topics.includes(sectionId);
}
