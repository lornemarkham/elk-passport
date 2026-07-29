import OpenAI from "openai";
import {
  type PlanInput,
  type Recommendation,
  recommendationSchema,
} from "@/lib/schemas";

/**
 * AI-backed recommender, used only when OPENAI_API_KEY is set. Falls back
 * to the local recommender (see the API route) on any failure — a broken
 * recommendation is worse than a generic one from the seed library.
 */
export async function getAiRecommendation(
  input: PlanInput,
): Promise<Recommendation> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = `You are the curation engine behind ELK Passport, an adventure platform. \
Your only job is to propose ONE confident, specific day plan — never a list of options. \
Passport's whole premise is confidence over quantity: the user should feel "of course, \
that's exactly what I wanted," not "here are ten nearby attractions."

Hard rules:
- Do NOT invent or name specific real businesses, restaurants, trails, or venues — you have \
no real local data, and a wrong or fabricated name breaks trust immediately. Describe the \
*kind* of place and activity instead (e.g. "a coffee shop with outdoor seating," not a made-up name).
- Respect the stated time available and budget.
- The tone is bright, warm, and a little adventurous — never corporate, never a generic listicle.
- Return 2 to 5 blocks that flow across the available time, each with a short time label, a short \
title, and a one-to-two sentence description.

Respond with strict JSON only, matching this shape:
{"title": string, "tagline": string, "blocks": [{"time": string, "title": string, "description": string}]}`;

  const user = `Today's intent: ${input.intent}
Time available: ${input.constraints.timeAvailable}
Budget: ${input.constraints.budget}
Location: ${input.constraints.location}
Adventure DNA traits: ${input.dna.traits.join(", ") || "none given yet"}
Notes: ${input.dna.notes ?? "none"}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.9,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty AI response");

  return recommendationSchema.parse(JSON.parse(raw));
}
