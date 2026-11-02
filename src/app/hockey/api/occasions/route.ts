import { z } from "zod";
import { modulesValue } from "@/domain/hockey/actions";
import { measure } from "../../_server/measure";
import { asMember } from "../../_server/respond";
import { scheduledGameById } from "../../_server/game";
import { NightError, createSycleNight, myNights } from "../../_server/night";

export const dynamic = "force-dynamic";

export function GET() {
  return asMember((user) => myNights(user));
}

const StartSchema = z.object({
  name: z.string().max(40).optional(),
  game: z
    .union([
      z.object({
        opponent: z.string().max(40),
        // Converted from the arena's wall clock in the host's browser.
        startsAt: z.string().datetime(),
      }),
      // One of the league's games, picked from its schedule (`/hockey/api/games`).
      z.object({ nhlGameId: z.number().int().positive() }),
    ])
    .optional(),
  cup: z.string().trim().min(1).max(40).optional(),
  after: z.string().uuid().optional(),
  modules: modulesValue.optional(),
  /** Which public hockey page the host came from (`CreateNightLink`); counted, never stored. */
  via: z
    .string()
    .regex(/^[a-z-]{1,20}$/)
    .optional(),
});

/** Start a Hockey Night — a new one, or the next one. Whoever starts it hosts it. */
export function POST(request: Request) {
  return asMember(async (user) => {
    const body = StartSchema.safeParse(await request.json().catch(() => ({})));
    // A malformed "run it back" must not quietly become a brand-new night.
    if (!body.success) throw new NightError("That isn't a night.", 422);
    const { game, via, ...rest } = body.data;
    const counted = (league: boolean) =>
      measure("Hockey: night created", {
        via: via ?? "direct",
        league,
        runBack: Boolean(rest.after),
      });
    if (game && "nhlGameId" in game) {
      const scheduled = await scheduledGameById(game.nhlGameId);
      if (!scheduled)
        throw new NightError("The league has no such game right now.", 422);
      const id = await createSycleNight(user, { ...rest, game: { scheduled } });
      await counted(true);
      return { id };
    }
    const id = await createSycleNight(user, { ...rest, game });
    await counted(false);
    return { id };
  });
}
