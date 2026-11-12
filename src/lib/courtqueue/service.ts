import "server-only";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  addDays,
  applyMod,
  applyShard,
  emptyMod,
  emptyShard,
  isModCommand,
  MESSAGE_ID,
  weekOfMessage,
  weekStart,
  type ChatCommand,
  type ChatMessage,
  type ChatMod,
  type ChatShard,
  type ModCommand,
  type ShardCommand,
} from "./chat";
import { localDate, serverNow, weekdayLabel } from "./clock";
import {
  applyClub,
  applySession,
  cleanName,
  nameKey,
  nameTaken,
  tickOnly,
  windDown,
  type Actor,
  type ClubCommand,
  type Outcome,
  type SessionCommand,
} from "./engine";
import {
  emptyClub,
  tidyClub,
  cleanEmail,
  emptySession,
  isActiveGame,
  type Club,
  type Player,
  type Session,
} from "./model";
import {
  changeNotices,
  chatNotice,
  dueReminders,
  openingNotice,
  type Notice,
} from "./notices";
import {
  prefsOf,
  PUSH,
  sendLater,
  setPrefs,
  subscribe,
  subscribedPlayers,
  unsubscribe,
  type PushDoc,
} from "./push";
import {
  SEASON,
  isDate,
  isScheduled,
  registrationState,
  upcomingNights,
} from "./schedule";
import { cleanJourney } from "./journey";
import { clubTable, playerStats } from "./stats";
import { courtStore, NotReady, type DocStore } from "./store";
import {
  clubhouseView,
  currentNight,
  DEFAULT_PREFS,
  listing,
  nightView,
  organizerView,
  person,
  seasonView,
  CLUBHOUSE_WINDOW,
  type ClubhouseMessage,
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
const CHAT_MOD = "chatmod";
const chatKey = (week: string) => `chat:${week}`;

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
    ? { club: tidyClub(d.value as Club), version: d.version }
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

/** Courts with a game on them in any night not yet over. */
async function courtsInUse(store: DocStore, club: Club): Promise<Set<number>> {
  const keys = club.sessions.map((m) => sessionKey(m.id));
  const docs = keys.length ? await read(store, keys, true) : new Map();
  const out = new Set<number>();
  for (const d of docs.values()) {
    const s = d.value as Session;
    if (s.status === "ended") continue;
    for (const g of s.games) if (isActiveGame(g)) out.add(g.court);
  }
  return out;
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
      tidyClub(clubDoc.value as Club),
      doc.value as Session,
      actor,
      cmd,
      serverNow(),
    );
    if (!out.ok) return out;
    if (await write(store, sessionKey(id), out.value, doc.version)) {
      sendLater(
        changeNotices(
          tidyClub(clubDoc.value as Club),
          doc.value as Session,
          out.value,
        ),
      );
      return out;
    }
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
  email?: unknown;
}): Promise<SignInOutcome> {
  const name = cleanName(input.name);
  if (name.length < 2) return { ok: false, error: "Tell us your name." };
  const email = cleanEmail(input.email);
  if (!email)
    return {
      ok: false,
      error: "Add your email address, like you@example.com.",
    };
  if (!validPin(input.pin))
    return { ok: false, error: "Pick a PIN of 4 to 8 digits." };
  const pin = input.pin;
  const store = courtStore();
  const pinHash = hashPin(pin);
  let cookie = "";
  const out = await changeClub(store, (club) => {
    if (nameTaken(club, name))
      return {
        ok: false,
        error: "That name is taken. Sign in instead, or add your last initial.",
      };
    if (Object.values(club.players).some((x) => x.email === email))
      return {
        ok: false,
        error:
          "That email is already registered. Sign in with your name and PIN.",
      };
    if (Object.keys(club.players).length >= 400)
      return { ok: false, error: "The club is full." };
    const now = serverNow();
    const p: Player = {
      id: randomBytes(6).toString("base64url"),
      name,
      email,
      createdAt: now,
      pinHash,
      tokenHashes: [],
      mentor: false,
      organizer: false,
      photo: false,
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
    const cmd = body.cmd as ClubCommand;
    const inUse =
      cmd?.type === "courts-count" ? await courtsInUse(store, club) : undefined;
    const out = await changeClub(store, (c) =>
      applyClub(c, actor, cmd, serverNow(), inUse),
    );
    return out.ok ? { ok: true, value: null } : out;
  }
  if (body.scope === "sessions") {
    if (!actor.organizer)
      return { ok: false, error: "Only the organizer can add sessions." };
    const dates = Array.isArray(body.dates)
      ? body.dates.filter((d): d is string => isDate(d) && isScheduled(d))
      : upcomingNights(serverNow(), club.cancelled);
    return createSessions(store, dates.slice(0, 8));
  }
  if (body.scope === "session" && typeof body.sessionId === "string") {
    const cmd = body.cmd as SessionCommand;
    const out = await changeSession(store, body.sessionId, actor, cmd);
    if (out.ok && cmd?.type === "challenge")
      await announceChallenge(store, club, me, out.value);
    return out.ok ? { ok: true, value: null } : out;
  }
  return { ok: false, error: "Unknown action." };
}

/**
 * A challenge is also news in the Clubhouse: one card, kept up to date from
 * the challenge itself. Best effort — a challenge never fails because the
 * chat was busy, paused, or the sender's chat is.
 */
async function announceChallenge(
  store: DocStore,
  club: Club,
  me: Player,
  session: Session,
) {
  try {
    const ch = [...session.challenges].reverse().find((c) => c.by === me.id);
    if (!ch) return;
    const names = ch.slots.map((id) => club.players[id]?.name ?? "Someone");
    const kind = ch.rematch ? "rematch" : "challenge";
    const text =
      ch.note ?? (ch.rematch ? "Same four again? 🔁" : "Care for a game? 🏸");
    const out = await chatChange(store, club, actorOf(me), {
      type: "announce",
      kind,
      text,
      ref: { session: session.id, challenge: ch.id },
    });
    if (out.ok && out.message) {
      const ids = ch.slots.filter((id) => id !== me.id);
      sendLater([
        chatNotice(
          club,
          out.message,
          `${names[0]} & ${names[1]} vs ${names[2]} & ${names[3]} — ${weekdayLabel(session.date)}`,
          ids,
        ),
      ]);
    }
  } catch (e) {
    console.error("courtqueue-announce", e);
  }
}

// --- The Clubhouse ---------------------------------------------------------

const SHARD_COMMANDS = new Set([
  "post",
  "announce",
  "react",
  "report",
  "remove",
]);
const MOD_COMMANDS = new Set(["mute", "unmute", "pin", "lock"]);

/** Apply one chat command by compare-and-swap; hands back the new message. */
async function chatChange(
  store: DocStore,
  club: Club,
  who: Actor,
  cmd: ChatCommand,
): Promise<Outcome<null> & { message?: ChatMessage }> {
  const now = serverNow();
  if (isModCommand(cmd)) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      await backoff(attempt);
      const d = (await read(store, [CHAT_MOD], true)).get(CHAT_MOD);
      const mod = (d?.value as ChatMod | undefined) ?? emptyMod();
      const out = applyMod(mod, club, who, cmd as ModCommand, now);
      if (!out.ok) return out;
      if (await write(store, CHAT_MOD, out.value, d?.version ?? 0))
        return { ok: true, value: null };
    }
    return { ok: false, error: "Busy — try again." };
  }
  const week =
    cmd.type === "post" || cmd.type === "announce"
      ? weekStart(localDate(now))
      : weekOfMessage((cmd as { id?: unknown }).id);
  if (!week || !isDate(week) || week < weekStart(SEASON.first))
    return { ok: false, error: "That message isn't here." };
  const key = chatKey(week);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await backoff(attempt);
    const docs = await read(store, [key, CHAT_MOD], true);
    const shard =
      (docs.get(key)?.value as ChatShard | undefined) ?? emptyShard(week);
    const mod =
      (docs.get(CHAT_MOD)?.value as ChatMod | undefined) ?? emptyMod();
    const out = applyShard(shard, mod, club, who, cmd as ShardCommand, now);
    if (!out.ok) return out;
    if (await write(store, key, out.value, docs.get(key)?.version ?? 0)) {
      if (!mod.first || week < mod.first) await noteFirstWeek(store, week);
      return {
        ok: true,
        value: null,
        message:
          cmd.type === "post" || cmd.type === "announce"
            ? out.value.messages[out.value.messages.length - 1]
            : undefined,
      };
    }
  }
  return { ok: false, error: "Busy — try again." };
}

/** Remember the earliest week with talk in it (best effort). */
async function noteFirstWeek(store: DocStore, week: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await backoff(attempt);
    const d = (await read(store, [CHAT_MOD], true)).get(CHAT_MOD);
    const mod = (d?.value as ChatMod | undefined) ?? emptyMod();
    if (mod.first && mod.first <= week) return;
    if (await write(store, CHAT_MOD, { ...mod, first: week }, d?.version ?? 0))
      return;
  }
}

/** What a member says or does in the Clubhouse. */
export async function chat(
  cookie: string | undefined,
  cmd: unknown,
): Promise<Outcome<null>> {
  const store = courtStore();
  const { club } = await loadClub(store);
  const me = playerFromCookie(club, cookie);
  if (!me) return { ok: false, error: "Sign in first." };
  const c = cmd as { type?: unknown } | null;
  if (
    !c ||
    typeof c.type !== "string" ||
    // "announce" is the server's own: a member can't forge a challenge card.
    !(
      c.type !== "announce" &&
      (SHARD_COMMANDS.has(c.type) || MOD_COMMANDS.has(c.type))
    )
  )
    return { ok: false, error: "Unknown action." };
  const out = await chatChange(store, club, actorOf(me), cmd as ChatCommand);
  if (out.ok && out.message && out.message.kind === "text")
    sendLater([chatNotice(club, out.message)]);
  return out.ok ? { ok: true, value: null } : out;
}

/** A page of earlier messages, oldest first, before the message `before`. */
export async function chatHistory(
  cookie: string | undefined,
  before: string | null,
): Promise<{
  messages: ClubhouseMessage[];
  olderBefore: string | null;
} | null> {
  const store = courtStore();
  const now = serverNow();
  const { club } = await loadClub(store);
  const me = playerFromCookie(club, cookie);
  if (!me || !before || !MESSAGE_ID.test(before)) return null;
  const [week, seq] = before.split(":") as [string, string];
  if (!isDate(week)) return null;
  const first = weekStart(SEASON.first);
  const weeks: string[] = [];
  for (let w = week; w >= first && weeks.length < 40; w = addDays(w, -7))
    weeks.push(w);
  const keys = [CHAT_MOD, ...weeks.map(chatKey)];
  const docs = await read(store, keys);
  const mod = (docs.get(CHAT_MOD)?.value as ChatMod | undefined) ?? emptyMod();
  const shards = weeks
    .reverse()
    .map((w) => docs.get(chatKey(w))?.value as ChatShard | undefined)
    .filter((sh): sh is ChatShard => !!sh);
  const older = shards.flatMap((sh) =>
    sh.messages.filter(
      (m) => sh.week < week || Number(m.id.split(":")[1]) < Number(seq),
    ),
  );
  const view = clubhouseView(
    club,
    mod,
    [{ week, seq: 0, messages: older.slice(-CLUBHOUSE_WINDOW) }],
    { id: me.id, organizer: me.organizer },
    now,
    week,
  );
  return {
    messages: view.messages,
    olderBefore: older.length > CLUBHOUSE_WINDOW ? view.messages[0]!.id : null,
  };
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
  const now = serverNow();
  let first = await loadClub(store);
  // The next Monday and Thursday are always on the calendar, so a night
  // never waits on someone remembering to add it. Only for a signed-in
  // player, so a passing crawler writes nothing.
  const upcoming = upcomingNights(now, first.club.cancelled);
  if (
    playerFromCookie(first.club, cookie) &&
    upcoming.some((d) => !first.club.sessions.some((s) => s.date === d))
  ) {
    await createSessions(store, upcoming);
    first = await loadClub(store, true);
  }
  const metas = visibleMetas(first.club, now);
  const thisWeek = weekStart(localDate(now));
  const lastWeek = addDays(thisWeek, -7);
  const chatKeys = [chatKey(lastWeek), chatKey(thisWeek), CHAT_MOD, PUSH];
  const keys = [CLUB, ...metas.map((m) => sessionKey(m.id))];
  let docs = await read(store, [...keys, ...chatKeys]);
  const clubDoc = docs.get(CLUB);
  const club = clubDoc ? tidyClub(clubDoc.value as Club) : emptyClub();
  let sessions = metas
    .map((m) => docs.get(sessionKey(m.id))?.value as Session | undefined)
    .filter((s): s is Session => !!s);
  // What time alone changes: a court to fill, a night to put away, a
  // reminder due. Done on the way past by whichever phone asks first.
  if (await maintain(store, club, sessions, docs, now)) {
    docs = await read(store, [...keys, ...chatKeys], true);
    sessions = metas
      .map((m) => docs.get(sessionKey(m.id))?.value as Session | undefined)
      .filter((s): s is Session => !!s);
  }
  const me = playerFromCookie(club, cookie);
  const version = [
    me?.id ?? "-",
    me?.organizer ? (focus ?? "") : "",
    ...[...keys, ...chatKeys].map((k) => docs.get(k)?.version ?? 0),
    // A mute running out is a change nobody wrote.
    me ? Number(!!chatMuteOf(docs, me.id, now)) : "",
  ].join(".");
  if (since && since === version) return { unchanged: true, now };
  const night = currentNight(club, sessions, now);
  return {
    now,
    version,
    season: seasonView(club, now),
    me: me
      ? {
          ...person(club, me.id),
          organizer: me.organizer,
          // Their own journey: sent to their phone and no one else's.
          journey: cleanJourney(me.journey),
          email: me.email ?? null,
        }
      : null,
    sessions: sessions
      .filter((s) => s.status !== "ended" || s.id === night?.id)
      .map((s) => listing(club, s, me?.id ?? null, now)),
    night: night ? nightView(club, night, me?.id ?? null, now) : null,
    organizer: me?.organizer
      ? organizerView(club, sessions.find((s) => s.id === focus) ?? night, now)
      : null,
    clubhouse: me
      ? clubhouseView(
          club,
          (docs.get(CHAT_MOD)?.value as ChatMod | undefined) ?? emptyMod(),
          [lastWeek, thisWeek]
            .map((w) => docs.get(chatKey(w))?.value as ChatShard | undefined)
            .filter((sh): sh is ChatShard => !!sh),
          { id: me.id, organizer: me.organizer },
          now,
          thisWeek,
        )
      : null,
    notify: me
      ? prefsOf(
          (docs.get(PUSH)?.value as PushDoc | undefined) ?? { players: {} },
          me.id,
        )
      : DEFAULT_PREFS,
  };
}

function chatMuteOf(
  docs: Map<string, { value: unknown; version: number }>,
  id: string,
  now: number,
) {
  const mod = (docs.get(CHAT_MOD)?.value as ChatMod | undefined) ?? emptyMod();
  const m = Object.hasOwn(mod.muted, id) ? mod.muted[id] : undefined;
  return m && (m.until === null || m.until > now) ? m : null;
}

/**
 * One pass of everything the clock does, each a single compare-and-swap
 * write (a lost race means another server just did it): wind down nights
 * past their end, fill free courts, send due reminders and, once on the
 * day, "sign-up is open". True when something was written.
 */
async function maintain(
  store: DocStore,
  club: Club,
  sessions: readonly Session[],
  docs: Map<string, { value: unknown; version: number }>,
  now: number,
): Promise<boolean> {
  let wrote = false;
  const notices: Notice[] = [];
  const today = localDate(now);
  let subscribers: string[] | null = null;
  for (const s0 of sessions) {
    const d = docs.get(sessionKey(s0.id));
    if (!d || s0.status === "ended") continue;
    const mine: Notice[] = [];
    let s = windDown(club, s0, now);
    if (!s) {
      const ticked = tickOnly(club, s0, now);
      s = ticked ?? structuredClone(s0);
      if (ticked) mine.push(...changeNotices(club, s0, ticked));
      const due = dueReminders(club, s, now);
      for (const r of due) {
        s.notified = { ...(s.notified ?? {}), [r.key]: now };
        mine.push(r.notice);
      }
      if (
        s.date === today &&
        !s.notified?.open &&
        registrationState(s.date, now, club.cancelled) === "open"
      ) {
        subscribers ??= await subscribedPlayers(store);
        const open = openingNotice(club, s, subscribers, now);
        if (open) {
          s.notified = { ...(s.notified ?? {}), open: now };
          mine.push(open);
        }
      }
      if (!ticked && !due.length && s.notified?.open === s0.notified?.open)
        continue;
    }
    // Lost the race: whoever won is sending these.
    if (!(await write(store, sessionKey(s0.id), s, d.version))) continue;
    wrote = true;
    notices.push(...mine);
  }
  if (wrote) sendLater(notices);
  return wrote;
}

/**
 * The scheduled nudge (Vercel cron, and safe to call any time): make sure
 * today's night exists if it is a club night, then do what the clock does.
 * No sign-in needed; it changes nothing a poll wouldn't.
 */
export async function tick(): Promise<{ night: string | null }> {
  const store = courtStore();
  const now = serverNow();
  const { club } = await loadClub(store, true);
  const today = localDate(now);
  const tonightDate = upcomingNights(now, club.cancelled, 1).find(
    (d) => d === today,
  );
  if (tonightDate && !club.sessions.some((s) => s.date === tonightDate))
    await createSessions(store, [tonightDate]);
  await live(undefined, null);
  return { night: tonightDate ?? null };
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
  // Your own numbers, plus the club's record in name order (not a ladder).
  return {
    me: playerStats(club, sessions, me.id),
    table: clubTable(club, sessions),
    games: sessions
      .flatMap((s) =>
        s.games
          .filter((g) => g.status === "finished" && g.score)
          .map((g) => ({
            night: s.date,
            court: g.court,
            at: g.finishedAt ?? g.calledAt,
            score: g.score!,
            winner: g.winner ?? null,
            team: g.slots.map((id) =>
              id ? (club.players[id]?.name ?? "?") : "",
            ),
          })),
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, 60),
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
      applyClub(c, actorOf(me), { type: "profile", photo: false }, serverNow()),
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
    applyClub(c, actorOf(me), { type: "profile", photo: true }, serverNow()),
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

// --- Push notifications ----------------------------------------------------

export async function pushChange(
  cookie: string | undefined,
  body: {
    action?: unknown;
    subscription?: unknown;
    endpoint?: unknown;
    prefs?: unknown;
  },
) {
  const me = await whoIs(cookie);
  if (!me) return { ok: false as const, error: "Sign in first." };
  if (body.action === "subscribe") return subscribe(me.id, body.subscription);
  if (body.action === "unsubscribe") return unsubscribe(me.id, body.endpoint);
  if (body.action === "prefs")
    return setPrefs(me.id, (body as { prefs?: unknown }).prefs);
  if (body.action === "test") {
    sendLater([
      {
        to: [me.id],
        title: "CourtQueue notifications are on 🏸",
        body: "This is what you'll see when your court is ready.",
        tag: "test",
      },
    ]);
    return { ok: true as const, value: null };
  }
  return { ok: false as const, error: "Unknown action." };
}

export { cleanEmail };
