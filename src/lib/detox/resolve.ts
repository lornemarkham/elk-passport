import { resolvePrintDay } from "@/lib/go/printDay";
import { snapshotDay, type OfflineDay } from "./day";

/**
 * **The printed day, recovered by the same resolver `/go/print` uses.**
 *
 * Go Offline used to copy the print page's lookup, because three lanes were
 * conflicting in that file. Integration (M178) gave both pages one resolver
 * (`lib/go/printDay.ts`), so the stops kept on the phone are the stops on the
 * paper — the same ids, in the same order, with the same minutes — and the
 * query kept for "print it again" carries every registered day key.
 */
export type ResolvedDay =
  | { readonly kind: "none" }
  | { readonly kind: "day"; readonly day: OfflineDay }
  | { readonly kind: "unreachable" };

export async function resolveDay(
  query: Record<string, string | string[] | undefined>,
): Promise<ResolvedDay> {
  const resolved = await resolvePrintDay(query);
  // Atlas is unreachable. The paper already has the day; this page says so
  // rather than pretending there was nothing to keep.
  if (resolved.kind === "unreachable") return { kind: "unreachable" };
  if (resolved.kind === "none") return { kind: "none" };
  const day = snapshotDay(resolved.day, resolved.carried);
  return day ? { kind: "day", day } : { kind: "none" };
}
