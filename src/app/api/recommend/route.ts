import { NextResponse } from "next/server";
import { planInputSchema } from "@/lib/schemas";
import { getLocalRecommendation } from "@/lib/ai/local-recommender";
import { getAiRecommendation } from "@/lib/ai/openai-recommender";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = planInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const recommendation = await getAiRecommendation(parsed.data);
      return NextResponse.json(recommendation);
    } catch (error) {
      console.error(
        "AI recommendation failed, falling back to local recommender:",
        error,
      );
    }
  }

  return NextResponse.json(await getLocalRecommendation(parsed.data));
}
