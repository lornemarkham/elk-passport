import { readAskWithModel } from "@/lib/ai/ask/model";

/**
 * **Read a question somebody asked Discovery** — `POST { said, today, verbs }`.
 *
 * The deterministic reading runs in the browser too, so the page never waits
 * on this; it exists so a configured model can fill what the words alone
 * could not (see `model.ts`). Without a key it answers with the same reading
 * the browser already has, which keeps one code path on the page.
 *
 * In a body, not a URL, for the reason `/api/discovery/distance` gives: what
 * somebody typed about their kid and their afternoon reaches no access log,
 * referrer or history entry. Nothing is stored or logged.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const field = (key: string): unknown =>
    (body as Record<string, unknown> | null)?.[key];

  const said = field("said");
  const today = field("today");
  const verbs = field("verbs");
  if (
    typeof said !== "string" ||
    said.trim().length === 0 ||
    said.length > 300 ||
    typeof today !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(today)
  ) {
    return Response.json({ error: "question" }, { status: 400 });
  }
  const offered = Array.isArray(verbs)
    ? verbs
        .filter((v): v is string => typeof v === "string" && v.length <= 60)
        .slice(0, 200)
    : [];

  const reading = await readAskWithModel(said, { today, verbs: offered });
  return Response.json(reading, { headers: { "Cache-Control": "no-store" } });
}
