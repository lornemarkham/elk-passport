import { z } from "zod";
import { asMember } from "../../_server/respond";
import { createSycleNight, myNights } from "../../_server/night";

export const dynamic = "force-dynamic";

export function GET() {
  return asMember((user) => myNights(user));
}

/** Start Sycle Hockey Night. Whoever starts it hosts it. */
export function POST(request: Request) {
  return asMember(async (user) => {
    const body = z
      .object({ name: z.string().max(40).optional() })
      .safeParse(await request.json().catch(() => ({})));
    return {
      id: await createSycleNight(
        user,
        body.success ? body.data.name : undefined,
      ),
    };
  });
}
