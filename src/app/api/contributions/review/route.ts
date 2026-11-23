import {
  contributor,
  handle,
  json,
  readSuggestions,
} from "@/lib/contributions/server";
import { reviewView } from "@/domain/contributions/model";

export const dynamic = "force-dynamic";

/** The whole queue, for the administrator; 404 to everyone else. */
export async function GET(request: Request) {
  return handle(request, "review", null, async () => {
    const who = await contributor(request, null);
    if (!who.reviewer) return json({ error: "Not found." }, 404);
    const { doc } = await readSuggestions();
    return json({
      suggestions: [...doc.suggestions]
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .map((s) => reviewView(doc, s)),
    });
  });
}
