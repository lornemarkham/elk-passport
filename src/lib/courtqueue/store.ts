import { createHmac } from "node:crypto";
import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { atlasServiceToken } from "@/lib/data/atlasAuth";

/**
 * **Where CourtQueue keeps its documents.** A tiny compare-and-swap store:
 * read some documents with their versions; write one only if its version is
 * still the one you read. Two phones changing the same night at the same
 * moment cannot both win — the loser re-reads and re-applies, so a court
 * cannot be given out twice and a player cannot be in two games.
 *
 * Production is Postgres (`passport_courtqueue_docs`, reached only through
 * two SECURITY DEFINER functions that check the server's key; see
 * supabase/migrations/20261110000000_passport_courtqueue.sql). Development
 * and tests use memory. **Production never falls back to memory**: without
 * the database and the key, the API says it is not ready.
 */

export interface Doc {
  readonly value: unknown;
  readonly version: number;
}

export interface DocStore {
  get(keys: readonly string[]): Promise<Map<string, Doc>>;
  /** `expected` 0 creates. False when someone else wrote first. */
  put(key: string, value: unknown, expected: number): Promise<boolean>;
  readonly kind: "memory" | "postgres";
}

export class NotReady extends Error {}

export function memoryStore(delayMs = 0): DocStore {
  const docs = new Map<string, { json: string; version: number }>();
  const pause = () =>
    delayMs ? new Promise((r) => setTimeout(r, Math.random() * delayMs)) : null;
  return {
    kind: "memory",
    async get(keys) {
      await pause();
      const out = new Map<string, Doc>();
      for (const k of keys) {
        const d = docs.get(k);
        if (d) out.set(k, { value: JSON.parse(d.json), version: d.version });
      }
      return out;
    },
    async put(key, value, expected) {
      await pause();
      const d = docs.get(key);
      if ((d?.version ?? 0) !== expected) return false;
      docs.set(key, { json: JSON.stringify(value), version: expected + 1 });
      return true;
    },
  };
}

function missing(error: PostgrestError): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42883" ||
    error.code === "42P01" ||
    /does not exist|Could not find the (function|table)/i.test(error.message)
  );
}

export function postgresStore(
  url: string,
  anon: string,
  key: string,
): DocStore {
  const db = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = (error: PostgrestError | null, what: string) => {
    if (!error) return;
    if (missing(error))
      throw new NotReady("the CourtQueue migration is not applied");
    if (error.code === "28000")
      throw new NotReady("the database holds a different CourtQueue key");
    throw new Error(`courtqueue ${what}: ${error.code} ${error.message}`);
  };
  let claimed = false;
  const claim = async () => {
    if (claimed) return;
    const { error } = await db.rpc("passport_courtqueue_claim", { p_key: key });
    check(error, "claim");
    claimed = true;
  };
  return {
    kind: "postgres",
    async get(keys) {
      await claim();
      const { data, error } = await db.rpc("passport_courtqueue_get", {
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
      const { data, error } = await db.rpc("passport_courtqueue_put", {
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

const g = globalThis as unknown as { __courtqueueStore?: DocStore };

/** The one store for this server process. */
export function courtStore(): DocStore {
  if (g.__courtqueueStore) return g.__courtqueueStore;
  const mode = process.env.COURTQUEUE_STORE;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = storeKey();
  if (mode === "memory" || (!mode && process.env.NODE_ENV !== "production")) {
    g.__courtqueueStore = memoryStore();
    return g.__courtqueueStore;
  }
  if (!url || !anon) throw new NotReady("Supabase is not configured");
  if (!key)
    throw new NotReady(
      "no server key: set COURTQUEUE_STORE_KEY (24+ characters) or ATLAS_SERVICE_TOKEN",
    );
  g.__courtqueueStore = postgresStore(url, anon, key);
  return g.__courtqueueStore;
}

/**
 * **The key the server proves itself with.** `COURTQUEUE_STORE_KEY` when it is
 * set; otherwise one derived — one-way, by HMAC — from the server-only Atlas
 * token every Passport deployment already has, so CourtQueue needs no new
 * secret to start. The derived key reveals nothing about the token. Changing
 * either later means resetting the recorded key (see the migration).
 */
export function storeKey(): string | null {
  const own = process.env.COURTQUEUE_STORE_KEY;
  if (own && own.length >= 24) return own;
  const base = atlasServiceToken();
  if (!base || base.length < 16) return null;
  return createHmac("sha256", base)
    .update("passport-courtqueue-store-v1")
    .digest("base64url");
}

/** Tests only. */
export function setStoreForTests(store: DocStore | undefined) {
  g.__courtqueueStore = store;
}
