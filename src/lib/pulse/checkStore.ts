import type { Pulse, PulseScope } from "./model";
import {
  POST_REPORTS_TO_HIDE,
  type Assessment,
  type AskType,
  type CheckData,
  type CheckEvent,
  type Post,
  type PostType,
} from "./check";
import {
  NotReady,
  pulseKey,
  pulseRpc,
  pulseStore,
  type PulseStore,
  type Rpc,
} from "./store";

/**
 * **Where Pulse Check keeps what a Pulse doesn't**: the investigation, the
 * discussion, the private screenshot, and aggregate visit and share counts.
 *
 * The poll itself is an ordinary Pulse of kind `check` in the Pulse store, so
 * votes, circles, results and reports are People's Pulse's own. Production is
 * Postgres (`supabase/migrations/20261120000000_passport_pulse_check.sql`),
 * reached the same way as the Pulse store: key-checked SECURITY DEFINER
 * functions, no table readable by any API role.
 */

export interface StoredCheck {
  readonly check: CheckData;
  readonly version: number;
}

/** What the discovery shelves need about one check. Counts only. */
export interface CheckListed {
  readonly pulseId: string;
  readonly slug: string;
  readonly status: Pulse["status"];
  readonly claim: string;
  readonly assessment: Assessment;
  readonly ask: AskType;
  readonly scope: PulseScope;
  readonly sources: number;
  readonly corrections: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly votes: number;
  readonly votesLastDay: number;
  readonly posts: number;
  readonly postsLastDay: number;
}

export interface NewPost {
  readonly id: string;
  readonly pulseId: string;
  readonly type: PostType;
  readonly body: string;
  readonly url: string | null;
  /** One-way hash of the author's device. */
  readonly author: string;
  /** One-way, daily-rotating hash of the network. */
  readonly net: string;
}

export interface ReportedPost extends Post {
  readonly pulseId: string;
  readonly status: "live" | "hidden" | "removed";
  readonly reports: number;
}

export interface CheckFile {
  readonly mime: string;
  readonly bytes: Buffer;
}

export interface CheckEventRow {
  readonly day: string;
  readonly event: CheckEvent;
  readonly source: string;
  readonly n: number;
}

export interface CheckStore {
  readonly kind: "memory" | "postgres";
  /** The Pulse, its check and the private file, all or nothing. */
  create(
    pulse: Pulse,
    check: CheckData,
    by: { creator: string; net: string },
    maxPerDay: number,
    fingerprint: string,
    file: CheckFile | null,
  ): Promise<"ok" | "limited" | "taken">;
  get(pulseId: string): Promise<StoredCheck | null>;
  isCreator(pulseId: string, creator: string): Promise<boolean>;
  /** Replace the check, only from `version`, only by its creator or a moderator. */
  update(
    pulseId: string,
    check: CheckData,
    version: number,
    as: { creator: string } | "moderator",
  ): Promise<"ok" | "forbidden" | "conflict" | "missing">;
  file(pulseId: string): Promise<CheckFile | null>;
  /** Live checks from the last 90 days, newest first. */
  list(limit: number): Promise<CheckListed[]>;
  /** Live checks whose claim has this fingerprint or shares words with it. */
  addPost(
    post: NewPost,
    perPulsePerDay: number,
    perNetPerDay: number,
  ): Promise<"ok" | "limited" | "missing" | "taken">;
  /** Live posts, oldest first; `mine` marks the asker's own. */
  posts(pulseId: string, author: string | null): Promise<Post[]>;
  reportPost(
    postId: string,
    reporter: string,
    reason: string,
    threshold: number,
  ): Promise<"ok" | "duplicate" | "missing">;
  reportedPosts(): Promise<ReportedPost[]>;
  setPostStatus(
    postId: string,
    status: "live" | "hidden" | "removed",
  ): Promise<boolean>;
  count(event: CheckEvent, source: string): Promise<void>;
  usage(days: number): Promise<CheckEventRow[]>;
}

// ── Memory ──────────────────────────────────────────────────────────────────

export function memoryCheckStore(
  pulses: PulseStore,
  now: () => Date = () => new Date(),
): CheckStore {
  const checks = new Map<
    string,
    {
      check: CheckData;
      version: number;
      creator: string;
      fingerprint: string;
      file: CheckFile | null;
    }
  >();
  const posts = new Map<
    string,
    NewPost & {
      at: string;
      status: "live" | "hidden" | "removed";
      reporters: Set<string>;
    }
  >();
  const events = new Map<string, number>();
  const dayAgo = () => now().getTime() - 86_400_000;
  const today = () => now().toISOString().slice(0, 10);
  const publicPost = (p: NewPost & { at: string }, mine: boolean): Post => ({
    id: p.id,
    type: p.type,
    body: p.body,
    url: p.url,
    at: p.at,
    ...(mine ? { mine } : {}),
  });
  return {
    kind: "memory",
    async create(pulse, check, by, maxPerDay, fp, file) {
      const out = await pulses.create(pulse, by, maxPerDay);
      if (out !== "ok") return out;
      checks.set(pulse.id, {
        check,
        version: 1,
        creator: by.creator,
        fingerprint: fp,
        file,
      });
      return "ok";
    },
    async get(id) {
      const c = checks.get(id);
      return c ? { check: c.check, version: c.version } : null;
    },
    async isCreator(id, creator) {
      return checks.get(id)?.creator === creator;
    },
    async update(id, check, version, as) {
      const c = checks.get(id);
      if (!c) return "missing";
      if (as !== "moderator" && as.creator !== c.creator) return "forbidden";
      if (c.version !== version) return "conflict";
      c.check = check;
      c.version += 1;
      return "ok";
    },
    async file(id) {
      return checks.get(id)?.file ?? null;
    },
    async list(limit) {
      const since = now().getTime() - 90 * 86_400_000;
      const out: CheckListed[] = [];
      for (const [id, c] of checks) {
        const pulse = await pulses.get(id);
        if (!pulse || pulse.status !== "live") continue;
        if (new Date(pulse.createdAt).getTime() < since) continue;
        const votes = await pulses.votes(id);
        const ps = [...posts.values()].filter(
          (p) => p.pulseId === id && p.status === "live",
        );
        out.push({
          pulseId: id,
          slug: c.check.slug,
          status: pulse.status,
          claim: c.check.claim.text,
          assessment: c.check.assessment,
          ask: c.check.ask,
          scope: pulse.scope,
          sources: c.check.sources.length,
          corrections: c.check.corrections.length,
          createdAt: pulse.createdAt,
          updatedAt: c.check.updatedAt,
          votes: votes.length,
          votesLastDay: votes.filter(
            (v) => new Date(v.at).getTime() >= dayAgo(),
          ).length,
          posts: ps.length,
          postsLastDay: ps.filter((p) => new Date(p.at).getTime() >= dayAgo())
            .length,
        });
      }
      return out
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async addPost(post, perPulse, perNet) {
      const pulse = await pulses.get(post.pulseId);
      if (!pulse || pulse.status !== "live" || !checks.has(post.pulseId))
        return "missing";
      if (posts.has(post.id)) return "taken";
      const d = today();
      const mine = [...posts.values()].filter(
        (p) => p.at.slice(0, 10) === d && p.author === post.author,
      );
      if (mine.filter((p) => p.pulseId === post.pulseId).length >= perPulse)
        return "limited";
      if (
        [...posts.values()].filter(
          (p) => p.at.slice(0, 10) === d && p.net === post.net,
        ).length >= perNet
      )
        return "limited";
      posts.set(post.id, {
        ...post,
        at: now().toISOString(),
        status: "live",
        reporters: new Set(),
      });
      return "ok";
    },
    async posts(pulseId, author) {
      return [...posts.values()]
        .filter((p) => p.pulseId === pulseId && p.status === "live")
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((p) => publicPost(p, author !== null && p.author === author));
    },
    async reportPost(postId, reporter, _reason, threshold) {
      const p = posts.get(postId);
      if (!p || p.status === "removed") return "missing";
      if (p.reporters.has(reporter)) return "duplicate";
      p.reporters.add(reporter);
      if (p.reporters.size >= threshold && p.status === "live")
        p.status = "hidden";
      return "ok";
    },
    async reportedPosts() {
      return [...posts.values()]
        .filter((p) => p.reporters.size > 0 || p.status !== "live")
        .map((p) => ({
          ...publicPost(p, false),
          pulseId: p.pulseId,
          status: p.status,
          reports: p.reporters.size,
        }));
    },
    async setPostStatus(postId, status) {
      const p = posts.get(postId);
      if (!p) return false;
      p.status = status;
      return true;
    },
    async count(event, source) {
      const k = `${today()}|${event}|${source}`;
      events.set(k, (events.get(k) ?? 0) + 1);
    },
    async usage(days) {
      const since = new Date(now().getTime() - (days - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return [...events]
        .map(([k, n]) => {
          const [day, event, source] = k.split("|") as [
            string,
            CheckEvent,
            string,
          ];
          return { day, event, source, n };
        })
        .filter((r) => r.day >= since);
    },
  };
}

// ── Postgres ────────────────────────────────────────────────────────────────

interface ListRow {
  pulse_id: string;
  slug: string;
  status: Pulse["status"];
  claim: string;
  assessment: Assessment;
  ask: AskType;
  scope: PulseScope;
  sources: number;
  corrections: number;
  created_at: string;
  updated_at: string;
  votes: number;
  votes_last_day: number;
  posts: number;
  posts_last_day: number;
}

export function postgresCheckStore(rpc: Rpc): CheckStore {
  return {
    kind: "postgres",
    async create(pulse, check, by, maxPerDay, fp, file) {
      const { id, status, createdAt, expiresAt, ...data } = pulse;
      void status;
      void createdAt;
      return rpc<"ok" | "limited" | "taken">("check_create", {
        p_id: id,
        p_data: data,
        p_expires_at: expiresAt,
        p_creator: by.creator,
        p_net: by.net,
        p_max_per_day: maxPerDay,
        p_slug: check.slug,
        p_check: check,
        p_fingerprint: fp,
        p_file_mime: file?.mime ?? null,
        p_file: file ? file.bytes.toString("base64") : null,
      });
    },
    async get(id) {
      const rows = await rpc<{ data: CheckData; version: number }[]>(
        "check_get",
        { p_id: id },
      );
      const r = rows?.[0];
      return r ? { check: r.data, version: Number(r.version) } : null;
    },
    async isCreator(id, creator) {
      return (
        (await rpc<boolean>("check_is_creator", {
          p_id: id,
          p_creator: creator,
        })) === true
      );
    },
    async update(id, check, version, as) {
      return rpc<"ok" | "forbidden" | "conflict" | "missing">("check_update", {
        p_id: id,
        p_data: check,
        p_version: version,
        p_creator: as === "moderator" ? null : as.creator,
        p_moderator: as === "moderator",
      });
    },
    async file(id) {
      const rows = await rpc<{ mime: string; b64: string }[]>("check_file", {
        p_id: id,
      });
      const r = rows?.[0];
      return r ? { mime: r.mime, bytes: Buffer.from(r.b64, "base64") } : null;
    },
    async list(limit) {
      const rows = await rpc<ListRow[]>("check_list", { p_limit: limit });
      return (rows ?? []).map((r) => ({
        pulseId: r.pulse_id,
        slug: r.slug,
        status: r.status,
        claim: r.claim,
        assessment: r.assessment,
        ask: r.ask,
        scope: r.scope ?? { kind: "canada" },
        sources: Number(r.sources),
        corrections: Number(r.corrections),
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
        votes: Number(r.votes),
        votesLastDay: Number(r.votes_last_day),
        posts: Number(r.posts),
        postsLastDay: Number(r.posts_last_day),
      }));
    },
    async addPost(post, perPulse, perNet) {
      return rpc<"ok" | "limited" | "missing" | "taken">("post_add", {
        p_id: post.id,
        p_pulse: post.pulseId,
        p_type: post.type,
        p_body: post.body,
        p_url: post.url,
        p_author: post.author,
        p_net: post.net,
        p_per_pulse: perPulse,
        p_per_net: perNet,
      });
    },
    async posts(pulseId, author) {
      const rows = await rpc<
        {
          id: string;
          type: PostType;
          body: string;
          url: string | null;
          at: string;
          mine: boolean;
        }[]
      >("posts", { p_pulse: pulseId, p_author: author });
      return (rows ?? []).map((r) => ({
        id: r.id,
        type: r.type,
        body: r.body,
        url: r.url,
        at: new Date(r.at).toISOString(),
        ...(r.mine ? { mine: true } : {}),
      }));
    },
    async reportPost(postId, reporter, reason, threshold) {
      return rpc<"ok" | "duplicate" | "missing">("post_report", {
        p_post: postId,
        p_reporter: reporter,
        p_reason: reason,
        p_threshold: threshold,
      });
    },
    async reportedPosts() {
      const rows = await rpc<
        {
          id: string;
          pulse_id: string;
          type: PostType;
          body: string;
          url: string | null;
          at: string;
          status: ReportedPost["status"];
          reports: number;
        }[]
      >("posts_reported", {});
      return (rows ?? []).map((r) => ({
        id: r.id,
        pulseId: r.pulse_id,
        type: r.type,
        body: r.body,
        url: r.url,
        at: new Date(r.at).toISOString(),
        status: r.status,
        reports: Number(r.reports),
      }));
    },
    async setPostStatus(postId, status) {
      return (
        (await rpc<boolean>("post_set_status", {
          p_post: postId,
          p_status: status,
        })) === true
      );
    },
    async count(event, source) {
      await rpc<null>("check_count", { p_event: event, p_source: source });
    },
    async usage(days) {
      const rows = await rpc<CheckEventRow[]>("check_usage", { p_days: days });
      return (rows ?? []).map((r) => ({
        ...r,
        day: String(r.day).slice(0, 10),
        n: Number(r.n),
      }));
    },
  };
}

// ── The one store for this process ──────────────────────────────────────────

const g = globalThis as unknown as { __checkStore?: CheckStore };

/** Follows the Pulse store: memory beside memory, Postgres beside Postgres. */
export function checkStore(): CheckStore {
  if (g.__checkStore) return g.__checkStore;
  const pulses = pulseStore();
  if (pulses.kind === "memory") {
    g.__checkStore = memoryCheckStore(pulses);
    return g.__checkStore;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = pulseKey();
  if (!url || !anon || !key) throw new NotReady("Supabase is not configured");
  g.__checkStore = postgresCheckStore(pulseRpc(url, anon, key));
  return g.__checkStore;
}

/** Tests only. */
export function setCheckStoreForTests(store: CheckStore | undefined) {
  g.__checkStore = store;
}

export { POST_REPORTS_TO_HIDE };
