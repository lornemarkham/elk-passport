import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { octoberThingsFor } from "@/lib/october/octoberThings";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await octoberThingsFor(auth.user));
}
