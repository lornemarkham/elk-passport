import "server-only";
import { NextResponse } from "next/server";
import { answer } from "@/lib/adventures/server";
import { SharingOff } from "./together";

/**
 * The core's `answer` (Refused → 404, Unavailable → 503) plus one more:
 * the proposed tables not being there yet is 409 with a sentence, so the
 * page can say "not switched on" rather than "broken".
 */
export function together(
  work: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return answer(async () => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof SharingOff)
        return NextResponse.json(
          { error: "Sharing isn't switched on for adventures yet.", off: true },
          { status: 409 },
        );
      throw error;
    }
  });
}
