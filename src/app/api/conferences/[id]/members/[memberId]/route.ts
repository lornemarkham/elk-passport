import {
  deps,
  errorResponse,
  gate,
  okResponse,
} from "@/lib/conference/request";
import { removeMember } from "@/lib/conference/service";

/** An organiser removes somebody. Their module data is forgotten with them. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const { id, memberId } = await params;
  const result = await removeMember(deps(), g.identity, id, memberId);
  if (!result.ok) return errorResponse(result.error);
  return okResponse({});
}
