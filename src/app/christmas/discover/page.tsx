import { redirect } from "next/navigation";

/**
 * **Christmas discovery lives on the landing page now** (owner brief M1128,
 * "One Beautiful Experience": _Christmas Home and Discover are the same
 * experience_). This address is kept so every shared link, QR code and
 * bookmark still opens on what it showed: its query — place, days,
 * distance, categories — is carried to `/christmas`, at its discovery.
 *
 * `all=` (a shelf's "Show all") is dropped: the landing page shows more in
 * place. `place=all` still opens the listings with no confirmed place.
 */
export default async function ChristmasDiscoverRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "all" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) q.append(key, v);
  }
  const query = q.toString();
  redirect(`/christmas${query ? `?${query}` : ""}#discover`);
}
