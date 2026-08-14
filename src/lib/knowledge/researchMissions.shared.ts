/**
 * Which workspace gaps Atlas can actually be sent to research.
 *
 * Separate from `researchMissions.ts` because that file is `server-only`
 * and this answers a question a rendering component asks. Keeping them
 * apart is what lets the template ask *"is this gap actionable?"* without
 * dragging an Atlas HTTP client into the component tree.
 *
 * ## Phase 1 has exactly one topic
 *
 * Accessibility, mirroring `atlas/src/application/research/ResearchTopic.ts`.
 * The duplication is real and deliberate: Atlas owns the research profile
 * (the prompt, the source preferences), the app owns only the question of
 * which button to draw. An app that imported Atlas's profiles would be
 * importing a prompt in order to decide whether to render a button.
 *
 * The cost of that duplication is that the two lists can drift. That is
 * bounded and visible — a topic here that Atlas does not know is **refused
 * by the API** with "Unknown research topic", which is a loud failure
 * rather than a silent one. The reverse, a topic Atlas knows and the app
 * does not offer, simply means no button. Neither can corrupt anything.
 */

/** Section ids in "What Atlas doesn't know yet" that a curator can act on. */
const RESEARCHABLE_TOPICS = new Set(["accessibility"]);

export function isResearchable(sectionId: string): boolean {
  return RESEARCHABLE_TOPICS.has(sectionId);
}
