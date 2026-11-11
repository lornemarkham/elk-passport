import { NextResponse } from "next/server";
import { check, parseAction } from "@/domain/snow/sesh/actions";
import { earnedPatches } from "@/domain/snow/sesh/patches";
import { bodyOf, requireAdventureSession } from "@/lib/adventures/server";
import {
  POSTER_PATH,
  SeshRefused,
  SeshUnavailable,
  VIDEO_PATH,
  loadWorld,
  perform,
} from "../../../_server/sesh";

/**
 * Every Sesh Wars write, as the signed-in person. The shared rules answer
 * first (so the refusal is a sentence), then the database's function writes
 * it and checks again. Returns what was made and the rider's patches now.
 */
export async function POST(request: Request) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const raw = (await bodyOf(request)) as Record<string, unknown> | null;
  const action = parseAction(raw?.action);
  if (!action)
    return NextResponse.json(
      { error: "That request didn't make sense." },
      { status: 400 },
    );
  const me = session.user.id;
  const videoPath =
    typeof raw?.videoPath === "string" ? raw.videoPath : undefined;
  const posterPath =
    typeof raw?.posterPath === "string" ? raw.posterPath : undefined;
  if (action.type === "post") {
    if (
      !videoPath ||
      !VIDEO_PATH.test(videoPath) ||
      !videoPath.startsWith(`${me}/`)
    )
      return NextResponse.json(
        { error: "Upload the video first." },
        { status: 400 },
      );
    if (
      posterPath &&
      (!POSTER_PATH.test(posterPath) || !posterPath.startsWith(`${me}/`))
    )
      return NextResponse.json(
        { error: "That still isn't yours." },
        { status: 400 },
      );
  }
  try {
    const { world, viewer } = await loadWorld(session.db, me);
    const verdict = check(
      world,
      { ...viewer, signedIn: true },
      action,
      Date.now(),
    );
    if (!verdict.ok)
      return NextResponse.json({ error: verdict.reason }, { status: 422 });
    const out = await perform(session.db, action, { videoPath, posterPath });
    const created =
      action.type === "profile" ? me : (out.challenge ?? out.clip ?? out.id);
    const after = await loadWorld(session.db, me);
    const patches = earnedPatches(after.world, Date.now(), me).map(
      (e) => e.patch.id,
    );
    return NextResponse.json({ ok: true, created, patches });
  } catch (error) {
    if (error instanceof SeshRefused)
      return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof SeshUnavailable)
      return NextResponse.json(
        {
          error: "Sesh Wars can't be reached right now. Try again in a moment.",
        },
        { status: 503 },
      );
    throw error;
  }
}
