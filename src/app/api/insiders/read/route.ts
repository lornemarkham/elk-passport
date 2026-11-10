import { draftFrom, mergeReading } from "@/domain/insiders/extract";
import {
  aiAvailable,
  readSubmission,
  transcribePoster,
} from "@/lib/insiders/ai";
import { handle, json } from "@/lib/insiders/http";

/**
 * **Read what somebody sent** — words, or a poster — into fields for them to
 * confirm. Nothing is stored here. The rules always run; an AI adds to them
 * only when this deployment has a key, and only what the text states.
 */
export async function POST(request: Request) {
  return handle(request, "read", null, async (body) => {
    let text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
    const image = typeof body.image === "string" ? body.image : "";
    let fromPoster: string | null = null;
    if (image) {
      if (
        !/^data:image\/(png|jpe?g|webp|gif|heic);base64,/.test(image) ||
        image.length > 6_000_000
      )
        return json({ error: "Send a photo under about 4 MB." }, 400);
      if (!aiAvailable())
        return json({
          draft: draftFrom(text, new Date()),
          ai: false,
          because:
            "Reading posters needs the AI reader, which isn't switched on here yet — type what it says instead.",
        });
      fromPoster = await transcribePoster(image).catch(() => null);
      if (fromPoster) text = [text, fromPoster].filter(Boolean).join("\n");
    }
    if (!text.trim())
      return json({ error: "Tell us a little about it first." }, 400);
    const today = new Date();
    const rules = draftFrom(text, today);
    const ai = aiAvailable()
      ? await readSubmission(text, today.toISOString().slice(0, 10)).catch(
          () => null,
        )
      : null;
    return json({
      draft: ai ? mergeReading(rules, ai, text) : rules,
      ai: !!ai,
      ...(fromPoster ? { poster: fromPoster } : {}),
    });
  });
}
