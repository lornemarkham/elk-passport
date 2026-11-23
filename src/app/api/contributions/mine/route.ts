import {
  contributor,
  handle,
  json,
  progressFor,
  readSuggestions,
} from "@/lib/contributions/server";
import { contributorView } from "@/domain/contributions/model";

export const dynamic = "force-dynamic";

/**
 * **My contributions**: this person's progress toward the milestones and
 * their recent suggestions with status — recognised by account, else by the
 * token this browser keeps (`?device=`), else by address. Nothing about
 * anybody else.
 */
export async function GET(request: Request) {
  const device = new URL(request.url).searchParams.get("device");
  return handle(request, "read", null, async () => {
    const who = await contributor(request, device);
    const { doc } = await readSuggestions();
    const mine = doc.suggestions
      .filter((s) => who.all.includes(s.submittedBy))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, 50)
      .map(contributorView);
    return json({
      progress: await progressFor(who, doc),
      recognisedBy: who.recognisedBy,
      signedIn: who.signedIn,
      mine,
    });
  });
}
