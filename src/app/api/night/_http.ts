import "server-only";
import { NextResponse } from "next/server";
import { answer } from "@/lib/adventures/server";
import { PackingOff } from "@/lib/date-night/night";

/** The core's `answer`, plus: no packing table yet is 409, not a crash. */
export function night(
  work: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return answer(async () => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof PackingOff)
        return NextResponse.json(
          {
            error: "The packing list isn't switched on yet.",
            off: true,
            // Said so a live call names the cause (`unseen`/PGRST205 is a
            // stale schema cache; `missing` is the migration).
            trouble: error.trouble,
            code: error.code,
          },
          { status: 409 },
        );
      throw error;
    }
  });
}
