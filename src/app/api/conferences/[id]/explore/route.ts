import { NextResponse } from "next/server";
import { conferenceContext, NO_STORE } from "@/lib/conference/request";
import { exploreFor } from "@/lib/conference-explore/places";
import { notFound } from "@/lib/conference-together/respond";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/**
 * Real places near where the group is. `?near=<curated id>` picks the
 * anchor; `?lat=&lon=` explores from where the person is, which is used for
 * this one answer and not kept (ADR 002).
 */
export async function GET(request: Request, { params }: Ctx) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) return notFound();
  if (
    !ctx.conference.modules.includes("discover") &&
    ctx.viewer.role !== "organiser"
  )
    return notFound();
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const around =
    q.has("lat") &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
      ? ([Math.round(lat * 100) / 100, Math.round(lon * 100) / 100] as const)
      : undefined;
  const view = await exploreFor(
    ctx.conference,
    q.get("near") ?? undefined,
    around,
  );
  return NextResponse.json({ ok: true, explore: view }, { headers: NO_STORE });
}
