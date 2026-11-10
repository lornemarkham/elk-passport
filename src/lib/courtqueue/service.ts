import "server-only";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { localDate, nextSessionDates, weekdayLabel } from "./clock";
import {
  applyClub,
  applySession,
  cleanName,
  nameKey,
  nameTaken,
  tickOnly,
  type Actor,
  type ClubCommand,
  type Outcome,
  type SessionCommand,
} from "./engine";
import {
  emptyClub,
  emptySession,
  isSkill,
  type Club,
  type Player,
  type Session,
} from "./model";
import { playerStats, promotionHint } from "./stats";
import { courtStore, NotReady, type DocStore } from "./store";
import {
  currentNight,
  listing,
  nightView,
  organizerView,
  person,
  type LiveView,
} from "./view";

/**
 * **The server side of CourtQueue**: who is asking, and applying what they
 * asked to the stored documents with compare-and-swap retries.
 */

export { NotReady };

const CLUB = "club";
const sessionKey = (id: string) => `session:${id}`;
const photoKey = (id: string) => `photo:${id}`;

// --- Reading, with a moment's cache so 25 phones polling are few reads ----

const CACHE_MS = 400;
const g = globalThis as unknown as {
  __cqCache?: Map<
    string,
    { at: number; docs: Map<string, { value: unknown; version: number }> }
  >;
};
const cache = () => (g.__cqCache ??= new Map());

async function read(store: DocStore, keys: string[], fresh = false) {
  const k = keys.join("|");
  const hit = cache().get(k);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.docs;
  const docs = await store.get(keys);
  cache().set(k, { at: Date.now(), docs });
  if (cache().size > 50) cache().clear();
  return docs;
}

async function write(
  store: DocStore,
  key: string,
  value: unknown,
  expected: number,
) {
  const ok = await store.put(key, value, expected);
  cache().clear();
  return ok;
}

/**
 * After losing a compare-and-swap, wait a little — longer each time, and
 * never the same as the phone that won — so a room tapping at once spreads
 * out instead of colliding again.
 */
const backoff = (attempt: number) =>
  attempt === 0
    ? null
    : new Promise((r) =>
        setTimeout(r, Math.random() * Math.min(400, 20 * 2 ** attempt)),
      );

const ATTEMPTS = 30;

async function loadClub(store: DocStore, fresh = false) {
  const d = (await read(store, [CLUB], fresh)).get(CLUB);
  return d
    ? { club: d.value as Club, version: d.version }
    : { club: emptyClub(), version: 0 };
}

/** Apply a change to the club document, retrying when someone wrote first. */
async function changeClub<T>(
  store: DocStore,
  fn: (club: Club) => Outcome<Club> & { extra?: T },
): Promise<Outcome<Club>> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await backoff(attempt);
    const { club, version } = await loadClub(store, true);
    const out = fn(club);
    if (!out.ok) return out;
    if (await write(store, CLUB, out.value, version)) return out;
  }
  return { ok: false, error: "Busy — try again." };
}

async function changeSession(
  store: DocStore,
  id: string,
  actor: Actor,
  cmd: SessionCommand,
): Promise<Outcome<Session>> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await backoff(attempt);
    const docs = await read(store, [CLUB, sessionKey(id)], true);
    const clubDoc = docs.get(CLUB);
    const doc = docs.get(sessionKey(id));
    if (!clubDoc || !doc)
      return { ok: false, error: "That session isn't here." };
    const out = applySession(
      clubDoc.value as Club,
      doc.value as Session,
      actor,
      cmd,
      Date.now(),
    );
    if (!out.ok) return out;
    if (await write(store, sessionKey(id), out.value, doc.version)) return out;
  }
  return { ok: false, error: "Busy — try again." };
}

// --- Who is asking -----------------------------------------------------------

export const PLAYER_COOKIE = "cq_player";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

function pinMatches(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const got = scryptSync(pin, salt, 32);
  const want = Buffer.from(hash, "hex");
  return want.length === got.length && timingSafeEqual(got, want);
}

export const validPin = (pin: unknown): pin is string =>
  typeof pin === "string" && /^\d{4,8}$/.test(pin);

export function playerFromCookie(
  club: Club,
  cookie: string | undefined,
): Player | null {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot < 1) return null;
  const id = cookie.slice(0, dot);
  if (!Object.hasOwn(club.players, id)) return null;
  const p = club.players[id]!;
  return p.tokenHashes.includes(sha(cookie.slice(dot + 1))) ? p : null;
}

function newToken(p: Player): string {
  const token = randomBytes(24).toString("base64url");
  p.tokenHashes = [...p.tokenHashes, sha(token)].slice(-8);
  return `${p.id}.${token}`;
}

export async function whoIs(cookie: string | undefined) {
  const store = courtStore();
  const { club } = await loadClub(store);
  return playerFromCookie(club, cookie);
}

export type SignInOutcome = Outcome<{ cookie: string }>;

export async function register(input: {
  name: unknown;
  pin: unknown;
  skill: unknown;
  statsPublic?: unknown;
}): Promise<SignInOutcome> {
  const name = cleanName(input.name);
  if (name.length < 2) return { ok: false, error: "Tell us your name." };
  if (!validPin(input.pin))
    return { ok: false, error: "Pick a PIN of 4 to 8 digits." };
  if (!isSkill(input.skill)) return { ok: false, error: "Pick your level." };
  const pin = input.pin;
  const skill = input.skill;
  const store = courtStore();
  const pinHash = hashPin(pin);
  let cookie = "";
  const out = await changeClub(store, (club) => {
    if (nameTaken(club, name))
      return {
        ok: false,
        error: "That name is taken. Sign in instead, or add your last initial.",
      };
    if (Object.keys(club.players).length >= 400)
      return { ok: false, error: "The club is full." };
    const now = Date.now();
    const p: Player = {
      id: randomBytes(6).toString("base64url"),
      name,
      skill,
      createdAt: now,
      pinHash,
      tokenHashes: [],
      statsPublic: input.statsPublic !== false,
      mentor: false,
      organizer: false,
      photo: false,
      skillHistory: [
        { at: now, from: null, to: skill, by: "self", reason: "Self-assessed" },
      ],
    };
    cookie = newToken(p);
    const next = structuredClone(club);
    next.players[p.id] = p;
    return { ok: true, value: next };
  });
  return out.ok ? { ok: true, value: { cookie } } : out;
}

export async function signIn(
  nameIn: unknown,
  pin: unknown,
): Promise<SignInOutcome> {
  const key = nameKey(String(nameIn ?? ""));
  if (!validPin(pin)) return { ok: false, error: "Name or PIN didn't match." };
  const store = courtStore();
  let cookie = "";
  const out = await changeClub(store, (club) => {
    const p = Object.values(club.players).find((x) => nameKey(x.name) === key);
    if (!p || !pinMatches(pin, p.pinHash))
      return { ok: false, error: "Name or PIN didn't match." };
    const next = structuredClone(club);
    cookie = newToken(next.players[p.id]!);
    return { ok: true, value: next };
  });
  return out.ok ? { ok: true, value: { cookie } } : out;
}

export async function signOut(cookie: string | undefined) {
  const store = courtStore();
  await changeClub(store, (club) => {
    const p = playerFromCookie(club, cookie);
    if (!p) return { ok: true, value: club };
    const next = structuredClone(club);
    const token = cookie!.slice(cookie!.indexOf(".") + 1);
    next.players[p.id]!.tokenHashes = p.tokenHashes.filter(
      (h) => h !== sha(token),
    );
    return { ok: true, value: next };
  });
}

/** A PIN the organizer resets for someone who forgot theirs. */
export async function resetPin(actor: Actor, playerId: string, pin: unknown) {
  if (!actor.organizer) return { ok: false as const, error: "Organizer only." };
  if (!validPin(pin)) return { ok: false as const, error: "4 to 8 digits." };
  const pinHash = hashPin(pin);
  return changeClub(courtStore(), (club) => {
    if (!club.players[playerId]) return { ok: false, error: "Unknown player." };
    const next = structuredClone(club);
    next.players[playerId]!.pinHash = pinHash;
    next.players[playerId]!.tokenHashes = [];
    return { ok: true, value: next };
  });
}

function organizerCode(): string | null {
  const code = process.env.COURTQUEUE_ORGANIZER_CODE;
  if (code && code.length >= 6) return code;
  return process.env.NODE_ENV === "production" &&
    process.env.COURTQUEUE_STORE !== "memory"
    ? null
    : "organizer";
}

/**
 * Becoming an organizer: the organizer code (COURTQUEUE_ORGANIZER_CODE), or
 * being signed in to Passport as one of its administrators (ADMIN_EMAILS,
 * the same gate as the curator workbench). Organizers can then make others
 * organizers from their phone.
 */
export async function claimOrganizer(
  cookie: string | undefined,
  code: unknown,
  passportAdmin: () => Promise<boolean>,
) {
  const want = organizerCode();
  let allowed = false;
  if (code !== undefined && code !== null && code !== "") {
    if (want) {
      const a = Buffer.from(sha(String(code)));
      const b = Buffer.from(sha(want));
      allowed = timingSafeEqual(a, b);
    }
    if (!allowed) return { ok: false as const, error: "That's not the code." };
  } else {
    allowed = await passportAdmin();
    if (!allowed)
      return {
        ok: false as const,
        error:
          "Sign in to Passport as an administrator first, or use the code.",
      };
  }
  return changeClub(courtStore(), (club) => {
    const p = playerFromCookie(club, cookie);
    if (!p) return { ok: false, error: "Sign in first." };
    const next = structuredClone(club);
    next.players[p.id]!.organizer = true;
    return { ok: true, value: next };
  });
}

const actorOf = (p: Player): Actor => ({ id: p.id, organizer: p.organizer });

// --- Doing things ----------------------------------------------------------

export async function act(
  cookie: string | undefined,
  body: {
    scope?: unknown;
    sessionId?: unknown;
    cmd?: unknown;
    dates?: unknown;
  },
): Promise<Outcome<null>> {
  const store = courtStore();
  const { club } = await loadClub(store, true);
  const me = playerFromCookie(club, cookie);
  if (!me) return { ok: false, error: "Sign in first." };
  const actor = actorOf(me);
  if (body.scope === "club") {
    const out = await changeClub(store, (c) =>
      applyClub(c, actor, body.cmd as ClubCommand, Date.now()),
    );
    return out.ok ? { ok: true, value: null } : out;
  }
  if (body.scope === "sessions") {
    if (!actor.organizer)
      return { ok: false, error: "Only the organizer can add sessions." };
    const dates = Array.isArray(body.dates)
      ? body.dates.filter(
          (d): d is string =>
            typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
        )
      : nextSessionDates(Date.now());
    return createSessions(store, dates.slice(0, 8));
  }
  if (body.scope === "session" && typeof body.sessionId === "string") {
    const out = await changeSession(
      store,
      body.sessionId,
      actor,
      body.cmd as SessionCommand,
    );
    return out.ok ? { ok: true, value: null } : out;
  }
  return { ok: false, error: "Unknown action." };
}

async function createSessions(
  store: DocStore,
  dates: string[],
): Promise<Outcome<null>> {
  for (const date of dates) {
    const meta = { id: date, date, label: weekdayLabel(date) };
    await write(store, sessionKey(date), emptySession(meta), 0);
    const out = await changeClub(store, (club) => {
      if (club.sessions.some((s) => s.id === date))
        return { ok: true, value: club };
      const next = structuredClone(club);
      next.sessions.push(meta);
      next.sessions.sort((a, b) => a.date.localeCompare(b.date));
      return { ok: true, value: next };
    });
    if (!out.ok) return out;
  }
  return { ok: true, value: null };
}

// --- What a phone sees -----------------------------------------------------

/** Sessions worth showing: yesterday onwards (a night can run past midnight). */
function visibleMetas(club: Club, now: number) {
  const yesterday = localDate(now - 86_400_000);
  return club.sessions.filter((s) => s.date >= yesterday).slice(0, 6);
}

export async function live(
  cookie: string | undefined,
  since: string | null,
  focus: string | null = null,
): Promise<LiveView | { unchanged: true; now: number }> {
  const store = courtStore();
  const now = Date.now();
  let first = await loadClub(store);
  // The next Monday and Thursday are always on the calendar, so a night
  // never waits on someone remembering to add it. Only for a signed-in
  // player, so a passing crawler writes nothing.
  const upcoming = nextSessionDates(now);
  if (
    playerFromCookie(first.club, cookie) &&
    upcoming.some((d) => !first.club.sessions.some((s) => s.date === d))
  ) {
    await createSessions(store, upcoming);
    first = await loadClub(store, true);
  }
  const metas = visibleMetas(first.club, now);
  const keys = [CLUB, ...metas.map((m) => sessionKey(m.id))];
  let docs = await read(store, keys);
  const clubDoc = docs.get(CLUB);
  const club = (clubDoc?.value as Club | undefined) ?? emptyClub();
  let sessions = metas
    .map((m) => docs.get(sessionKey(m.id))?.value as Session | undefined)
    .filter((s): s is Session => !!s);
  // Time alone can free a challenge to go on; fill courts on the way past.
  const night0 = currentNight(club, sessions, now);
  if (night0?.status === "live") {
    const ticked = tickOnly(club, night0, now);
    const d = docs.get(sessionKey(night0.id));
    if (
      ticked &&
      d &&
      (await write(store, sessionKey(night0.id), ticked, d.version))
    ) {
      docs = await read(store, keys, true);
      sessions = metas
        .map((m) => docs.get(sessionKey(m.id))?.value as Session | undefined)
        .filter((s): s is Session => !!s);
    }
  }
  const me = playerFromCookie(club, cookie);
  const version = [
    me?.id ?? "-",
    me?.organizer ? (focus ?? "") : "",
    ...keys.map((k) => docs.get(k)?.version ?? 0),
  ].join(".");
  if (since && since === version) return { unchanged: true, now };
  const night = currentNight(club, sessions, now);
  return {
    now,
    version,
    me: me
      ? {
          ...person(club, me.id),
          organizer: me.organizer,
          statsPublic: me.statsPublic,
        }
      : null,
    sessions: sessions
      .filter((s) => s.status !== "ended" || s.id === night?.id)
      .map((s) => listing(club, s, me?.id ?? null)),
    night: night ? nightView(club, night, me?.id ?? null, now) : null,
    organizer: me?.organizer
      ? organizerView(club, sessions.find((s) => s.id === focus) ?? night, now)
      : null,
  };
}

export async function stats(cookie: string | undefined) {
  const store = courtStore();
  const { club } = await loadClub(store);
  const me = playerFromCookie(club, cookie);
  if (!me) return null;
  const keys = club.sessions.slice(-150).map((s) => sessionKey(s.id));
  const docs = keys.length ? await read(store, keys) : new Map();
  const sessions = keys
    .map((k) => docs.get(k)?.value as Session | undefined)
    .filter((s): s is Session => !!s);
  const rows = Object.values(club.players).map((p) => {
    const st = playerStats(club, sessions, p.id);
    return {
      person: person(club, p.id),
      statsPublic: p.statsPublic,
      stats: st,
    };
  });
  const mine = rows.find((r) => r.person.id === me.id)!;
  const visible = rows.filter(
    (r) => me.organizer || r.statsPublic || r.person.id === me.id,
  );
  return {
    me: mine.stats,
    board: visible
      .filter((r) => r.stats.attended > 0)
      .sort((a, b) => b.stats.points - a.stats.points)
      .map((r) => ({
        person: r.person,
        private: !r.statsPublic,
        points: r.stats.points,
        attended: r.stats.attended,
        games: r.stats.games,
        minutes: r.stats.minutes,
        wins: r.stats.wins,
        losses: r.stats.losses,
        winPct: r.stats.winPct,
        partners: r.stats.partners,
        mentoredGames: r.stats.mentoredGames,
        hint: me.organizer ? promotionHint(r.stats) : null,
      })),
  };
}

// --- Photos ----------------------------------------------------------------

const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function savePhoto(cookie: string | undefined, dataUrl: unknown) {
  const store = courtStore();
  const me = await whoIs(cookie);
  if (!me) return { ok: false as const, error: "Sign in first." };
  if (dataUrl === null) {
    await changeClub(store, (c) =>
      applyClub(c, actorOf(me), { type: "profile", photo: false }, Date.now()),
    );
    return { ok: true as const, value: null };
  }
  if (
    typeof dataUrl !== "string" ||
    dataUrl.length > 120_000 ||
    !PHOTO.test(dataUrl)
  )
    return {
      ok: false as const,
      error: "That picture is too big or not an image.",
    };
  const existing = (await store.get([photoKey(me.id)])).get(photoKey(me.id));
  await write(store, photoKey(me.id), { dataUrl }, existing?.version ?? 0);
  await changeClub(store, (c) =>
    applyClub(c, actorOf(me), { type: "profile", photo: true }, Date.now()),
  );
  return { ok: true as const, value: null };
}

export async function readPhoto(id: string) {
  const store = courtStore();
  const d = (await read(store, [photoKey(id)])).get(photoKey(id));
  const url = (d?.value as { dataUrl?: string } | undefined)?.dataUrl;
  const m = url ? /^data:(image\/[a-z]+);base64,(.*)$/.exec(url) : null;
  if (!m) return null;
  return {
    type: m[1]!,
    bytes: Buffer.from(m[2]!, "base64"),
    version: d!.version,
  };
}

export async function organizerResetPin(
  cookie: string | undefined,
  playerId: unknown,
  pin: unknown,
) {
  const me = await whoIs(cookie);
  if (!me) return { ok: false as const, error: "Sign in first." };
  return resetPin(actorOf(me), String(playerId ?? ""), pin);
}
