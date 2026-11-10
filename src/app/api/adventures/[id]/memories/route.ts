import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { parseMemoryInput } from "@/lib/adventures/companion";
import { keepMemory, memoriesOf, MemoriesOff } from "@/lib/adventures/memories";

type Context = { params: Promise<{ id: string }> };

/** Until the table exists: 409 with `off`, so the phone keeps its own. */
const off = (work: () => Promise<NextResponse>) =>
  answer(async () => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof MemoriesOff)
        return NextResponse.json(
          { error: "Memories aren't kept on accounts yet.", off: true },
          { status: 409 },
        );
      throw error;
    }
  });

/** What this person kept of the adventure. Nobody else's, ever (RLS). */
export async function GET(_request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id } = await params;
  return off(async () =>
    NextResponse.json({ memories: await memoriesOf(session.db, id) }),
  );
}

/** Keep a memory privately. The same id again changes nothing. */
export async function POST(request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id } = await params;
  const parsed = parseMemoryInput(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return off(async () => {
    await keepMemory(session.db, id, parsed.value);
    return NextResponse.json({ id: parsed.value.id }, { status: 201 });
  });
}
