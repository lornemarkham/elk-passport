import { z } from "zod";
import { asMember } from "../../_server/respond";
import { NightError, createSycleNight, myNights } from "../../_server/night";

export const dynamic = "force-dynamic";

export function GET() {
  return asMember((user) => myNights(user));
}

const StartSchema = z.object({
  name: z.string().max(40).optional(),
  game: z
    .object({
      opponent: z.string().max(40),
      // Converted from the arena's wall clock in the host's browser.
      startsAt: z.string().datetime(),
    })
    .optional(),
  after: z.string().uuid().optional(),
});

/** Start a Sycle Hockey Night — a new one, or the next one. Whoever starts it hosts it. */
export function POST(request: Request) {
  return asMember(async (user) => {
    const body = StartSchema.safeParse(await request.json().catch(() => ({})));
    // A malformed "run it back" must not quietly become a brand-new night.
    if (!body.success) throw new NightError("That isn't a night.", 422);
    return { id: await createSycleNight(user, body.data) };
  });
}
