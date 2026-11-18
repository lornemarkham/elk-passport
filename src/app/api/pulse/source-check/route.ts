import { cleanUrl } from "@/lib/pulse/model";
import { guardRequest, json, readBody } from "@/lib/pulse/http";
import {
  aiConfigured,
  checkableUrl,
  checkSource,
  explainWithAi,
  openAiComplete,
} from "@/lib/pulse/sourceCheck";

export const dynamic = "force-dynamic";

/** Whether the AI wording option is switched on here. */
export async function GET(request: Request) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  return json({ ai: aiConfigured() });
}

/**
 * Read the page a creator links as the source of a claim and say what it
 * declares: title, publisher, date, and the sentences with the figure and the
 * method. Optional AI wording (`ai: true`) only runs where Passport already
 * has an OpenAI key, only when asked for, and only on those copied sentences.
 */
export async function POST(request: Request) {
  // Refusing an address costs nothing, so only a real page read is counted
  // against the (tight) source-check limit.
  const early = guardRequest(request, "read");
  if (early) return early;
  const body = await readBody(request);
  const url = cleanUrl(body.url);
  if (!url)
    return json(
      {
        ok: false,
        reason:
          typeof body.url === "string" && body.url.trim()
            ? "That needs to be an https:// link to a public web page."
            : "Add the source link first.",
      },
      400,
    );
  if (!checkableUrl(url))
    return json(
      {
        ok: false,
        reason: "That needs to be an https:// link to a public web page.",
      },
      400,
    );
  const refused = guardRequest(request, "check");
  if (refused) return refused;
  const raw = Number(body.percent);
  const percent =
    body.percent === undefined || body.percent === "" || !Number.isFinite(raw)
      ? null
      : raw;
  const result = await checkSource(url, percent, new Date());
  if (!result.ok) return json(result, 200);
  let ai: Awaited<ReturnType<typeof explainWithAi>> = null;
  if (body.ai === true && aiConfigured()) {
    const claim =
      typeof body.claim === "string" ? body.claim.slice(0, 240) : "";
    ai = await explainWithAi(claim, result.check, openAiComplete).catch(
      () => null,
    );
  }
  return json({ ok: true, check: result.check, ai });
}
