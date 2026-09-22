import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { isFear, isVerdict, react } from "@/lib/movies/reactions";
import { filmById } from "@/lib/movies/catalogue";

/** What they thought. Every field is something they tapped. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ filmId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { filmId } = await params;
  if (!filmById(filmId)) {
    return NextResponse.json({ error: "No such film." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!isVerdict(body?.verdict)) {
    return NextResponse.json(
      { error: "A reaction needs loved, good or meh." },
      { status: 400 },
    );
  }

  const reaction = await react(auth.user, {
    filmId,
    verdict: body.verdict,
    felt: isFear(body?.felt) ? body.felt : null,
    gotMe:
      typeof body?.gotMe === "string" && body.gotMe.trim()
        ? body.gotMe.trim()
        : null,
  });
  return NextResponse.json(reaction);
}
