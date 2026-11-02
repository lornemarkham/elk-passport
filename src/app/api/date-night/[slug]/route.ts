import { NextResponse } from "next/server";
import { dateNight } from "@/domain/date-night/nights";
import { parseAnswer } from "@/domain/date-night/answer";
import { answerDateNight, NotReady } from "@/lib/date-night/store";

/**
 * **Answer a Date Night**, no sign-in. The body is checked against the
 * night's own ideas, places and foods before Postgres sees it; Postgres then
 * checks the night is open and applies its flood limits.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const night = dateNight(slug);
  if (!night)
    return NextResponse.json({ error: "no such night" }, { status: 404 });

  const text = await request.text();
  if (text.length > 16_000)
    return NextResponse.json({ error: "too long" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "not json" }, { status: 400 });
  }
  const parsed = parseAnswer(raw, night);
  if (!parsed.ok)
    return NextResponse.json({ error: parsed.reason }, { status: 400 });

  try {
    const outcome = await answerDateNight(slug, parsed.answer);
    switch (outcome.kind) {
      case "saved":
        return NextResponse.json({ saved: true }, { status: 201 });
      case "closed":
        return NextResponse.json(
          { error: "closed", off: true },
          { status: 409 },
        );
      case "slow-down":
        return NextResponse.json({ error: "slow down" }, { status: 429 });
      case "full":
        return NextResponse.json({ error: "full" }, { status: 429 });
    }
  } catch (error) {
    if (error instanceof NotReady) {
      console.error(`[date-night] not ready: ${error.message}`);
      return NextResponse.json(
        { error: "not ready", off: true },
        { status: 503 },
      );
    }
    console.error("[date-night] answer failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
