import { isPulseId } from "@/lib/pulse/model";
import { snapshot } from "@/lib/pulse/service";
import { aiConfigured, openAiComplete } from "@/lib/pulse/sourceCheck";
import { summariseReasons, type AiSummary } from "@/lib/pulse/summary";
import { existingDevice, guardRequest, guarded, json } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as {
  __pulseSummaries?: Map<string, AiSummary | null>;
};
const cache = () => (g.__pulseSummaries ??= new Map());

/**
 * An AI summary of the reasons this browser can already see, on request.
 * 404 without the approved AI service; cached per Pulse per release of five
 * votes, so a busy decision costs one call per step, not one per visitor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!aiConfigured()) return json({ error: "off" }, 404);
  const refused = guardRequest(request, "check");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  const me = await existingDevice();
  if (!me) return json({ error: "vote-first" }, 403);
  return guarded(async (store, key) => {
    const snap = await snapshot(store, key, id, me, new Date(), false);
    const reasons = snap?.results?.modes.reasons;
    if (!snap || !reasons?.groups) return json({ error: "too-few" }, 409);
    const k = `${id}:${reasons.counted}`;
    if (!cache().has(k)) {
      cache().set(
        k,
        await summariseReasons(
          snap.pulse.question,
          reasons,
          openAiComplete,
        ).catch(() => null),
      );
      if (cache().size > 300) cache().delete(cache().keys().next().value!);
    }
    const summary = cache().get(k);
    return summary ? json(summary) : json({ error: "too-few" }, 409);
  });
}
