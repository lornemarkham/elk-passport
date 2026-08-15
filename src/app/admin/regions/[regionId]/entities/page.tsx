import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ regionId: string }> };

/**
 * **Removed 2026-08-16.** This level no longer exists.
 *
 * It answered *"which entities in this destination need attention?"* — the
 * Region page's question with extra words. Two screens with one
 * responsibility, and a "Browse & prioritise" click between a curator and
 * the list they came for. The entity browser now lives on the Region page
 * itself; nothing about the list changed, only the level it lived at.
 *
 * See ADR 028 — **a hierarchy level must have a unique responsibility.**
 *
 * ## Why a redirect rather than a deletion
 *
 * Deleting the route would 404 every bookmark and every link in a
 * conversation, and a 404 is the least informative way to communicate
 * "this moved". The destination contains everything the old page had, so
 * the redirect loses nothing.
 *
 * `permanentRedirect` (308) rather than a temporary one, because this is
 * not coming back — the whole point of the decision is that the level was
 * never justified. A 308 lets browsers and crawlers stop asking.
 *
 * **This file is expected to be deleted**, once no bookmark plausibly
 * points here. It is a migration aid, not a route.
 */
export default async function RemovedRegionEntitiesPage({ params }: Props) {
  const { regionId } = await params;
  permanentRedirect(`/admin/regions/${regionId}`);
}
