import {
  changeSuggestions,
  contributor,
  handToAtlas,
  handle,
  json,
  putPhoto,
} from "@/lib/contributions/server";
import {
  Refused,
  approve,
  decline,
  editSuggestion,
  find,
  parseEdits,
  parseReason,
  setAtlas,
} from "@/domain/contributions/actions";
import { atlasCopy, reviewView } from "@/domain/contributions/model";
import { measure } from "@/lib/measure";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : undefined;

/**
 * Everything the administrator can do to one suggestion, by `action`:
 *
 * - `approve` — it now counts toward the contributor's milestones; when it
 *   has a website, the page is queued for Atlas to read and the answer kept
 * - `decline` — with a reason (duplicate · spam · not-right · other); a
 *   duplicate or spam decline never counts, and spam declines cool the
 *   contributor off
 * - `edit` — correct the words before copying them on
 * - `atlas` — queue (or re-queue) its website for Atlas
 * - `copy` — the text block and JSON for Atlas, for the clipboard
 * - `delete-photo` — drop the photo document, keep the words
 *
 * Administrators only (`ADMIN_EMAILS`); everyone else gets a 404.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const who = await contributor(request, null);
  if (!who.reviewer) return json({ error: "Not found." }, 404);
  const reviewer = who.reviewer;
  return handle(request, "review", reviewer, async (b) => {
    const now = new Date();
    const action = b.action;
    if (action === "copy") {
      const doc = await changeSuggestions((d) => ({ doc: d, result: d }));
      return json({ copy: atlasCopy(find(doc, id)) });
    }
    if (action === "atlas") {
      const current = await changeSuggestions((d) => ({
        doc: d,
        result: find(d, id),
      }));
      const atlas = await handToAtlas(current, now);
      const doc = await changeSuggestions((d) => ({
        doc: setAtlas(d, id, reviewer, atlas),
        result: null,
      }));
      void doc;
      return json({ atlas });
    }
    if (action === "delete-photo") {
      await putPhoto(id, null);
      const doc = await changeSuggestions((d) => {
        const s = find(d, id);
        const { photo, ...rest } = s;
        void photo;
        return {
          doc: {
            suggestions: d.suggestions.map((x) =>
              x.id === id
                ? {
                    ...rest,
                    trail: [
                      ...s.trail,
                      {
                        at: now.toISOString(),
                        by: reviewer,
                        kind: "note" as const,
                        text: "photo deleted",
                      },
                    ],
                    updatedAt: now.toISOString(),
                  }
                : x,
            ),
          },
          result: null,
        };
      });
      void doc;
      return json({ ok: true });
    }
    const doc = await changeSuggestions((d) => {
      const next = (() => {
        switch (action) {
          case "approve":
            return approve(d, id, reviewer, now, str(b.note));
          case "decline":
            return decline(
              d,
              id,
              reviewer,
              parseReason(b.reason),
              now,
              str(b.note),
            );
          case "edit":
            return editSuggestion(d, id, reviewer, parseEdits(b), now);
          default:
            throw new Refused("That isn't something that can be done here.");
        }
      })();
      return { doc: next, result: next };
    });
    let after = find(doc, id);
    if (action === "approve") {
      await measure("suggestion_approved", {
        experience: after.experience,
        category: after.category,
      });
      if (after.website) {
        const atlas = await handToAtlas(after, now);
        const next = await changeSuggestions((d) => {
          const changed = setAtlas(d, id, reviewer, atlas);
          return { doc: changed, result: changed };
        });
        after = find(next, id);
      }
    }
    return json({ suggestion: reviewView(doc, after) });
  });
}
