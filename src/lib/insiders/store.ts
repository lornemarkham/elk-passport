import { createHmac } from "node:crypto";
import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { atlasServiceToken } from "@/lib/data/atlasAuth";
import { memoryStore, type Doc, type DocStore } from "@/lib/courtqueue/store";
import { EMPTY_NETWORK, type Network } from "@/domain/insiders/model";

/**
 * **Where the Local Insider Network keeps itself**: one versioned document,
 * written only if its version is still the one that was read — CourtQueue's
 * compare-and-swap store (ADR 017), reused, in its own table
 * (`passport_insider_docs`, supabase/migrations/20261111000000_passport_insiders.sql).
 *
 * The network is small (dozens of listings, a handful of ambassadors), so
 * one document keeps duplicate checks and the review queue a read away, and
 * two reviewers pressing Publish at once cannot both win.
 *
 * Production is Postgres behind SECURITY DEFINER functions that check the
 * server's key — derived from the Atlas token every deployment already has,
 * so no new secret is needed. Development and tests use memory
 * (`INSIDERS_STORE=memory`). Production never falls back to memory.
 */

export class NotReady extends Error {}

const DOC = "network";

function missing(error: PostgrestError): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42883" ||
    error.code === "42P01" ||
    /does not exist|Could not find the (function|table)/i.test(error.message)
  );
}

function postgresStore(url: string, anon: string, key: string): DocStore {
  const db = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = (error: PostgrestError | null, what: string) => {
    if (!error) return;
    if (missing(error))
      throw new NotReady("the insiders migration is not applied");
    if (error.code === "28000")
      throw new NotReady("the database holds a different insiders key");
    throw new Error(`insiders ${what}: ${error.code} ${error.message}`);
  };
  let claimed = false;
  const claim = async () => {
    if (claimed) return;
    const { error } = await db.rpc("passport_insiders_claim", { p_key: key });
    check(error, "claim");
    claimed = true;
  };
  return {
    kind: "postgres",
    async get(keys) {
      await claim();
      const { data, error } = await db.rpc("passport_insiders_get", {
        p_key: key,
        p_keys: [...keys],
      });
      check(error, "get");
      const out = new Map<string, Doc>();
      for (const row of (data ?? []) as {
        key: string;
        version: number;
        doc: unknown;
      }[])
        out.set(row.key, { value: row.doc, version: Number(row.version) });
      return out;
    },
    async put(docKey, value, expected) {
      await claim();
      const { data, error } = await db.rpc("passport_insiders_put", {
        p_key: key,
        p_doc_key: docKey,
        p_expected: expected,
        p_doc: value,
      });
      check(error, "put");
      return data === true;
    },
  };
}

/** One-way from the Atlas token, so the key reveals nothing about it. */
export function storeKey(): string | null {
  const own = process.env.INSIDERS_STORE_KEY;
  if (own && own.length >= 24) return own;
  const base = atlasServiceToken();
  if (!base || base.length < 16) return null;
  return createHmac("sha256", base)
    .update("passport-insiders-store-v1")
    .digest("base64url");
}

/** Memory outside production unless told otherwise; never memory in production. */
export function usesMemory(): boolean {
  const mode = process.env.INSIDERS_STORE;
  return mode === "memory" || (!mode && process.env.NODE_ENV !== "production");
}

const g = globalThis as unknown as { __insidersStore?: DocStore };

export function insidersStore(): DocStore {
  if (g.__insidersStore) return g.__insidersStore;
  if (usesMemory()) return (g.__insidersStore = memoryStore());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new NotReady("Supabase is not configured");
  const key = storeKey();
  if (!key)
    throw new NotReady(
      "no server key: set INSIDERS_STORE_KEY or ATLAS_SERVICE_TOKEN",
    );
  return (g.__insidersStore = postgresStore(url, anon, key));
}

/** Tests only. */
export function setInsidersStoreForTests(store: DocStore | undefined) {
  g.__insidersStore = store;
}

/** The network as stored, with its version; empty and version 0 before the first write. */
export async function readNetwork(
  store = insidersStore(),
): Promise<{ network: Network; version: number }> {
  const doc = (await store.get([DOC])).get(DOC);
  if (!doc) return { network: EMPTY_NETWORK, version: 0 };
  return { network: doc.value as Network, version: doc.version };
}

/**
 * Apply `change` to the latest network and write it, re-reading and
 * re-applying when someone else wrote first. `change` is pure: it may run
 * more than once.
 */
export async function changeNetwork<T>(
  change: (network: Network) => { network: Network; result: T },
  store = insidersStore(),
): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { network, version } = await readNetwork(store);
    const { network: next, result } = change(network);
    if (next === network) return result;
    if (await store.put(DOC, next, version)) return result;
  }
  throw new Error("insiders: too many simultaneous changes, try again");
}
