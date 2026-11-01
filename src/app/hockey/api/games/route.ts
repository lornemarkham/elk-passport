import { upcomingGames } from "../../_server/game";
import { asMember } from "../../_server/respond";

export const dynamic = "force-dynamic";

/**
 * The league's games a night can be built on, for the start form: the next
 * three weeks of regular-season and playoff games, from the NHL's own
 * schedule. Nothing private; signed-in because only a signed-in person can
 * start a night.
 */
export function GET() {
  return asMember(() => upcomingGames());
}
