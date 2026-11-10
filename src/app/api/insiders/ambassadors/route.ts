import {
  invite,
  retire,
  Refused,
  updateProfile,
} from "@/domain/insiders/review";
import { handle, json } from "@/lib/insiders/http";
import { actor, change, network } from "@/lib/insiders/service";

/** Inviting and retiring ambassadors (administrators), and an ambassador's own profile. */
export async function POST(request: Request) {
  const me = await actor(await network().catch(() => undefined));
  return handle(request, null, null, async (body) => {
    if (me.role === "visitor") throw new Refused("Sign in first.", 401);
    const now = new Date();
    if (body.action === "invite") {
      await change((n) => ({
        network: invite(
          n,
          body as {
            email: string;
            name: string;
            area?: string;
            trusted?: boolean;
          },
          me,
          now,
        ),
        result: null,
      }));
      return json({ ok: true });
    }
    if (body.action === "retire") {
      await change((n) => ({
        network: retire(n, String(body.email ?? ""), me),
        result: null,
      }));
      return json({ ok: true });
    }
    if (body.action === "profile") {
      await change((n) => ({
        network: updateProfile(
          n,
          me.who,
          body as { name?: string; area?: string; bio?: string },
        ),
        result: null,
      }));
      return json({ ok: true });
    }
    throw new Refused("Unknown action.");
  });
}
