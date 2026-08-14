import "server-only";
import { supabase } from "@/lib/supabase/client";

/**
 * How a Passport page is *composed* — and nothing else.
 *
 * ## The one rule, and the reason the whole thing works
 *
 * **This layer holds no facts.** Not hours, not an address, not a phone
 * number, not a description. Only decisions: which sections appear, in
 * what order, which are hidden, which image is the hero, and whether the
 * page is ready for a traveller.
 *
 * Every fact renders live from Atlas at request time. That is what makes
 * the engine worth building: teach Atlas something tonight and every page
 * showing it improves immediately, with no republish and no sync step. The
 * moment a fact is copied into this table, that property is gone and the
 * two copies begin to drift — which is exactly the failure this
 * architecture was corrected to avoid (ADR 022).
 *
 * ## Why this lives in the app rather than in Atlas
 *
 * Atlas owns understanding travel reality. "Hide the gallery on this page"
 * is not a fact about the world; it is a presentation choice belonging to
 * the product. Putting it in Atlas would pollute the knowledge model with
 * editorial state and force every future Atlas consumer to care about our
 * section ordering.
 *
 * ## Absent means default
 *
 * A page with no row here renders the default composition for its kind.
 * A row exists only once a human has made a choice — so this is purely
 * additive, and deleting the table would degrade every page back to its
 * default rather than breaking it.
 */

export type SectionType =
  | "hero"
  | "overview"
  | "hours"
  | "contact"
  | "dining"
  | "location"
  | "nearby"
  | "gallery"
  | "menu"
  | "accessibility"
  | "planning"
  | "sources";

export type PageStatus = "draft" | "ready" | "published";

export interface SectionChoice {
  readonly type: SectionType;
  readonly order: number;
  readonly hidden: boolean;
}

export interface PageComposition {
  readonly entityId: string;
  readonly sections: readonly SectionChoice[];
  /** Which image the curator chose, from candidates Atlas already holds. A reference, never an upload. */
  readonly heroImageUrl?: string;
  readonly status: PageStatus;
  readonly publishedAt?: string;
}

/**
 * The default running order for an Organization page.
 *
 * Ordered the way a traveller reads a venue: what is it, when is it open,
 * how do I reach it, what will I eat, where is it, what else is near. The
 * curator can reorder any of it; this is the starting point, not a
 * constraint.
 */
const ORGANIZATION_DEFAULT: readonly SectionType[] = [
  "hero",
  "overview",
  "hours",
  "contact",
  "dining",
  "location",
  "nearby",
  "gallery",
  "menu",
  "accessibility",
  "sources",
];

const PLACE_DEFAULT: readonly SectionType[] = [
  "hero",
  "overview",
  "hours",
  "location",
  "planning",
  "accessibility",
  "nearby",
  "gallery",
  "sources",
];

export function defaultComposition(
  entityId: string,
  kind: string,
): PageComposition {
  const order = kind === "Organization" ? ORGANIZATION_DEFAULT : PLACE_DEFAULT;
  return {
    entityId,
    sections: order.map((type, index) => ({
      type,
      order: index,
      hidden: false,
    })),
    status: "draft",
  };
}

/**
 * Loads a saved composition, or `null` if the curator has never made a
 * choice for this page.
 *
 * Never throws. A composition is an enhancement — if the table is missing
 * or unreachable the page must still render from Atlas, because the
 * knowledge is the part that matters and presentation defaults are always
 * available.
 */
export async function loadComposition(
  entityId: string,
): Promise<PageComposition | null> {
  try {
    const { data, error } = await supabase
      .from("page_compositions")
      .select("*")
      .eq("entity_id", entityId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      entityId: data.entity_id,
      sections: data.sections ?? [],
      heroImageUrl: data.hero_image_url ?? undefined,
      status: (data.status as PageStatus) ?? "draft",
      publishedAt: data.published_at ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function saveComposition(
  composition: PageComposition,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("page_compositions").upsert({
    entity_id: composition.entityId,
    sections: composition.sections,
    hero_image_url: composition.heroImageUrl ?? null,
    status: composition.status,
    published_at: composition.publishedAt ?? null,
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** The saved choice if there is one, otherwise the default for this kind. */
export function resolveComposition(
  entityId: string,
  kind: string,
  saved: PageComposition | null,
): PageComposition {
  if (!saved || saved.sections.length === 0)
    return defaultComposition(entityId, kind);
  return saved;
}

/** Visible sections in curator-chosen order. */
export function visibleSections(composition: PageComposition): SectionType[] {
  return [...composition.sections]
    .filter((s) => !s.hidden)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.type);
}
