import { NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  UnextractedAnalysis,
  UnextractedFinding,
} from "@/lib/knowledge/unextractedTypes";

/**
 * The first scoped AI curator action: **"What's in this source that we
 * never extracted?"**
 *
 * Compares one `SourceRecord`'s raw content against the structured
 * knowledge Atlas actually holds from it, and reports what appears to be
 * present in the source but missing from Atlas.
 *
 * This is the one analysis a human genuinely cannot do: nobody re-reads a
 * 60,000-character page against twenty fields. It targets a failure mode
 * that has now bitten this project twice — BC Parks' per-activity
 * descriptions, and Big White's entire mountain-statistics table — already
 * named "Silent Schema Underutilization" in
 * `atlas/docs/architecture/overview.md` §12.
 *
 * ## Safeguards (non-negotiable, per the approved design §D)
 *
 * - **Proposal-only.** This route performs no writes of any kind. It has
 *   no access to a store, no Atlas admin write endpoint, and returns a
 *   plain analysis payload. There is deliberately no "apply" counterpart
 *   in this milestone.
 * - **Cited.** Every finding must carry a verbatim `excerpt` from the
 *   source. Findings whose excerpt cannot be located in the raw content
 *   are dropped server-side before returning — the model does not get to
 *   assert that the source says something it doesn't.
 * - **Labelled.** Every finding is returned with `authoredBy: "ai"` and
 *   is rendered in visually distinct AI-analysis styling, never mixed in
 *   with Atlas knowledge.
 * - **Server-only key.** `OPENAI_API_KEY` never reaches the browser, the
 *   same discipline `ADMIN_TOKEN` already follows in the sibling proxy
 *   routes.
 *
 * Deliberately *not* reusing `EnrichmentService`: that service proposes
 * values for *known fields* on an entity (its whole shape is
 * `field -> candidate value`). This asks a different question — "what is
 * here that we have no field for" — and its answer is frequently a
 * category of knowledge Atlas has no field for at all, which is precisely
 * the point. Wiring this through a field-shaped API would force it to
 * discard its most valuable findings. Recorded here rather than silently
 * diverging.
 */

const ATLAS_BASE_URL = "http://localhost:3000";

/** Truncated because a whole official-site page can exceed the useful context window; the limit is reported to the caller so the UI never implies the whole source was analysed. */
const MAX_CHARS = 40_000;

// Types live in `@/lib/knowledge/unextractedTypes` so the client
// component can import them without pulling a server route into its
// module graph.

const TOOL = {
  type: "function" as const,
  function: {
    name: "report_unextracted_knowledge",
    description:
      "Report factual knowledge that is present in the source text but absent from the list of knowledge Atlas already holds. Only report things the source text actually states.",
    parameters: {
      type: "object",
      properties: {
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description:
                  "A short attribute name, in the source's own words.",
              },
              value: {
                type: "string",
                description: "The value the source states, copied faithfully.",
              },
              excerpt: {
                type: "string",
                description:
                  "A short VERBATIM quote from the source text containing this fact. Must appear character-for-character in the source. Do not paraphrase, reformat, or correct it.",
              },
              category: {
                type: "string",
                description:
                  "The source's own section heading for this fact, if it has one.",
              },
              travelerRelevance: {
                type: "string",
                description:
                  "One short sentence on why a traveler planning a visit might care. Omit if genuinely not traveler-relevant.",
              },
            },
            required: ["label", "value", "excerpt"],
          },
        },
      },
      required: ["findings"],
    },
  },
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured.", code: "ADMIN_TOKEN_MISSING" },
      { status: 401 },
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured.",
        code: "OPENAI_KEY_MISSING",
      },
      { status: 503 },
    );
  }

  // Read through the same admin endpoints every other view uses — no new data path.
  const [sourcesRes, relsRes] = await Promise.all([
    fetch(`${ATLAS_BASE_URL}/admin/source-records`, {
      headers: { "x-admin-token": adminToken },
      cache: "no-store",
    }),
    fetch(`${ATLAS_BASE_URL}/admin/relationships`, {
      headers: { "x-admin-token": adminToken },
      cache: "no-store",
    }),
  ]);
  if (!sourcesRes.ok || !relsRes.ok) {
    return NextResponse.json(
      { error: "Could not read source records from Atlas." },
      { status: 502 },
    );
  }

  const sources = (await sourcesRes.json()) as {
    id: string;
    sourceType: string;
    source: string;
    rawContent: unknown;
  }[];
  const relationships = (await relsRes.json()) as {
    type: string;
    sourceEntityId: string;
    targetEntityId: string;
  }[];

  const record = sources.find((s) => s.id === id);
  if (!record) {
    return NextResponse.json(
      { error: `No source record with id ${id}.` },
      { status: 404 },
    );
  }

  const raw =
    typeof record.rawContent === "string"
      ? record.rawContent
      : JSON.stringify(record.rawContent ?? "");
  const analysed = raw.slice(0, MAX_CHARS);

  // Everything Atlas already holds from this source, so the model is asked
  // for the *difference*, not for a summary.
  const describedEntityIds = new Set(
    relationships
      .filter((r) => r.type === "describes" && r.sourceEntityId === id)
      .map((r) => r.targetEntityId),
  );
  const entitiesRes = await fetch(`${ATLAS_BASE_URL}/admin/entities`, {
    headers: { "x-admin-token": adminToken },
    cache: "no-store",
  });
  const allEntities = entitiesRes.ok
    ? ((await entitiesRes.json()) as Record<string, unknown>[])
    : [];
  const describedEntities = allEntities.filter((e) =>
    describedEntityIds.has(e.id as string),
  );

  const knownLabels: string[] = [];
  for (const entity of describedEntities) {
    for (const [field, value] of Object.entries(entity)) {
      if (
        ["id", "kind", "archivedAt", "keyFacts", "externalIds"].includes(field)
      )
        continue;
      if (value === null || value === undefined || value === "") continue;
      knownLabels.push(
        `${field}: ${typeof value === "string" ? value : JSON.stringify(value)}`.slice(
          0,
          300,
        ),
      );
    }
    for (const fact of (entity.keyFacts as
      { label?: string; value?: string }[] | undefined) ?? []) {
      if (fact?.label)
        knownLabels.push(
          `keyFact ${fact.label}: ${fact.value ?? ""}`.slice(0, 300),
        );
    }
    for (const ext of (entity.externalIds as
      { system?: string; id?: string }[] | undefined) ?? []) {
      if (ext?.system)
        knownLabels.push(`externalId ${ext.system}: ${ext.id ?? ""}`);
    }
  }

  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      tools: [TOOL],
      tool_choice: {
        type: "function",
        function: { name: "report_unextracted_knowledge" },
      },
      messages: [
        {
          role: "system",
          content:
            "You are a knowledge-extraction auditor for a travel knowledge base. You are given a source document and a list of everything the knowledge base already recorded from it. Report only factual knowledge that the source states and the knowledge base does not already hold. Never invent a fact. Never report something the source does not literally say. Every finding must include a verbatim quote from the source. Prefer concrete, checkable facts (numbers, names, hours, prices, dates, policies, amenities) over vague impressions. Ignore navigation text, marketing slogans, cookie notices, and transactional calls to action.",
        },
        {
          role: "user",
          content:
            `SOURCE (${record.sourceType} — ${record.source}):\n---\n${analysed}\n---\n\n` +
            `KNOWLEDGE ALREADY RECORDED FROM THIS SOURCE (${knownLabels.length} items):\n` +
            (knownLabels.length > 0
              ? knownLabels.join("\n")
              : "(nothing recorded from this source)") +
            `\n\nReport what the source contains that is missing above.`,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: `AI analysis failed: ${(error as Error).message}` },
      { status: 502 },
    );
  }

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  const parsed =
    call && "function" in call
      ? (JSON.parse(call.function.arguments) as {
          findings?: UnextractedFinding[];
        })
      : { findings: [] };

  // Server-side citation verification. A finding whose excerpt is not
  // actually in the source is dropped — the model does not get to claim
  // the source says something it doesn't. Whitespace is normalised on both
  // sides because HTML-derived text re-wraps unpredictably.
  const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const haystack = normalise(analysed);
  const all = parsed.findings ?? [];
  const findings = all.filter(
    (f) => f?.excerpt && haystack.includes(normalise(f.excerpt)),
  );

  const analysis: UnextractedAnalysis = {
    sourceRecordId: id,
    authoredBy: "ai",
    model,
    analysedAt: new Date().toISOString(),
    rawContentLength: raw.length,
    analysedChars: analysed.length,
    truncated: raw.length > MAX_CHARS,
    knownLabels,
    findings,
    rejectedFindingCount: all.length - findings.length,
  };

  return NextResponse.json(analysis);
}
