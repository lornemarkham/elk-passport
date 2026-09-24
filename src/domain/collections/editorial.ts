import type { Experience, ExperienceKind } from "@/domain/experience/types";

/**
 * **Editorial collections: Passport saying a real Thing belongs somewhere.**
 *
 * Atlas answers what is true about the world. It does not — and must not —
 * know that Edgar Allan Poe is Halloween. That is a product judgement, and
 * until now Passport had no way to state one, so it guessed by matching words
 * against names and descriptions.
 *
 * The guess is structurally wrong, and the corpus proves it. *The Black
 * Mountain Haunted House* is found because the word "Haunted" is in its name.
 * *The Fall of the House of Usher* is a Poe adaptation staged after dark in a
 * barn, and it scores **zero** against every Halloween term, because nothing
 * in its text says Halloween. Meanwhile *Caravan Farm Theatre* — the venue —
 * scores three and is shown, while the production it offers is not. No longer
 * list of keywords fixes that; a longer list floods the surface with theatres
 * and still misses Poe.
 *
 * So membership becomes a stated fact of the product rather than an inference
 * about prose: **a human decided this Thing belongs in this collection.**
 *
 * ## What a collection holds, and what it must never hold
 *
 * An item is an Atlas id and an Atlas kind. Nothing else. No title, no date,
 * no price, no description — every one of those is read live from Atlas at
 * render time, because Atlas owns them and a copy would drift into a lie the
 * moment the world changed.
 *
 * ### Why there is no remembered display name
 *
 * `passport_october_things` remembers a name, and is right to: those rows are
 * a *person's* intentions, and someone's own October should not lose an item
 * because Atlas retired an entity. An editorial collection is the opposite
 * case. If Atlas can no longer substantiate a Thing, Passport showing its name
 * from memory would be asserting a fact that nothing currently supports. So an
 * unresolvable member simply stops appearing, and `resolveCollection` reports
 * it so a curator can see what went missing rather than a traveller seeing a
 * ghost.
 *
 * ### Why position is the array's own order
 *
 * The order written here is the order shown. A separate integer column would
 * be a second source of truth that can disagree with the first, and the only
 * thing it buys is reordering without editing the list — which is the edit.
 *
 * ## Why this lives in the repository rather than in a table
 *
 * This is product content, not user data. It is global, it is authored by the
 * team, it is reviewed, and it ships with the code — so a diff is the audit
 * trail, and adding a Thing is a reviewable change rather than an invisible
 * row. `passport_october_things` is per-person and RLS-scoped, which is the
 * wrong shape entirely: "Okanagan Halloween 2026" belongs to nobody.
 *
 * The shape below is deliberately the shape of a table (`slug`, `name`,
 * members of `{id, kind}`), so moving it into Supabase later is a migration
 * and not a redesign.
 */

export interface CollectionMember {
  /** The Atlas entity this refers to. Passport stores no facts about it. */
  readonly atlasEntityId: string;
  readonly atlasEntityKind: ExperienceKind;
}

export interface EditorialCollection {
  readonly slug: string;
  readonly name: string;
  /** In the order they should appear. The array is the ordering. */
  readonly members: readonly CollectionMember[];
}

/**
 * Every collection Passport currently states.
 *
 * Deliberately one. The primitive is general — a second entry with a
 * different slug and different members is the whole of what "Vancouver
 * Hockey" or "Christmas" requires, with no schema and no rendering change.
 */
export const EDITORIAL_COLLECTIONS: readonly EditorialCollection[] = [
  {
    slug: "okanagan-halloween-2026",
    name: "Okanagan Halloween 2026",
    members: [
      // Atlas ids, verified against the live corpus. The two Things a human
      // deliberately included; neither is here because of a keyword.
      {
        atlasEntityId: "exp-black-mountain-haunted-house",
        atlasEntityKind: "Experience",
      },
      {
        atlasEntityId: "exp-usher-caravan-farm-theatre",
        atlasEntityKind: "Experience",
      },
    ],
  },
];

export function collectionBySlug(
  slug: string,
): EditorialCollection | undefined {
  return EDITORIAL_COLLECTIONS.find((c) => c.slug === slug);
}

export interface ResolvedCollection {
  /** Live Atlas Things, in the collection's own order. */
  readonly members: readonly Experience[];
  /**
   * Members Atlas no longer supplies. Never rendered to a traveller — carried
   * so a curator can be told the list has rotted.
   */
  readonly missing: readonly string[];
}

/**
 * Resolve stated membership against whatever Atlas currently holds.
 *
 * Every fact shown about a member comes from the resolved `Experience`, never
 * from the collection. A member Atlas has dropped degrades to absence, which
 * is the only honest outcome: Passport can say a Thing belongs in a
 * collection, and it cannot say anything about a Thing that is no longer
 * there.
 *
 * Duplicate ids in a collection resolve once. Membership is a set; stating it
 * twice does not make a Thing appear twice.
 */
export function resolveCollection(
  collection: EditorialCollection,
  experiences: readonly Experience[],
): ResolvedCollection {
  const known = new Map(experiences.map((e) => [e.id, e]));
  const members: Experience[] = [];
  const missing: string[] = [];
  const taken = new Set<string>();

  for (const member of collection.members) {
    if (taken.has(member.atlasEntityId)) continue;
    taken.add(member.atlasEntityId);
    const found = known.get(member.atlasEntityId);
    if (found) members.push(found);
    else missing.push(member.atlasEntityId);
  }

  return { members, missing };
}
