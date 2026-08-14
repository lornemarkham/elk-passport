import "server-only";
import type { EntityProfile } from "./entityKnowledgeView";

/**
 * Which template renders an entity.
 *
 * ## Why this exists while there is only one
 *
 * It is the seam, and it is deliberately the smallest possible one. Today
 * every entity resolves to `"baseline"` and this function is trivial. What
 * it buys is a single named place where "which template?" is answered — so
 * when a Restaurant or Trail template arrives, the decision changes here
 * and the page component does not learn about entity types.
 *
 * ## What is deliberately NOT here
 *
 * No registry, no inheritance chain, no override resolution, no
 * `extends` mechanism. Those describe a system with several templates, and
 * there is one. Designing an inheritance mechanism against a single
 * implementor is designing against an imagined second one, and it would
 * almost certainly be the wrong shape — the same reason Atlas is not built
 * as a generic platform for hypothetical consumers.
 *
 * ## How the extension is meant to work when it comes
 *
 * By **composition, not replacement**. A specialised template renders
 * `<BaselineEntityTemplate>` and overrides a region; it never forks the
 * renderer. That is possible because regions are data (`view.regions`),
 * not JSX buried inside the component — so a template can reorder,
 * restyle, or inject without reimplementing anything. The baseline stays
 * the thing that guarantees no knowledge goes missing, which is precisely
 * the guarantee a specialised template must not be able to break.
 */
export type EntityTemplateId = "baseline";

export function resolveTemplate(profile: EntityProfile): EntityTemplateId {
  // Every profile renders through the baseline. When that stops being true,
  // this is the only function that needs to know — which is why the
  // parameter is taken now rather than added later at every call site.
  void profile;
  return "baseline";
}
