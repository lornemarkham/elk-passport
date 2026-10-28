import { json, withStore } from "@/lib/fairview3/api";

export const dynamic = "force-dynamic";

/** The whole room, in one read: state, participants, tallies, approved feedback. */
export async function GET() {
  return withStore(async (store) => json(await store.snapshot()));
}
