import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminVerdict } from "@/lib/admin/adminPolicy";
import { ATLAS_BASE_URL, atlasAuthHeaders } from "@/lib/data/atlasAuth";
import { published, type Listing, type Network } from "@/domain/insiders/model";
import { setAtlas, withSeed, type Actor } from "@/domain/insiders/review";
import { SEED } from "@/domain/insiders/seed";
import { changeNetwork, readNetwork, usesMemory } from "./store";

export { NotReady } from "./store";

/**
 * **The Local Insider Network on the server**: who is asking, the network as
 * it stands (with the researched seed listings joined once), and handing a
 * published listing's organizer page to Atlas.
 */

export const salt = () => randomBytes(2).toString("hex");

/** The network with the seed listings present, whether or not it was ever written. */
export async function network(): Promise<Network> {
  return withSeed((await readNetwork()).network, SEED);
}

/** A change, with the seed joined first so a seed listing can be reviewed like any other. */
export function change<T>(
  fn: (n: Network) => { network: Network; result: T },
): Promise<T> {
  return changeNetwork((stored) => fn(withSeed(stored, SEED)));
}

export async function publishedListings(now = new Date()) {
  try {
    return published(await network(), now);
  } catch (error) {
    // Discovery is never held hostage by the network: no store, no section.
    console.error(
      "[insiders] unavailable:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * **A stand-in identity for the local test server only**: with
 * `INSIDERS_STORE=memory` and `INSIDERS_TEST_IDENTITY=on`, a cookie
 * `insiders-as=<email>` signs that address in. Production uses Postgres and
 * never sets either, so this path cannot exist there.
 */
function testIdentityEnabled(): boolean {
  return (
    usesMemory() &&
    process.env.INSIDERS_STORE === "memory" &&
    process.env.INSIDERS_TEST_IDENTITY === "on"
  );
}

interface Account {
  readonly email: string;
  readonly confirmed: boolean;
}

async function account(): Promise<Account | null> {
  if (testIdentityEnabled()) {
    const as = (await cookies()).get("insiders-as")?.value;
    if (as)
      return { email: decodeURIComponent(as).toLowerCase(), confirmed: true };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return {
      email: user.email.toLowerCase(),
      confirmed: !!user.email_confirmed_at,
    };
  } catch {
    return null;
  }
}

/**
 * **Who is asking**: an administrator (the curator allowlist, `ADMIN_EMAILS`),
 * an invited ambassador (a verified Passport account whose email an
 * administrator added), a signed-in person, or a visitor. An unverified
 * address is a visitor, for the same reason the admin gate refuses one.
 */
export async function actor(
  net?: Network,
): Promise<Actor & { signedIn: boolean }> {
  const me = await account();
  if (!me || !me.confirmed)
    return { role: "visitor", who: "visitor", signedIn: !!me };
  const verdict = adminVerdict({
    email: me.email,
    email_confirmed_at: "confirmed",
  });
  const n = net ?? (await network());
  const ambassador = n.ambassadors.find(
    (a) => a.email === me.email && a.active,
  );
  if (verdict.ok)
    return {
      role: "admin",
      who: me.email,
      signedIn: true,
      ...(ambassador ? { ambassador } : {}),
    };
  if (ambassador)
    return { role: "ambassador", who: me.email, ambassador, signedIn: true };
  return { role: "visitor", who: me.email, signedIn: true };
}

/**
 * **Hand a published listing to Atlas**: its organizer's page is queued as an
 * Atlas candidate source (`POST /admin/candidate-sources`, the curator
 * workbench's own seam), with the reason in words. Atlas reads it with its
 * own fetcher and rules — robots, provenance, review — and becomes the source
 * of truth for whatever it learns. Idempotent by URL on Atlas's side.
 */
export async function queueInAtlas(
  listing: Listing,
  now = new Date(),
): Promise<Listing["atlas"]> {
  const at = now.toISOString();
  const url = listing.organizerUrl ?? listing.dates?.source;
  if (!url) return { state: "no-url", at };
  const token = process.env.ADMIN_TOKEN;
  if (!token)
    return {
      state: "not-configured",
      at,
      detail: "ADMIN_TOKEN is not set for this app",
    };
  try {
    const response = await fetch(`${ATLAS_BASE_URL}/admin/candidate-sources`, {
      method: "POST",
      headers: atlasAuthHeaders({
        "x-admin-token": token,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        url,
        sourceType: "community-listing",
        discoveryBasis: "first-party-url",
        entityIds: listing.atlasEntityId ? [listing.atlasEntityId] : [],
        reason:
          `Go Have a Day Local Insider Network: "${listing.title}" (${listing.kind}, ${listing.place.town}) was published after review on ${at.slice(0, 10)}. Interests: ${listing.interests.join(", ")}. Provenance: ${listing.provenance}`.slice(
            0,
            1000,
          ),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      candidate?: { id?: string };
      alreadyQueued?: boolean;
      error?: string;
    };
    if (!response.ok)
      return {
        state: "failed",
        at,
        detail: `Atlas answered ${response.status}${body.error ? `: ${body.error}` : ""}`,
      };
    return {
      state: body.alreadyQueued ? "already-queued" : "queued",
      at,
      ...(body.candidate?.id ? { candidateId: body.candidate.id } : {}),
    };
  } catch (error) {
    return {
      state: "failed",
      at,
      detail: `Atlas unreachable: ${(error as Error).message}`,
    };
  }
}

/** After publishing: queue in Atlas and record what happened on the listing. */
export async function afterPublish(
  listing: Listing,
): Promise<Listing["atlas"]> {
  const atlas = await queueInAtlas(listing);
  await change((n) => ({
    network: setAtlas(n, listing.id, atlas),
    result: null,
  }));
  return atlas;
}
