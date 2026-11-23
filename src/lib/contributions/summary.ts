import "server-only";
import { readSuggestions } from "./server";

/** How many suggestions wait for review; `null` when the store cannot say (never a false zero). */
export async function pendingSuggestions(): Promise<number | null> {
  try {
    const { doc } = await readSuggestions();
    return doc.suggestions.filter((s) => s.status === "pending").length;
  } catch {
    return null;
  }
}
