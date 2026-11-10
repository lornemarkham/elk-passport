import { adminVerdictForRequest } from "@/lib/admin/requireAdmin";
import {
  guardPost,
  guarded,
  json,
  playerCookie,
  readBody,
  setPlayerCookie,
} from "@/lib/courtqueue/http";
import {
  claimOrganizer,
  organizerResetPin,
  register,
  signIn,
  signOut,
} from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** Register, sign in, sign out, become organizer, reset someone's PIN. */
export async function POST(request: Request) {
  const body = await readBody(request);
  const cookie = await playerCookie();
  const refused =
    body.action === "register"
      ? guardPost(request, "register", undefined)
      : body.action === "sign-in"
        ? guardPost(
            request,
            "signin",
            String(body.name ?? "")
              .trim()
              .toLowerCase(),
          )
        : body.action === "organizer"
          ? guardPost(request, "organizer", undefined)
          : guardPost(request, "post", cookie);
  if (refused) return refused;
  return guarded(async () => {
    switch (body.action) {
      case "register": {
        const out = await register({
          name: body.name,
          pin: body.pin,
          skill: body.skill,
          statsPublic: body.statsPublic,
        });
        if (!out.ok) return json({ ok: false, error: out.error }, 409);
        await setPlayerCookie(out.value.cookie);
        return json({ ok: true });
      }
      case "sign-in": {
        const out = await signIn(body.name, body.pin);
        if (!out.ok) return json({ ok: false, error: out.error }, 401);
        await setPlayerCookie(out.value.cookie);
        return json({ ok: true });
      }
      case "sign-out": {
        await signOut(cookie);
        await setPlayerCookie(null);
        return json({ ok: true });
      }
      case "organizer": {
        const out = await claimOrganizer(cookie, body.code, async () => {
          try {
            return (await adminVerdictForRequest()).ok;
          } catch {
            return false;
          }
        });
        return out.ok
          ? json({ ok: true })
          : json({ ok: false, error: out.error }, 403);
      }
      case "reset-pin": {
        const out = await organizerResetPin(cookie, body.playerId, body.pin);
        return out.ok
          ? json({ ok: true })
          : json({ ok: false, error: out.error }, 403);
      }
      default:
        return json({ ok: false, error: "Unknown action." }, 400);
    }
  });
}
