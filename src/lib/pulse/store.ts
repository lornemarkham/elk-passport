import { createHmac } from "node:crypto";
import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { atlasServiceToken } from "@/lib/data/atlasAuth";
import {
  REPORTS_TO_REVIEW,
  isOpen,
  type Pulse,
  type PulseStatus,
  type ReportReason,
} from "./model";
import type { VoteRow } from "./results";

/**
 * **Where People's Pulse keeps its questions, votes and reports.**
 *
 * Production is Postgres: four `passport_pulse_*` tables that no API role can
 * read, reached only through SECURITY DEFINER functions that check the
 * server's key (supabase/migrations/20261118000000_passport_pulse.sql, the
 * same model as CourtQueue, ADR 017). The checks that must be atomic — one
 * vote per voter, a per-network cap, a closed or hidden Pulse refusing votes,
 * three reports taking a Pulse off the air — happen inside those functions.
 * Development and tests use memory with the same rules. **Production never
 * falls back to memory**: without the database and the key it is "not ready".
 */

export class NotReady extends Error {}

export type VoteOutcome =
  "ok" | "duplicate" | "closed" | "missing" | "bad-option" | "limited";

export interface NewVote {
  readonly pulseId: string;
  /** One-way hash of the device cookie. */
  readonly voter: string;
  /** One-way, daily-rotating hash of the network address. */
  readonly net: string;
  readonly option: string;
  readonly circle: string;
  readonly via: string | null;
  readonly province: string | null;
  readonly city: string | null;
  readonly reason?: string | null;
  readonly ranking?: string | null;
  readonly group?: string | null;
}

/** What visitors do that a vote doesn't record, counted per day, never per person. */
export const EVENTS = ["share", "card", "link-open", "circle-ask"] as const;
export type PulseEvent = (typeof EVENTS)[number];
export const isEvent = (v: unknown): v is PulseEvent =>
  typeof v === "string" && (EVENTS as readonly string[]).includes(v);

/** Aggregate usage over the last `days` days. Counts only. */
export interface Usage {
  readonly days: number;
  /** Per UTC day, newest first. */
  readonly daily: readonly {
    readonly day: string;
    readonly created: number;
    readonly votes: number;
    readonly referredVotes: number;
    readonly events: Readonly<Partial<Record<PulseEvent, number>>>;
  }[];
  /** Pulses made and votes cast in the window, by kind and by template. */
  readonly byKind: readonly {
    readonly kind: string;
    readonly created: number;
    readonly votes: number;
  }[];
  readonly byTemplate: readonly {
    readonly template: string;
    readonly created: number;
  }[];
  /** Distinct browsers that voted in the window, and those that voted on two or more days. */
  readonly voters: number;
  readonly returningVoters: number;
}

export interface Listed {
  readonly pulse: Pulse;
  readonly total: number;
  readonly lastDay: number;
}

export interface Reported {
  readonly pulse: Pulse;
  readonly total: number;
  readonly reports: readonly {
    readonly reason: ReportReason;
    readonly note: string | null;
    readonly at: string;
  }[];
}

export interface PulseStore {
  readonly kind: "memory" | "postgres";
  /** "limited" when this creator or network has made `maxPerDay` today. */
  create(
    pulse: Pulse,
    by: { creator: string; net: string },
    maxPerDay: number,
  ): Promise<"ok" | "limited" | "taken">;
  get(id: string): Promise<Pulse | null>;
  vote(vote: NewVote, netCap: number): Promise<VoteOutcome>;
  /** This voter's own answer, for them only. */
  mine(
    pulseId: string,
    voter: string,
  ): Promise<{ option: string; at: string } | null>;
  /** Every vote, anonymous: no voter, no network. Server-side only. */
  votes(pulseId: string): Promise<VoteRow[]>;
  /** Live Pulses from the last 60 days, newest first, with their counts. */
  list(limit: number): Promise<Listed[]>;
  report(
    pulseId: string,
    reporter: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<"ok" | "duplicate" | "missing">;
  /** Pulses that are reported, under review or removed. */
  reported(): Promise<Reported[]>;
  setStatus(id: string, status: PulseStatus): Promise<boolean>;
  /**
   * Make `pulseId` the Question of the Day for `day` (YYYY-MM-DD), replacing
   * whatever was there; `null` clears the day. False if there is no such Pulse.
   */
  feature(day: string, pulseId: string | null): Promise<boolean>;
  /** Featured days from `fromDay` on, soonest first. */
  featured(
    fromDay: string,
    limit: number,
  ): Promise<{ day: string; item: Listed }[]>;
  /** Add one to today's count of `event` for Pulses of this kind. */
  count(event: PulseEvent, kind: string): Promise<void>;
  usage(days: number): Promise<Usage>;
}

const kindKey = (p: Pick<Pulse, "kind">) => p.kind ?? "pulse";

export interface UsageRows {
  readonly pulses: readonly {
    day: string;
    kind: string;
    template: string | null;
    n: number;
  }[];
  readonly votes: readonly {
    day: string;
    kind: string;
    n: number;
    referred: number;
  }[];
  readonly events: readonly { day: string; event: string; n: number }[];
  readonly voters: number;
  readonly returning: number;
}

/** Shared by both stores: aggregate rows (counts already) into the Usage summary. */
export function summariseUsage(days: number, rows: UsageRows): Usage {
  const daily = new Map<
    string,
    {
      created: number;
      votes: number;
      referredVotes: number;
      events: Partial<Record<PulseEvent, number>>;
    }
  >();
  const dayOf = (d: string) => {
    let row = daily.get(d);
    if (!row)
      daily.set(
        d,
        (row = { created: 0, votes: 0, referredVotes: 0, events: {} }),
      );
    return row;
  };
  const kinds = new Map<string, { created: number; votes: number }>();
  const kindOf = (k: string) => {
    let row = kinds.get(k);
    if (!row) kinds.set(k, (row = { created: 0, votes: 0 }));
    return row;
  };
  const templates = new Map<string, number>();
  for (const p of rows.pulses) {
    dayOf(p.day).created += p.n;
    kindOf(p.kind).created += p.n;
    if (p.template)
      templates.set(p.template, (templates.get(p.template) ?? 0) + p.n);
  }
  for (const v of rows.votes) {
    const row = dayOf(v.day);
    row.votes += v.n;
    row.referredVotes += v.referred;
    kindOf(v.kind).votes += v.n;
  }
  for (const e of rows.events) {
    if (!isEvent(e.event)) continue;
    const row = dayOf(e.day);
    row.events[e.event] = (row.events[e.event] ?? 0) + e.n;
  }
  return {
    days,
    daily: [...daily]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, r]) => ({ day, ...r })),
    byKind: [...kinds]
      .map(([kind, r]) => ({ kind, ...r }))
      .sort((a, b) => b.votes - a.votes || b.created - a.created),
    byTemplate: [...templates]
      .map(([template, created]) => ({ template, created }))
      .sort((a, b) => b.created - a.created),
    voters: rows.voters,
    returningVoters: rows.returning,
  };
}

// ── Memory ──────────────────────────────────────────────────────────────────

interface MemVote extends NewVote {
  readonly at: string;
}

export function memoryStore(now: () => Date = () => new Date()): PulseStore {
  const pulses = new Map<
    string,
    { pulse: Pulse; creator: string; net: string }
  >();
  const votes = new Map<string, MemVote[]>();
  const reports = new Map<
    string,
    {
      reporter: string;
      reason: ReportReason;
      note: string | null;
      at: string;
    }[]
  >();
  const day = (iso: string) => iso.slice(0, 10);
  const featuredDays = new Map<string, string>();
  const events = new Map<string, number>();
  const count = (id: string) => votes.get(id)?.length ?? 0;
  return {
    kind: "memory",
    async create(pulse, by, maxPerDay) {
      if (pulses.has(pulse.id)) return "taken";
      const today = day(now().toISOString());
      const made = [...pulses.values()].filter(
        (p) =>
          day(p.pulse.createdAt) === today &&
          (p.creator === by.creator || p.net === by.net),
      ).length;
      if (made >= maxPerDay) return "limited";
      pulses.set(pulse.id, { pulse, ...by });
      return "ok";
    },
    async get(id) {
      return pulses.get(id)?.pulse ?? null;
    },
    async vote(v, netCap) {
      const p = pulses.get(v.pulseId)?.pulse;
      if (!p || p.status === "removed") return "missing";
      if (!isOpen(p, now())) return "closed";
      if (!p.options.some((o) => o.id === v.option)) return "bad-option";
      if (v.ranking && !/^[1-6]{2,6}$/.test(v.ranking)) return "bad-option";
      const list = votes.get(v.pulseId) ?? [];
      if (list.some((x) => x.voter === v.voter)) return "duplicate";
      if (list.filter((x) => x.net === v.net).length >= netCap)
        return "limited";
      list.push({ ...v, at: now().toISOString() });
      votes.set(v.pulseId, list);
      return "ok";
    },
    async mine(pulseId, voter) {
      const v = votes.get(pulseId)?.find((x) => x.voter === voter);
      return v ? { option: v.option, at: v.at } : null;
    },
    async votes(pulseId) {
      return (votes.get(pulseId) ?? []).map((v) => ({
        option: v.option,
        province: v.province,
        city: v.city,
        at: v.at,
        circle: v.circle,
        via: v.via,
        reason: v.reason ?? null,
        ranking: v.ranking ?? null,
        group: v.group ?? null,
      }));
    },
    async list(limit) {
      const since = now().getTime() - 60 * 86_400_000;
      const dayAgo = now().getTime() - 86_400_000;
      return [...pulses.values()]
        .map((p) => p.pulse)
        .filter(
          (p) =>
            p.status === "live" &&
            !p.unlisted &&
            new Date(p.createdAt).getTime() >= since,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((pulse) => ({
          pulse,
          total: count(pulse.id),
          lastDay: (votes.get(pulse.id) ?? []).filter(
            (v) => new Date(v.at).getTime() >= dayAgo,
          ).length,
        }));
    },
    async report(pulseId, reporter, reason, note) {
      const entry = pulses.get(pulseId);
      if (!entry || entry.pulse.status === "removed") return "missing";
      const list = reports.get(pulseId) ?? [];
      if (list.some((r) => r.reporter === reporter)) return "duplicate";
      list.push({ reporter, reason, note, at: now().toISOString() });
      reports.set(pulseId, list);
      if (list.length >= REPORTS_TO_REVIEW && entry.pulse.status === "live")
        entry.pulse = { ...entry.pulse, status: "review" };
      return "ok";
    },
    async reported() {
      return [...pulses.values()]
        .filter((p) => reports.has(p.pulse.id) || p.pulse.status !== "live")
        .map(({ pulse }) => ({
          pulse,
          total: count(pulse.id),
          reports: (reports.get(pulse.id) ?? []).map(
            ({ reason, note, at }) => ({ reason, note, at }),
          ),
        }));
    },
    async setStatus(id, status) {
      const entry = pulses.get(id);
      if (!entry) return false;
      entry.pulse = { ...entry.pulse, status };
      return true;
    },
    async feature(d, pulseId) {
      if (pulseId === null) {
        featuredDays.delete(d);
        return true;
      }
      if (!pulses.has(pulseId)) return false;
      featuredDays.set(d, pulseId);
      return true;
    },
    async featured(fromDay, limit) {
      const dayAgo = now().getTime() - 86_400_000;
      return [...featuredDays]
        .filter(
          ([d, id]) => d >= fromDay && pulses.get(id)?.pulse.status === "live",
        )
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([d, id]) => ({
          day: d,
          item: {
            pulse: pulses.get(id)!.pulse,
            total: count(id),
            lastDay: (votes.get(id) ?? []).filter(
              (v) => new Date(v.at).getTime() >= dayAgo,
            ).length,
          },
        }));
    },
    async count(event, kind) {
      const k = `${now().toISOString().slice(0, 10)}|${event}|${kind}`;
      events.set(k, (events.get(k) ?? 0) + 1);
    },
    async usage(days) {
      const since = new Date(now().getTime() - (days - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const bump = <T extends { n: number }>(
        m: Map<string, T>,
        k: string,
        make: () => T,
      ) => {
        const row = m.get(k) ?? make();
        row.n += 1;
        m.set(k, row);
        return row;
      };
      const ps = new Map<
        string,
        { day: string; kind: string; template: string | null; n: number }
      >();
      const vs = new Map<
        string,
        { day: string; kind: string; n: number; referred: number }
      >();
      const voterDays = new Map<string, Set<string>>();
      for (const { pulse } of pulses.values()) {
        const d = day(pulse.createdAt);
        const kind = kindKey(pulse);
        if (d >= since)
          bump(ps, `${d}|${kind}|${pulse.template ?? ""}`, () => ({
            day: d,
            kind,
            template: pulse.template ?? null,
            n: 0,
          }));
        for (const v of votes.get(pulse.id) ?? []) {
          const vd = day(v.at);
          if (vd < since) continue;
          const row = bump(vs, `${vd}|${kind}`, () => ({
            day: vd,
            kind,
            n: 0,
            referred: 0,
          }));
          if (v.via) row.referred += 1;
          const set = voterDays.get(v.voter) ?? new Set<string>();
          set.add(vd);
          voterDays.set(v.voter, set);
        }
      }
      return summariseUsage(days, {
        pulses: [...ps.values()],
        votes: [...vs.values()],
        events: [...events]
          .map(([k, n]) => {
            const [d, event] = k.split("|") as [string, string];
            return { day: d, event, n };
          })
          .filter((e) => e.day >= since),
        voters: voterDays.size,
        returning: [...voterDays.values()].filter((x) => x.size >= 2).length,
      });
    },
  };
}

// ── Postgres ────────────────────────────────────────────────────────────────

function missingSchema(error: PostgrestError): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42883" ||
    error.code === "42P01" ||
    /does not exist|Could not find the (function|table)/i.test(error.message)
  );
}

interface PulseRow {
  id: string;
  status: PulseStatus;
  data: Omit<Pulse, "id" | "status" | "createdAt" | "expiresAt">;
  expires_at: string | null;
  created_at: string;
}

const fromRow = (r: PulseRow): Pulse => ({
  ...r.data,
  id: r.id,
  status: r.status,
  expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
  createdAt: new Date(r.created_at).toISOString(),
});

export type Rpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

/**
 * Call a `passport_pulse_*` function with the server's key, claiming the key
 * on first use. Missing functions or tables read as "not ready".
 */
export function pulseRpc(url: string, anon: string, key: string): Rpc {
  const db = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = (error: PostgrestError | null, what: string) => {
    if (!error) return;
    if (missingSchema(error))
      throw new NotReady("the People's Pulse migration is not applied");
    if (error.code === "28000")
      throw new NotReady("the database holds a different People's Pulse key");
    throw new Error(`pulse ${what}: ${error.code} ${error.message}`);
  };
  let claimed = false;
  return async <T>(fn: string, args: Record<string, unknown>) => {
    if (!claimed) {
      const { error } = await db.rpc("passport_pulse_claim", { p_key: key });
      check(error, "claim");
      claimed = true;
    }
    const { data, error } = await db.rpc(`passport_pulse_${fn}`, {
      p_key: key,
      ...args,
    });
    check(error, fn);
    return data as T;
  };
}

export function postgresStore(
  url: string,
  anon: string,
  key: string,
): PulseStore {
  // Quick Ideas' columns and functions (…_modes migration). Until they are
  // applied, plain votes go through V1's functions so V1 Pulses keep working.
  let modes: boolean | null = null;
  const rpc = pulseRpc(url, anon, key);
  return {
    kind: "postgres",
    async create(pulse, by, maxPerDay) {
      const { id, status, createdAt, expiresAt, ...data } = pulse;
      void status;
      void createdAt;
      return rpc<"ok" | "limited" | "taken">("create", {
        p_id: id,
        p_data: data,
        p_expires_at: expiresAt,
        p_creator: by.creator,
        p_net: by.net,
        p_max_per_day: maxPerDay,
      });
    },
    async get(id) {
      const rows = await rpc<PulseRow[]>("get", { p_id: id });
      return rows?.[0] ? fromRow(rows[0]) : null;
    },
    async vote(v, netCap) {
      const base = {
        p_pulse: v.pulseId,
        p_voter: v.voter,
        p_net: v.net,
        p_option: v.option,
        p_circle: v.circle,
        p_via: v.via,
        p_province: v.province,
        p_city: v.city,
        p_net_cap: netCap,
      };
      const plain = !v.reason && !v.ranking && !v.group;
      if (modes === false && plain) return rpc<VoteOutcome>("vote", base);
      try {
        const out = await rpc<VoteOutcome>("cast", {
          ...base,
          p_reason: v.reason ?? null,
          p_ranking: v.ranking ?? null,
          p_group: v.group ?? null,
        });
        modes = true;
        return out;
      } catch (e) {
        if (!(e instanceof NotReady) || !plain || modes === true) throw e;
        modes = false;
        return rpc<VoteOutcome>("vote", base);
      }
    },
    async mine(pulseId, voter) {
      const rows = await rpc<{ option: string; at: string }[]>("mine", {
        p_pulse: pulseId,
        p_voter: voter,
      });
      const r = rows?.[0];
      return r ? { option: r.option, at: new Date(r.at).toISOString() } : null;
    },
    async votes(pulseId) {
      let rows: VoteRow[] | null;
      if (modes === false)
        rows = await rpc<VoteRow[]>("votes", { p_pulse: pulseId });
      else {
        try {
          rows = await rpc<VoteRow[]>("rows", { p_pulse: pulseId });
          modes = true;
        } catch (e) {
          if (!(e instanceof NotReady) || modes === true) throw e;
          modes = false;
          rows = await rpc<VoteRow[]>("votes", { p_pulse: pulseId });
        }
      }
      return (rows ?? []).map((r) => ({
        ...r,
        at: new Date(r.at).toISOString(),
      }));
    },
    async list(limit) {
      const rows = await rpc<
        (PulseRow & { total: number; last_day: number })[]
      >("list", { p_limit: limit });
      // Unlisted Pulses are filtered in SQL too, once the modes migration is in.
      return (rows ?? [])
        .map((r) => ({
          pulse: fromRow(r),
          total: Number(r.total),
          lastDay: Number(r.last_day),
        }))
        .filter((l) => !l.pulse.unlisted);
    },
    async report(pulseId, reporter, reason, note) {
      return rpc<"ok" | "duplicate" | "missing">("report", {
        p_pulse: pulseId,
        p_reporter: reporter,
        p_reason: reason,
        p_note: note,
        p_threshold: REPORTS_TO_REVIEW,
      });
    },
    async reported() {
      const rows = await rpc<
        (PulseRow & { total: number; reports: Reported["reports"] | null })[]
      >("reported", {});
      return (rows ?? []).map((r) => ({
        pulse: fromRow(r),
        total: Number(r.total),
        reports: r.reports ?? [],
      }));
    },
    async setStatus(id, status) {
      return (
        (await rpc<boolean>("set_status", {
          p_id: id,
          p_status: status,
        })) === true
      );
    },
    async feature(day, pulseId) {
      return (
        (await rpc<boolean>("feature", { p_day: day, p_pulse: pulseId })) ===
        true
      );
    },
    async featured(fromDay, limit) {
      const rows = await rpc<
        (PulseRow & { day: string; total: number; last_day: number })[]
      >("featured", { p_from: fromDay, p_limit: limit });
      return (rows ?? []).map((r) => ({
        day: String(r.day).slice(0, 10),
        item: {
          pulse: fromRow(r),
          total: Number(r.total),
          lastDay: Number(r.last_day),
        },
      }));
    },
    async count(event, kind) {
      await rpc<null>("count", { p_event: event, p_kind: kind });
    },
    async usage(days) {
      const u = await rpc<UsageRows | null>("usage", { p_days: days });
      const d = (t: unknown) => String(t).slice(0, 10);
      return summariseUsage(days, {
        pulses: (u?.pulses ?? []).map((r) => ({
          ...r,
          day: d(r.day),
          n: Number(r.n),
        })),
        votes: (u?.votes ?? []).map((r) => ({
          ...r,
          day: d(r.day),
          n: Number(r.n),
          referred: Number(r.referred),
        })),
        events: (u?.events ?? []).map((r) => ({
          ...r,
          day: d(r.day),
          n: Number(r.n),
        })),
        voters: Number(u?.voters ?? 0),
        returning: Number(u?.returning ?? 0),
      });
    },
  };
}

// ── The one store for this process ──────────────────────────────────────────

const g = globalThis as unknown as { __pulseStore?: PulseStore };

export function pulseStore(): PulseStore {
  if (g.__pulseStore) return g.__pulseStore;
  const mode = process.env.PULSE_STORE;
  if (mode === "memory" || (!mode && process.env.NODE_ENV !== "production")) {
    g.__pulseStore = memoryStore();
    return g.__pulseStore;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = pulseKey();
  if (!url || !anon) throw new NotReady("Supabase is not configured");
  if (!key)
    throw new NotReady(
      "no server key: set PULSE_STORE_KEY (24+ characters) or ATLAS_SERVICE_TOKEN",
    );
  g.__pulseStore = postgresStore(url, anon, key);
  return g.__pulseStore;
}

/**
 * **The server's secret for People's Pulse.** `PULSE_STORE_KEY` when set;
 * otherwise derived one-way (HMAC) from the server-only Atlas token every
 * deployment already has, so the feature needs no new secret. It proves the
 * server to the database, and it keys the one-way hashes of device cookies
 * and network addresses, so a leaked table names no device and no address.
 */
export function pulseKey(): string | null {
  const own = process.env.PULSE_STORE_KEY;
  if (own && own.length >= 24) return own;
  const base = atlasServiceToken();
  if (base && base.length >= 16)
    return createHmac("sha256", base)
      .update("passport-peoples-pulse-v1")
      .digest("base64url");
  // Development and tests have no Atlas token; the memory store needs a key
  // for hashing only, and it never leaves this process.
  if (
    process.env.PULSE_STORE === "memory" ||
    process.env.NODE_ENV !== "production"
  )
    return "peoples-pulse-development-key-not-a-secret";
  return null;
}

/** Tests only. */
export function setPulseStoreForTests(store: PulseStore | undefined) {
  g.__pulseStore = store;
}
