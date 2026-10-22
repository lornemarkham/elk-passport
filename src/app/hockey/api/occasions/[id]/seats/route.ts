import { z } from "zod";
import { asMember, bodyOf } from "../../../../_server/respond";
import { NightError } from "../../../../_server/night";
import { clearSeat, saveSeat, seatsFor } from "../../../../_server/seats";
import { SeatInputSchema } from "@/domain/hockey/seats";

export const dynamic = "force-dynamic";

/**
 * Our seats. Members only; a stranger gets the same 404 as a night that does
 * not exist. Who may write whose seat is the database's decision
 * (`seats-migration.sql`); the route only checks the shape.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember((user) => seatsFor(user, id));
}

/** Save a seat: mine, or (host) a member's or the group block's. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const parsed = SeatInputSchema.safeParse(await bodyOf(request));
    if (!parsed.success) {
      throw new NightError(
        parsed.error.issues[0]?.message ?? "That isn't a seat.",
        400,
      );
    }
    return saveSeat(user, id, parsed.data);
  });
}

/** Clear a seat: `?for=<user id>` or `?for=group`. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const forWho = new URL(request.url).searchParams.get("for") ?? "";
  return asMember(async (user) => {
    if (forWho !== "group" && !z.string().uuid().safeParse(forWho).success) {
      throw new NightError("Whose seat?", 400);
    }
    return clearSeat(user, id, forWho);
  });
}
