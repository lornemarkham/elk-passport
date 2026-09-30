import { NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

/**
 * **Set one entity's type, as a curator's assertion.**
 *
 * ## This writes nothing new — it composes what Atlas already does
 *
 * It posts to `POST /admin/entities/:id/enrichment`, the same route the
 * enrichment panel uses. `EnrichmentService.applyEnrichment` then does
 * three things Atlas has always done for a curator edit:
 *
 * 1. Applies the field override and saves the entity.
 * 2. Writes a `passport-editorial` **SourceRecord** recording that a
 *    curator made this change, with the reason and the source they were
 *    looking at.
 * 3. Links that record to the entity with `describes`.
 *
 * **That third step is why this is honest.** Atlas's rule is that
 * provenance survives every transformation — a value with no traceable
 * origin is invented. A curator's judgement is not a fact a web page
 * published, so it is not attributed to one: it becomes its own piece of
 * evidence, marked editorial, and a later reader can see exactly that a
 * person decided it and what they were reading at the time.
 *
 * ## Why a source record id is still required
 *
 * `chosen` takes `{ value, sourceRecordId }` per field, and the id is
 * recorded in the editorial note as *what the curator was working from*.
 * The caller supplies a source that genuinely describes the entity — the
 * page the curator is reading Atlas's knowledge from. It is context for
 * the decision, never a claim that the source used that word.
 *
 * ## The field depends on the kind
 *
 * `placeType` · `organizationType` · `activityType` · `eventType`. Atlas
 * has no single `type` field, and inventing one here would create a
 * second representation of something the domain already models per kind.
 */
const ATLAS_BASE_URL = "http://localhost:3000";

const TYPE_FIELD: Record<string, string> = {
  Place: "placeType",
  Organization: "organizationType",
  Activity: "activityType",
  Event: "eventType",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured for this app." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const body = (await request.json()) as {
    kind?: string;
    type?: string;
    sourceRecordId?: string;
  };

  const field = TYPE_FIELD[body.kind ?? ""];
  if (!field) {
    return NextResponse.json(
      { error: `Unknown entity kind "${body.kind}".` },
      { status: 400 },
    );
  }
  const value = (body.type ?? "").trim();
  if (!value) {
    return NextResponse.json({ error: "A type is required." }, { status: 400 });
  }
  if (!body.sourceRecordId) {
    // Refused rather than defaulted. A curator edit with nothing behind it
    // is exactly the untraceable value Atlas's provenance rule forbids,
    // and silently inventing an id would hide that.
    return NextResponse.json(
      {
        error:
          "This entity has no source record to attribute the decision to, so Atlas cannot record why the type was set.",
      },
      { status: 409 },
    );
  }

  try {
    const response = await fetch(
      `${ATLAS_BASE_URL}/admin/entities/${encodeURIComponent(id)}/enrichment`,
      {
        method: "POST",
        headers: atlasAuthHeaders({
          "x-admin-token": token,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          chosen: {
            [field]: { value, sourceRecordId: body.sourceRecordId },
          },
          reason: `Curator set ${field} to "${value}" from the region workspace.`,
        }),
      },
    );
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: `Atlas is unreachable: ${(error as Error).message}` },
      { status: 503 },
    );
  }
}
