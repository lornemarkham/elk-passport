"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { REACTIONS, MAX_TEXT } from "@/lib/courtqueue/chat";
import { localDate, weekdayLabel } from "@/lib/courtqueue/clock";
import { SEASON } from "@/lib/courtqueue/schedule";
import type {
  ChallengeView,
  ClubhouseMessage,
  LiveView,
  PersonView,
} from "@/lib/courtqueue/view";
import { Avatar, Btn, Card, Sheet, clock, cx } from "./bits";
import type { Act } from "./Tonight";

export type ChatSend = (cmd: object) => Promise<boolean>;

const QUICK = [
  "Good game! 👏",
  "Same four again? 🔁",
  "Who's in tonight? 🏸",
  "Nice shot! 🔥",
  "Running a bit late ⏰",
];

const EMOJI = [
  "😀",
  "😂",
  "😎",
  "😅",
  "🥳",
  "😮",
  "🤝",
  "👍",
  "👏",
  "🙌",
  "💪",
  "🔥",
  "🏸",
  "🏆",
  "🎯",
  "⚡",
  "🚀",
  "❤️",
  "💚",
  "🍕",
  "☕",
  "💧",
  "🎉",
  "🙈",
];

const origin = () =>
  typeof window === "undefined" ? "" : window.location.origin;
const noSubscribe = () => () => {};
/** The site's address, once we're on the phone (empty while rendering on the server). */
const useOrigin = () => useSyncExternalStore(noSubscribe, origin, () => "");

const whatsapp = (text: string) =>
  `https://wa.me/?text=${encodeURIComponent(text)}`;

const STEP_WORDS = {
  answer: "hasn't answered yet",
  "sign-up": "needs to sign up (8:00 am on the day)",
  "check-in": "needs to check in",
  queue: "needs to join the queue",
} as const;

const first = (name: string) => name.split(" ")[0]!;

/** Message ids are `<week>:<n>`; the number is what orders them. */
export function isAfter(a: string, b: string): boolean {
  const [wa, na] = a.split(":");
  const [wb, nb] = b.split(":");
  return wa !== wb ? wa! > wb! : Number(na) > Number(nb);
}

/** Messages from other people this phone hasn't seen yet. */
export function unreadCount(view: LiveView | null, seen: string | null) {
  const me = view?.me?.id;
  if (!view?.clubhouse || !me || seen === null) return 0;
  return view.clubhouse.messages.filter(
    (m) => m.by !== me && m.kind === "text" && isAfter(m.id, seen),
  ).length;
}

// ---------------------------------------------------------------------------

export function Clubhouse({
  view,
  send,
  act,
  seen,
}: {
  view: LiveView;
  send: ChatSend;
  act: Act;
  /** The id of the newest message this phone has read. */
  seen: string | null;
}) {
  const house = view.clubhouse!;
  const me = view.me!;
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [older, setOlder] = useState<ClubhouseMessage[]>([]);
  const [olderBefore, setOlderBefore] = useState<string | null | undefined>(
    undefined,
  );
  const end = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => {
    const have = new Set(house.messages.map((m) => m.id));
    return [...older.filter((m) => !have.has(m.id)), ...house.messages];
  }, [older, house.messages]);
  const newest = messages.at(-1)?.id ?? null;

  // Follow the conversation when it grows, unless the reader has scrolled up.
  const stick = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      stick.current =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (stick.current) end.current?.scrollIntoView({ block: "end" });
  }, [newest]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, []);

  const loadOlder = async () => {
    const before = olderBefore === undefined ? house.olderBefore : olderBefore;
    if (!before) return;
    const res = await fetch(
      `/api/badminton/chat?before=${encodeURIComponent(before)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const page = (await res.json()) as {
      messages: ClubhouseMessage[];
      olderBefore: string | null;
    };
    stick.current = false;
    setOlder((o) => [...page.messages, ...o]);
    setOlderBefore(page.olderBefore);
  };
  const canLoadMore =
    (olderBefore === undefined ? house.olderBefore : olderBefore) !== null;

  const challenges = view.sessions.flatMap((s) =>
    s.challenges
      .filter(
        (c) =>
          c.status === "pending" ||
          c.status === "ready" ||
          c.status === "on-court",
      )
      .map((c) => ({ c, label: s.label })),
  );
  const byId = new Map(
    view.sessions.flatMap((s) =>
      s.challenges.map((c) => [c.id, { c, label: s.label }] as const),
    ),
  );
  const mine = challenges.filter(({ c }) =>
    c.slots.some((p) => p.id === me.id),
  );

  let lastDay = "";
  let marked = false;
  return (
    <div className="space-y-3 pb-28">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Clubhouse</h1>
          <p className="text-sm text-white/60">
            {SEASON.club} — everyone&apos;s in one room. Be kind, play on.
          </p>
        </div>
        <Btn
          className="shrink-0 !px-3 !py-2 text-sm"
          onClick={() => setSheet(true)}
        >
          🏸 Invite
        </Btn>
      </header>

      {house.pinned && (
        <Card tone="warn">
          <p className="text-xs font-bold tracking-wide text-amber-200 uppercase">
            📌 From the organizer
          </p>
          <p className="mt-1 font-semibold">{house.pinned.text}</p>
        </Card>
      )}

      {view.me!.organizer && house.moderation && (
        <Moderation view={view} send={send} />
      )}

      {mine.length > 0 && (
        <section aria-label="Game invites" className="space-y-2">
          <h2 className="text-sm font-bold text-white/70">Your game invites</h2>
          {mine.map(({ c, label }) => (
            <ChallengeCard
              key={c.id}
              c={c}
              label={label}
              meId={me.id}
              act={act}
            />
          ))}
        </section>
      )}

      <InviteRow />

      <section aria-label="Messages" className="space-y-2">
        {canLoadMore && (
          <button
            onClick={loadOlder}
            className="mx-auto block rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80"
          >
            Earlier messages
          </button>
        )}
        {!messages.length && (
          <Card>
            <p className="text-center text-white/70">
              Nothing here yet. Say hello, or invite someone to a game 🏸
            </p>
          </Card>
        )}
        {messages.map((m) => {
          const day = localDate(m.at);
          const head = day !== lastDay;
          lastDay = day;
          const newMark =
            !marked && seen !== null && isAfter(m.id, seen) && m.by !== me.id;
          if (newMark) marked = true;
          return (
            <div key={m.id}>
              {head && (
                <p className="my-2 text-center text-xs font-semibold text-white/40">
                  {weekdayLabel(day)}
                </p>
              )}
              {newMark && (
                <p className="my-2 flex items-center gap-2 text-xs font-bold text-lime-300">
                  <span className="h-px flex-1 bg-lime-300/40" /> New
                  <span className="h-px flex-1 bg-lime-300/40" />
                </p>
              )}
              <Message
                m={m}
                meId={me.id}
                organizer={me.organizer}
                open={open === m.id}
                toggle={() => setOpen(open === m.id ? null : m.id)}
                send={send}
                card={
                  m.ref ? (
                    byId.get(m.ref.challenge) ? (
                      <ChallengeCard
                        c={byId.get(m.ref.challenge)!.c}
                        label={byId.get(m.ref.challenge)!.label}
                        meId={me.id}
                        act={act}
                        compact
                      />
                    ) : null
                  ) : null
                }
              />
            </div>
          );
        })}
        <div ref={end} className="scroll-mb-44" />
      </section>

      <Composer view={view} send={send} />

      <ChallengeSheet
        open={sheet}
        onClose={() => setSheet(false)}
        view={view}
        act={act}
      />
    </div>
  );
}

// --- One message -------------------------------------------------------------

function Message({
  m,
  meId,
  organizer,
  open,
  toggle,
  send,
  card,
}: {
  m: ClubhouseMessage;
  meId: string;
  organizer: boolean;
  open: boolean;
  toggle: () => void;
  send: ChatSend;
  card: React.ReactNode;
}) {
  const mine = m.by === meId;
  const announce = m.kind !== "text";
  const hidden = m.hidden !== null;
  const showText = m.text !== "";
  return (
    <div className={cx("flex gap-2", mine && !announce && "flex-row-reverse")}>
      {!mine && !announce && <Avatar p={m.author} size={30} />}
      <div
        className={cx("max-w-[85%] min-w-0", announce && "w-full max-w-full")}
      >
        {!announce && (
          <p
            className={cx(
              "mb-0.5 flex items-center gap-2 text-[11px] text-white/50",
              mine && "justify-end",
            )}
          >
            {!mine && (
              <span className="font-semibold text-lime-300">
                {m.author.name}
              </span>
            )}
            {clock(m.at)}
            {organizer && m.reports > 0 && (
              <span className="rounded-full bg-rose-500/30 px-1.5 text-rose-100">
                {m.reports} reported
              </span>
            )}
          </p>
        )}
        {announce ? (
          <div>
            <p className="mb-1 text-center text-xs text-white/50">
              {m.author.name}{" "}
              {m.kind === "rematch"
                ? "asked for another game together"
                : "sent a game invite"}
            </p>
            {card ?? (
              <p className="rounded-xl bg-white/[0.06] p-3 text-center text-sm text-white/70">
                {showText
                  ? m.text
                  : "A game invite from a night that has passed."}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={toggle}
            aria-expanded={open}
            aria-label={`${m.author.name}: ${hidden ? "hidden message" : m.text}`}
            className={cx(
              "block max-w-full rounded-2xl px-3 py-2 text-left break-words",
              mine
                ? "rounded-br-sm bg-lime-400 text-slate-950"
                : "rounded-bl-sm bg-white/10",
              hidden && "opacity-60",
            )}
          >
            {hidden && (
              <span className="block text-xs italic">
                {m.hidden === "removed"
                  ? "Removed by the organizer"
                  : "Hidden while the organizer takes a look"}
              </span>
            )}
            {showText && <span className="whitespace-pre-wrap">{m.text}</span>}
          </button>
        )}
        {m.reactions.length > 0 && (
          <div
            className={cx("mt-1 flex flex-wrap gap-1", mine && "justify-end")}
          >
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() =>
                  send({ type: "react", id: m.id, emoji: r.emoji })
                }
                aria-label={`${r.emoji} ${r.n}${r.mine ? ", yours" : ""}`}
                className={cx(
                  "rounded-full px-2 py-0.5 text-xs",
                  r.mine
                    ? "bg-lime-400/25 ring-1 ring-lime-300"
                    : "bg-white/10",
                )}
              >
                {r.emoji} {r.n}
              </button>
            ))}
          </div>
        )}
        {open && !hidden && (
          <div
            className={cx(
              "mt-1 flex flex-wrap items-center gap-1 rounded-xl bg-slate-900 p-1.5 ring-1 ring-white/10",
              mine && "justify-end",
            )}
          >
            {REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  void send({ type: "react", id: m.id, emoji: e });
                  toggle();
                }}
                aria-label={`React ${e}`}
                className="rounded-lg px-2 py-1 text-lg active:bg-white/10"
              >
                {e}
              </button>
            ))}
            {!mine && !m.reportedByMe && (
              <button
                onClick={() => {
                  void send({ type: "report", id: m.id });
                  toggle();
                }}
                className="rounded-lg px-2 py-1 text-xs text-white/60 underline"
              >
                Report
              </button>
            )}
            {m.reportedByMe && (
              <span className="px-2 text-xs text-white/50">Reported ✓</span>
            )}
          </div>
        )}
        {organizer && open && (
          <div className="mt-1 flex flex-wrap gap-1">
            {hidden ? (
              <Btn
                kind="ghost"
                className="!px-3 !py-1 text-sm"
                onClick={() =>
                  send({ type: "remove", id: m.id, restore: true })
                }
              >
                Put it back
              </Btn>
            ) : (
              <Btn
                kind="danger"
                className="!px-3 !py-1 text-sm"
                onClick={() => send({ type: "remove", id: m.id })}
              >
                Remove
              </Btn>
            )}
            {!mine && (
              <Btn
                kind="ghost"
                className="!px-3 !py-1 text-sm"
                onClick={() =>
                  send({ type: "mute", playerId: m.by, hours: 24 })
                }
              >
                Pause {first(m.author.name)}&apos;s chat (24 h)
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Writing -----------------------------------------------------------------

function Composer({ view, send }: { view: LiveView; send: ChatSend }) {
  const house = view.clubhouse!;
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resting = house.muted !== null || (house.locked && !view.me!.organizer);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await send({ type: "post", text: t });
    setBusy(false);
    if (ok) {
      setText("");
      setEmoji(false);
    }
    input.current?.focus();
  };
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto max-w-lg px-3 py-2">
        {resting ? (
          <p
            role="status"
            className="rounded-xl bg-white/10 p-3 text-center text-sm text-white/80"
          >
            {house.muted
              ? "The organizer has paused your chat for now. You can still read along."
              : "The Clubhouse is resting — the organizer paused chat."}
          </p>
        ) : (
          <>
            {emoji && (
              <div
                className="mb-2 grid grid-cols-8 gap-1 rounded-xl bg-slate-900 p-2 ring-1 ring-white/10"
                aria-label="Emoji"
              >
                {EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setText((t) => (t + e).slice(0, MAX_TEXT));
                      input.current?.focus();
                    }}
                    className="rounded-lg py-1 text-xl active:bg-white/10"
                    aria-label={`Add ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            {!text && (
              <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setText(q);
                      input.current?.focus();
                    }}
                    className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submit} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEmoji((v) => !v)}
                aria-label="Emoji"
                aria-pressed={emoji}
                className={cx(
                  "shrink-0 rounded-full p-2 text-xl",
                  emoji ? "bg-lime-400/25" : "bg-white/10",
                )}
              >
                😀
              </button>
              <input
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_TEXT}
                enterKeyHint="send"
                autoComplete="off"
                aria-label="Message to the club"
                placeholder="Say something kind… (@Name to ping)"
                className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2.5 text-base"
              />
              <button
                type="submit"
                disabled={!text.trim() || busy}
                aria-label="Send"
                className="shrink-0 rounded-full bg-lime-400 px-4 py-2.5 font-black text-slate-950 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// --- Challenges ----------------------------------------------------------------

function Teams({ slots }: { slots: PersonView[] }) {
  return (
    <p className="font-semibold">
      {first(slots[0]!.name)} & {first(slots[1]!.name)}{" "}
      <span className="text-white/50">vs</span> {first(slots[2]!.name)} &{" "}
      {first(slots[3]!.name)}
    </p>
  );
}

export function challengeShare(c: ChallengeView, label: string, site: string) {
  const [a, b, d, e] = c.slots.map((p) => first(p.name));
  return (
    `🏸 Game on? ${a} & ${b} with ${d} & ${e} — ${label} at ${SEASON.club}` +
    `${c.note ? `: “${c.note}”` : "."} ` +
    `Say yes in CourtQueue: ${site}/badminton`
  );
}

export function ChallengeCard({
  c,
  label,
  meId,
  act,
  compact,
}: {
  c: ChallengeView;
  label: string;
  meId: string;
  act: Act;
  compact?: boolean;
}) {
  const site = useOrigin();
  const invited = c.slots.some((p) => p.id === meId);
  const accepted = c.accepted.includes(meId);
  const waiting = c.status === "pending" || c.status === "ready";
  const nameOf = (id: string) =>
    c.slots.find((p) => p.id === id)?.name ?? "Someone";
  const status =
    c.status === "on-court"
      ? "On court now 🏸"
      : c.status === "ready"
        ? "All four are in line — it goes to a court when the queue allows"
        : c.status === "pending"
          ? `${c.accepted.length} of 4 said yes`
          : c.status === "declined"
            ? "Called off"
            : c.status === "cancelled"
              ? "Called off"
              : "Played";
  return (
    <Card
      className={cx(
        compact && "ring-lime-300/30",
        c.status === "on-court" && "ring-lime-300",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Teams slots={c.slots} />
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold">
          {label}
        </span>
      </div>
      {c.note && (
        <p className="mt-1 text-sm text-white/80 italic">“{c.note}”</p>
      )}
      <p className="mt-1 text-sm text-lime-300">{status}</p>
      {c.status === "pending" && !compact && (
        <>
          <ul className="mt-1 space-y-0.5 text-xs text-white/60">
            {c.needs.map((n) => (
              <li key={n.playerId}>
                {n.playerId === meId ? "You" : first(nameOf(n.playerId))}{" "}
                {STEP_WORDS[n.step]}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-white/50">
            Saying yes doesn&apos;t sign you up. On the day it goes ahead once
            all four are signed up and in the queue — and it never skips the
            line.
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {c.status === "pending" && invited && !accepted && (
          <Btn
            className="flex-1 !py-2"
            onClick={() =>
              act({ type: "challenge-accept", challengeId: c.id }, c.session)
            }
          >
            Accept
          </Btn>
        )}
        {waiting && invited && (
          <Btn
            kind="ghost"
            className="flex-1 !py-2"
            onClick={() =>
              act({ type: "challenge-decline", challengeId: c.id }, c.session)
            }
          >
            {c.by === meId
              ? "Call it off"
              : accepted
                ? "Pull out"
                : "No thanks"}
          </Btn>
        )}
        {waiting && (
          <a
            href={whatsapp(challengeShare(c, label, site))}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share this invite to WhatsApp"
            className="rounded-xl bg-emerald-500/90 px-4 py-2 text-center font-bold text-white"
          >
            Share to WhatsApp
          </a>
        )}
      </div>
    </Card>
  );
}

/** Invite someone who isn't in the club yet. A link, not a sync. */
function InviteRow() {
  const site = useOrigin();
  const text =
    `🏸 Drop-in badminton at ${SEASON.club} — Mondays 7:00–9:00 pm and Thursdays 6:30–8:30 pm at ${SEASON.venue}. ` +
    `Everybody plays! Sign-up opens at 8:00 am on the day, first 25 in. ${site}/badminton`;
  return (
    <a
      href={whatsapp(text)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-xl bg-emerald-500/15 p-3 text-sm ring-1 ring-emerald-400/30"
    >
      <span>
        <b>Invite a friend</b> — share the club night to WhatsApp
      </span>
      <span aria-hidden>↗</span>
    </a>
  );
}

function ChallengeSheet({
  open,
  onClose,
  view,
  act,
}: {
  open: boolean;
  onClose: () => void;
  view: LiveView;
  act: Act;
}) {
  const meId = view.me!.id;
  const nights = view.sessions.filter(
    (s) => s.registration === "open" || s.registration === "not-yet",
  );
  const [session, setSession] = useState("");
  const [partner, setPartner] = useState("");
  const [o1, setO1] = useState("");
  const [o2, setO2] = useState("");
  const [note, setNote] = useState("");
  const [rematch, setRematch] = useState(false);
  const target = session || nights[0]?.id || "";
  const members = view.clubhouse!.members.filter((p) => p.id !== meId);
  const last = view.night?.me?.played[0] ?? null;
  const ready = !!(target && partner && o1 && o2);
  const pick = (
    value: string,
    set: (v: string) => void,
    label: string,
    taken: string[],
  ) => (
    <label className="block">
      <span className="text-sm text-white/70">{label}</span>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded-xl bg-white/10 p-3 text-base"
      >
        <option value="">Choose…</option>
        {members
          .filter((p) => !taken.includes(p.id) || p.id === value)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
    </label>
  );
  const fillRematch = () => {
    if (!last) return;
    const ids = last.slots.map((p) => p?.id ?? "");
    const mineSide = ids.indexOf(meId) < 2 ? [0, 1, 2, 3] : [2, 3, 0, 1];
    const [me, pa, a, b] = mineSide.map((i) => ids[i]!);
    if (me !== meId) return;
    setPartner(pa!);
    setO1(a!);
    setO2(b!);
    setNote("Same four again? 🔁");
    setRematch(true);
    if (view.night) setSession(view.night.id);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Invite friends to a game">
      {nights.length === 0 ? (
        <p className="text-white/70">
          There&apos;s no club night coming up to plan a game for just now.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            Pick your partner and the other two. Everyone can say yes or no — no
            explanation needed — it doesn&apos;t sign anybody up. On the day it
            goes ahead once all four are signed up and in the queue, and it
            never skips the line.
          </p>
          {last && (
            <Btn kind="ghost" className="w-full" onClick={fillRematch}>
              🔁 Same four again?
            </Btn>
          )}
          <label className="block">
            <span className="text-sm text-white/70">Which night?</span>
            <select
              value={target}
              onChange={(e) => setSession(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/10 p-3 text-base"
            >
              {nights.map((s) => (
                <option key={s.id} value={s.id}>
                  {weekdayLabel(s.date)} · {s.hours}
                </option>
              ))}
            </select>
          </label>
          {pick(partner, setPartner, "Your partner", [o1, o2])}
          {pick(o1, setO1, "Playing against", [partner, o2])}
          {pick(o2, setO2, "Their partner", [partner, o1])}
          <label className="block">
            <span className="text-sm text-white/70">
              A playful line (optional)
            </span>
            <input
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Loser buys the shuttles 😎"
              className="mt-1 w-full rounded-xl bg-white/10 p-3 text-base"
            />
          </label>
          <Btn
            className="w-full"
            disabled={!ready}
            onClick={async () => {
              const ok = await act(
                {
                  type: "challenge",
                  slots: [meId, partner, o1, o2],
                  ...(note.trim() ? { note: note.trim() } : {}),
                  ...(rematch ? { rematch: true } : {}),
                },
                target,
              );
              if (ok) {
                setPartner("");
                setO1("");
                setO2("");
                setNote("");
                setRematch(false);
                onClose();
              }
            }}
          >
            Send invite
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

// --- Organizer controls ------------------------------------------------------

function Moderation({ view, send }: { view: LiveView; send: ChatSend }) {
  const house = view.clubhouse!;
  const mod = house.moderation!;
  const [pin, setPin] = useState("");
  return (
    <details className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
      <summary className="cursor-pointer font-bold">
        Organizer controls
        {mod.flagged > 0 && (
          <span className="ml-2 rounded-full bg-rose-500/30 px-2 text-xs text-rose-100">
            {mod.flagged} reported
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>
            Chat is <b>{house.locked ? "paused" : "open"}</b>
          </span>
          <Btn
            kind={house.locked ? "primary" : "ghost"}
            className="!px-3 !py-2"
            onClick={() => send({ type: "lock", locked: !house.locked })}
          >
            {house.locked ? "Resume chat" : "Pause chat"}
          </Btn>
        </div>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.trim())
              void send({ type: "pin", text: pin.trim() }).then(
                (ok) => ok && setPin(""),
              );
          }}
        >
          <label className="block">
            <span className="text-white/70">Pin an announcement</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={MAX_TEXT}
              placeholder="Doors at 6:30 — bring water"
              className="mt-1 w-full rounded-xl bg-white/10 p-3 text-base"
            />
          </label>
          <div className="flex gap-2">
            <Btn
              type="submit"
              kind="ghost"
              className="!px-3 !py-2"
              disabled={!pin.trim()}
            >
              Pin it
            </Btn>
            {house.pinned && (
              <Btn
                kind="ghost"
                className="!px-3 !py-2"
                onClick={() => send({ type: "pin", text: null })}
              >
                Unpin
              </Btn>
            )}
          </div>
        </form>
        <div>
          <p className="text-white/70">
            Paused players{mod.muted.length ? "" : ": none"}
          </p>
          <ul className="mt-1 space-y-1">
            {mod.muted.map((m) => (
              <li
                key={m.person.id}
                className="flex items-center justify-between"
              >
                <span>
                  {m.person.name}{" "}
                  <span className="text-white/50">
                    {m.until === null
                      ? "for the season"
                      : `until ${clock(m.until)}`}
                  </span>
                </span>
                <Btn
                  kind="ghost"
                  className="!px-3 !py-1"
                  onClick={() =>
                    send({ type: "unmute", playerId: m.person.id })
                  }
                >
                  Let them chat
                </Btn>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-white/50">
            Tap any message to remove it or pause its author. Three reports hide
            a message until you look.
          </p>
        </div>
        {mod.log.length > 0 && (
          <ul className="space-y-0.5 text-xs text-white/50">
            {mod.log.map((l, i) => (
              <li key={i}>
                {clock(l.at)} · {l.by} — {l.what}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
