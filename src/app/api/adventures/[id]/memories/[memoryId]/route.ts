import { NextResponse } from "next/server";
import { answer, requireAdventureSession } from "@/lib/adventures/server";
import { dropMemory, MemoriesOff } from "@/lib/adventures/memories";

type Context = { params: Promise<{ id: string; memoryId: string }> };

/** Let go of one of your own memories. */
export async function DELETE(_request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { memoryId } = await params;
  return answer(async () => {
    try {
      await dropMemory(session.db, memoryId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof MemoriesOff)
        return NextResponse.json({ ok: true, off: true });
      throw error;
    }
  });
}
