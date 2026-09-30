import type { ReactNode } from "react";
import type { Experience } from "@/domain/experience/types";
import {
  keepableKind,
  type KeptOnThisPage,
} from "@/lib/october/keptOnThisPage";
import { KeepOnCard } from "./KeepOnCard";

/**
 * **One decision, made once per surface: does this card get a save control?**
 *
 * Three surfaces draw October's cards and all three were about to grow the
 * same four lines — is this a kind My October can hold, has this person
 * already kept it, are they signed in, and where should signing in bring them
 * back to. Written once here so the surfaces stay about what they show.
 *
 * Returns `undefined` for a subject October cannot hold, which renders a card
 * with no control rather than one that would fail at the database. The card
 * still opens, and its page still offers everything it always did.
 */
export function keepFor(
  experience: Experience,
  page: KeptOnThisPage,
  returnTo: string,
): ReactNode {
  const kind = keepableKind(experience.kind);
  if (!kind) return undefined;
  return (
    <KeepOnCard
      thing={{
        entityId: experience.id,
        entityKind: kind,
        name: experience.title,
        // An Event's start, so My October can order it without re-reading
        // Atlas. Everything else is timeless and sends nothing.
        startsAt: experience.startTime ?? null,
      }}
      initiallySaved={page.kept.has(experience.id)}
      signedIn={page.signedIn}
      returnTo={returnTo}
    />
  );
}
