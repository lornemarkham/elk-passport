"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Dices,
  Lock,
  MessageCircleHeart,
  Send,
  Shuffle,
  Trash2,
} from "lucide-react";
import {
  BAD_IDEAS,
  DARES,
  draw,
  textFor,
  THIS_OR_THAT,
  TWISTS,
  type AnswerBody,
  type DareFlavour,
  type Opens,
  type PlayBody,
  type PlayView,
  type Theme,
  type Turn,
  turnOf,
} from "@/domain/date-night/plays";
import { clock } from "@/domain/date-night/adventures/itinerary";
import { afterSend, copy, messageOf, sendText } from "./share";
import { cn } from "@/lib/utils";

/** What the composer is making. Predictions and photo dares are flavours. */
type Making =
  | "pick"
  | "predict"
  | "dare"
  | "photo"
  | "surprise"
  | "decide"
  | "note"
  | "secret"
  | "bad-idea";

const FIRST: readonly {
  id: Making;
  emoji: string;
  title: string;
  line: string;
}[] = [
  {
    id: "pick",
    emoji: "⚖️",
    title: "This or That",
    line: "Two choices. See if you match.",
  },
  {
    id: "dare",
    emoji: "🔥",
    title: "Send a Challenge",
    line: "Funny, romantic or brave.",
  },
  {
    id: "decide",
    emoji: "🫵",
    title: "You Decide",
    line: "They choose. You go with it.",
  },
];
const MORE: readonly { id: Making; emoji: string; title: string }[] = [
  { id: "predict", emoji: "🔮", title: "Our Predictions" },
  { id: "photo", emoji: "📸", title: "Photo Dare" },
  { id: "surprise", emoji: "🎲", title: "Surprise Me" },
  { id: "note", emoji: "💌", title: "Love Note" },
  { id: "secret", emoji: "🤫", title: "Secret Surprise" },
  { id: "bad-idea", emoji: "🙃", title: "Bad Ideas Dept." },
];

const FLAVOURS: readonly { id: DareFlavour; label: string }[] = [
  { id: "funny", label: "😂 Funny" },
  { id: "romantic", label: "❤️ Romantic" },
  { id: "adventurous", label: "🔥 Brave" },
  { id: "photo", label: "📸 Photo" },
];

const KIND_NAME: Record<PlayBody["k"], string> = {
  pick: "This or That",
  dare: "Challenge",
  decide: "You Decide",
  note: "Note",
  "bad-idea": "Bad Idea",
};

/** One choice "You decide" can offer, and what choosing it does. */
export interface DecidePair {
  readonly a: string;
  readonly b: string;
  readonly apply?: readonly [string | null, string | null];
}

/** A moment a note can open at: "when we leave", "at sunset". */
export interface OpenAt {
  readonly at: Opens;
  readonly said: string;
}

export interface PlaysProps {
  plays: readonly PlayView[];
  /** Who the texts go to: "Jess", or the planner's name. */
  partner: string;
  themes: ReadonlySet<Theme>;
  pairs: readonly DecidePair[];
  opensAt: readonly OpenAt[];
  /** The play a link opened, to show first and light up. */
  focus?: string | null;
  busy: boolean;
  isOwner: boolean;
  create: (body: PlayBody) => Promise<string | null>;
  answer: (
    play: PlayView,
    body: Omit<AnswerBody, "to" | "t">,
  ) => Promise<boolean>;
  remove: (play: PlayView) => Promise<void>;
  /** "ending:warm", "evening:crazy-creek": owner only. */
  apply: (what: string) => Promise<void>;
  /** The link to one play; for someone not yet in, their invitation too. */
  linkTo: (playId: string) => Promise<string | null>;
  /** The same link when it needs no round trip (they're in, or the
   * invitation is already made), so a tap can open the share sheet. */
  linkReady: (playId: string) => string | null;
  /** Open with this composer already out (from the Adventure room). */
  start?: Making | null;
}

function whenSaid(
  opens: Opens | undefined,
  opensAt: readonly OpenAt[],
): string {
  if (opens === undefined || opens === "now") return "now";
  return opensAt.find((o) => o.at === opens)?.said ?? `at ${clock(opens)}`;
}

/**
 * **Play together** — no chat, ever: everything here is made to be texted.
 * Three come first (This or That, a challenge, You Decide); the rest wait
 * one tap away. Every one you make has **Text Jess**: the phone's own share
 * sheet, or a new text, or a copy, and the link opens that exact card.
 */
export function Plays(props: PlaysProps) {
  const { plays, partner, focus, busy } = props;
  const [making, setMaking] = useState<Making | null>(props.start ?? null);
  /** Just made: the words and the link, ready for a tap to send. */
  const [ready, setReady] = useState<{
    id: string;
    words: string;
    url: string;
  } | null>(null);
  const waiting = plays.filter((p) => turnOf(p) === "yours");
  const theirTurn = plays.filter((p) => turnOf(p) === "theirs").length;
  const rest = plays.filter((p) => !waiting.includes(p));

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`play-${focus}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  async function textIt(
    play: PlayView | (PlayBody & { id: string }),
    words?: string,
  ) {
    // Ready at once when it can be, so the tap still opens the share sheet.
    const url = props.linkReady(play.id) ?? (await props.linkTo(play.id));
    if (!url) {
      toast.error("Couldn't make the link. Try again.");
      return;
    }
    const said = words ?? textFor(play, whenSaid(play.opens, props.opensAt));
    say(await sendText(said, url));
  }

  function say(sent: Awaited<ReturnType<typeof sendText>>) {
    const line = afterSend(sent, partner);
    if (line && sent === "failed") toast.error(line);
    else if (line) toast.success(line);
  }

  return (
    <section
      aria-labelledby="plays-heading"
      data-testid="plays"
      className="space-y-4"
    >
      <div>
        <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
          No chat. Just mischief.
        </p>
        <h2
          id="plays-heading"
          className="ghad-display mt-1 text-[30px] leading-[0.95] font-extrabold tracking-tight uppercase"
        >
          Play together
        </h2>
        <p className="mt-1.5 text-[14px] text-[var(--n-ink)]/70">
          Make one, send it to {partner}. Their link opens it right here, and
          their answer shows up on yours.
        </p>
        {(waiting.length > 0 || theirTurn > 0) && (
          <p
            className="mt-2 flex flex-wrap gap-2 text-[12.5px] font-bold"
            data-testid="plays-turns"
          >
            {waiting.length > 0 && (
              <span className="rounded-full bg-[var(--n-ember)] px-2.5 py-1 text-white">
                Your turn · {waiting.length}
              </span>
            )}
            {theirTurn > 0 && (
              <span className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[var(--n-ink)]/70">
                {partner}&apos;s turn · {theirTurn}
              </span>
            )}
          </p>
        )}
      </div>

      {waiting.length > 0 && (
        <div className="space-y-3" data-testid="plays-waiting">
          <p className="text-[13px] font-extrabold tracking-[0.14em] text-[var(--n-ember)] uppercase">
            Waiting for you · {waiting.length}
          </p>
          {waiting.map((p) => (
            <PlayCard key={p.id} play={p} {...props} textIt={textIt} />
          ))}
        </div>
      )}

      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label="Make something"
      >
        {FIRST.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={making === f.id}
            data-testid={`make-${f.id}`}
            onClick={() => {
              setReady(null);
              setMaking(making === f.id ? null : f.id);
            }}
            className={cn(
              "flex min-h-[112px] flex-col items-start justify-between rounded-[22px] p-3 text-left ring-1 transition sm:p-4",
              making === f.id
                ? "bg-[var(--n-forest)] text-[var(--n-cream)] ring-[var(--n-forest)]"
                : "bg-white ring-black/10",
            )}
          >
            <span className="text-[26px] leading-none" aria-hidden>
              {f.emoji}
            </span>
            <span>
              <span className="block text-[14.5px] leading-tight font-extrabold">
                {f.title}
              </span>
              <span
                className={cn(
                  "mt-0.5 hidden text-[12px] leading-snug sm:block",
                  making === f.id ? "text-white/75" : "text-[var(--n-ink)]/60",
                )}
              >
                {f.line}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="More to make"
      >
        {MORE.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={making === m.id}
            data-testid={`make-${m.id}`}
            onClick={() => {
              setReady(null);
              setMaking(making === m.id ? null : m.id);
            }}
            className={cn(
              "min-h-10 rounded-full px-3.5 text-[13px] font-bold ring-1 transition",
              making === m.id
                ? "bg-[var(--n-forest)] text-[var(--n-cream)] ring-[var(--n-forest)]"
                : "bg-white/70 ring-black/10",
            )}
          >
            <span aria-hidden>{m.emoji}</span> {m.title}
          </button>
        ))}
      </div>

      {making && (
        <Composer
          key={making}
          making={making}
          {...props}
          onMade={async (body) => {
            const id = await props.create(body);
            if (!id) return;
            // The link is made now, while nobody's waiting on a tap; the
            // share sheet then opens straight from "Send to …".
            const url = await props.linkTo(id);
            setMaking(null);
            if (!url) {
              toast.error(
                "Saved, but the link didn't make. Use Send on its card.",
              );
              return;
            }
            setReady({
              id,
              url,
              words: textFor(body, whenSaid(body.opens, props.opensAt)),
            });
          }}
          busy={busy}
        />
      )}

      {ready && (
        <div
          className="rounded-[24px] bg-[var(--n-forest)] p-4 text-[var(--n-cream)] sm:p-5"
          data-testid="ready-to-send"
          role="status"
        >
          <p className="flex items-center gap-2 text-[15px] font-extrabold">
            <Check className="h-4 w-4" aria-hidden /> Made. Now send it to{" "}
            {partner}.
          </p>
          <p className="mt-1 text-[13px] text-white/75">
            It goes from your own messages. Nothing is sent until you press send
            there.
          </p>
          <p className="mt-3 rounded-2xl bg-white/10 p-3 text-[14px] leading-snug">
            {ready.words}
          </p>
          <label className="mt-2 block text-[12px] font-semibold text-white/70">
            The link
            <input
              readOnly
              value={ready.url}
              onFocus={(e) => e.currentTarget.select()}
              data-testid="ready-link"
              className="mt-1 block min-h-11 w-full rounded-xl bg-white/90 px-3 text-[13px] text-[var(--n-ink)]"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="ready-send"
              onClick={async () => say(await sendText(ready.words, ready.url))}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--n-ember)] px-6 font-extrabold text-white"
            >
              <Send className="h-4 w-4" aria-hidden /> Send to {partner}
            </button>
            <button
              type="button"
              data-testid="ready-copy"
              onClick={async () => {
                if (await copy(messageOf(ready.words, ready.url)))
                  toast.success(
                    `Copied. Paste it into a message to ${partner}.`,
                  );
                else toast.error("Couldn't copy. Press and hold the link.");
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-bold ring-1 ring-white/40"
            >
              <Copy className="h-4 w-4" aria-hidden /> Copy link
            </button>
            <button
              type="button"
              onClick={() => setReady(null)}
              className="min-h-12 rounded-full px-4 font-bold text-white/80"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-3" data-testid="plays-feed">
          {rest.map((p) => (
            <PlayCard key={p.id} play={p} {...props} textIt={textIt} />
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------- composer

function Composer({
  making,
  themes,
  pairs,
  opensAt,
  partner,
  busy,
  onMade,
}: PlaysProps & {
  making: Making;
  onMade: (body: PlayBody) => Promise<void>;
}) {
  const startPair = () => draw(THIS_OR_THAT, themes);
  const startFlavour: DareFlavour = making === "photo" ? "photo" : "funny";
  const [pair, setPair] = useState(startPair);
  const [a, setA] = useState(pair[0]);
  const [b, setB] = useState(pair[1]);
  const [guess, setGuess] = useState<0 | 1 | null>(null);
  const [flavour, setFlavour] = useState<DareFlavour>(startFlavour);
  const [text, setText] = useState(() =>
    making === "surprise"
      ? draw(TWISTS, new Set())[0]
      : making === "bad-idea"
        ? draw(BAD_IDEAS, themes)[0]
        : making === "dare" || making === "photo"
          ? draw(DARES[startFlavour], themes)[0]
          : "",
  );
  const [surpriseFlavour, setSurpriseFlavour] = useState<DareFlavour>("funny");
  const [decide, setDecide] = useState(0);
  const [opens, setOpens] = useState<Opens>(
    making === "secret" ? (opensAt[1]?.at ?? "now") : "now",
  );

  const shuffle = () => {
    if (making === "pick" || making === "predict") {
      const next = draw(THIS_OR_THAT, themes, Math.random, pair);
      setPair(next);
      setA(next[0]);
      setB(next[1]);
      setGuess(null);
    } else if (making === "surprise") {
      const [t, f] = draw(TWISTS, new Set());
      setText(t);
      setSurpriseFlavour(f);
    } else if (making === "bad-idea") setText(draw(BAD_IDEAS, themes)[0]);
    else setText(draw(DARES[flavour], themes)[0]);
  };

  // Stamped when it is saved (`createPlay`).
  const t = 0;
  let body: PlayBody | null = null;
  if ((making === "pick" || making === "predict") && a.trim() && b.trim())
    body =
      making === "predict"
        ? guess === null
          ? null
          : { k: "pick", a: a.trim(), b: b.trim(), mode: "predict", guess, t }
        : {
            k: "pick",
            a: a.trim(),
            b: b.trim(),
            mode: "match",
            ...(guess !== null ? { guess } : {}),
            t,
          };
  if ((making === "dare" || making === "photo") && text.trim())
    body = { k: "dare", text: text.trim(), flavour, t };
  if (making === "surprise" && text.trim())
    body = { k: "dare", text: text.trim(), flavour: surpriseFlavour, t };
  if (making === "bad-idea" && text.trim())
    body = { k: "bad-idea", text: text.trim(), t };
  if (making === "decide" && pairs[decide])
    body = {
      k: "decide",
      a: pairs[decide]!.a,
      b: pairs[decide]!.b,
      ...(pairs[decide]!.apply ? { apply: pairs[decide]!.apply } : {}),
      t,
    };
  if ((making === "note" || making === "secret") && text.trim())
    body = {
      k: "note",
      text: text.trim(),
      opens,
      ...(making === "secret" ? { secret: true as const } : {}),
      t,
    };

  /** Why "Make it" can't go yet, in words; null when it can. */
  const missing = busy
    ? "Saving…"
    : body
      ? null
      : (making === "pick" || making === "predict") && (!a.trim() || !b.trim())
        ? "Fill in both choices."
        : making === "predict"
          ? `Pick your guess at what ${partner} chooses.`
          : making === "decide"
            ? "Choose an adventure first; then there's something to decide."
            : making === "note"
              ? "Write the note first."
              : making === "secret"
                ? "Write the secret first."
                : "Write something first, or tap Another.";

  const input =
    "min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base";

  return (
    <div
      className="rounded-[24px] bg-[var(--n-paper)] p-4 ring-1 ring-black/5 sm:p-5"
      data-testid="composer"
    >
      {(making === "pick" || making === "predict") && (
        <>
          <p className="text-[15px] font-extrabold">
            {making === "predict" ? "Guess what they'll pick" : "This or that?"}
          </p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              aria-label="This"
              value={a}
              maxLength={40}
              onChange={(e) => setA(e.target.value)}
              className={input}
            />
            <span className="text-[13px] font-bold text-[var(--n-ink)]/50">
              or
            </span>
            <input
              aria-label="That"
              value={b}
              maxLength={40}
              onChange={(e) => setB(e.target.value)}
              className={input}
            />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[var(--n-ink)]/65">
            {making === "predict"
              ? `I think ${partner} picks…`
              : "Mine (they see it after they pick):"}
          </p>
          <div className="mt-1.5 flex gap-2">
            {[a, b].map((x, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={guess === i}
                data-testid={`guess-${i}`}
                onClick={() => setGuess(guess === i ? null : (i as 0 | 1))}
                className={cn(
                  "min-h-11 flex-1 rounded-full px-3 text-[14px] font-bold ring-1",
                  guess === i
                    ? "bg-[var(--n-ember)] text-white ring-[var(--n-ember)]"
                    : "bg-white ring-black/10",
                )}
              >
                {x || "…"}
              </button>
            ))}
          </div>
        </>
      )}

      {(making === "dare" || making === "photo") && (
        <>
          <p className="text-[15px] font-extrabold">
            {making === "photo" ? "A photo dare" : "Send a challenge"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FLAVOURS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={flavour === f.id}
                onClick={() => {
                  setFlavour(f.id);
                  setText(draw(DARES[f.id], themes)[0]);
                }}
                className={cn(
                  "min-h-10 rounded-full px-3.5 text-[13px] font-bold ring-1",
                  flavour === f.id
                    ? "bg-[var(--n-forest)] text-white ring-[var(--n-forest)]"
                    : "bg-white ring-black/10",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
      {making === "surprise" && (
        <p className="text-[15px] font-extrabold">A twist for the night</p>
      )}
      {making === "bad-idea" && (
        <p className="text-[15px] font-extrabold">
          The Bad Ideas Department{" "}
          <span className="font-semibold text-[var(--n-ink)]/55">
            (jokes. Obviously.)
          </span>
        </p>
      )}
      {(making === "dare" ||
        making === "photo" ||
        making === "surprise" ||
        making === "bad-idea") && (
        <textarea
          aria-label="The words"
          value={text}
          maxLength={200}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          className="mt-3 w-full rounded-2xl border border-black/10 bg-white p-4 font-[family-name:var(--font-fraunces)] text-[18px] leading-snug italic"
        />
      )}

      {making === "decide" && (
        <>
          <p className="text-[15px] font-extrabold">{partner} decides</p>
          {pairs.length === 0 && (
            <p className="mt-2 text-[14px] text-[var(--n-ink)]/65">
              Nothing to decide yet.
            </p>
          )}
          <div
            className="mt-3 space-y-2"
            role="radiogroup"
            aria-label="Between"
          >
            {pairs.map((p, i) => (
              <button
                key={p.a + p.b}
                type="button"
                role="radio"
                aria-checked={decide === i}
                onClick={() => setDecide(i)}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-4 text-left text-[14.5px] font-bold ring-1",
                  decide === i
                    ? "bg-[var(--n-forest)] text-white ring-[var(--n-forest)]"
                    : "bg-white ring-black/10",
                )}
              >
                <span>
                  {p.a} <span className="opacity-60">or</span> {p.b}
                </span>
                {p.apply && (
                  <span className="shrink-0 text-[11px] font-semibold opacity-70">
                    changes the plan
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {(making === "note" || making === "secret") && (
        <>
          <p className="text-[15px] font-extrabold">
            {making === "secret" ? "A secret part of the night" : "A love note"}
          </p>
          <textarea
            aria-label={making === "secret" ? "The secret" : "The note"}
            value={text}
            maxLength={280}
            rows={3}
            placeholder={
              making === "secret"
                ? "I've packed your favourite chocolate for the fire."
                : "The thing you'd never say out loud."
            }
            onChange={(e) => setText(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-black/10 bg-white p-4 font-[family-name:var(--font-fraunces)] text-[18px] leading-snug italic"
          />
          <p className="mt-3 text-[13px] font-semibold text-[var(--n-ink)]/65">
            {partner} can open it
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {opensAt
              .filter((o) => making === "note" || o.at !== "now")
              .map((o) => (
                <button
                  key={String(o.at)}
                  type="button"
                  aria-pressed={opens === o.at}
                  onClick={() => setOpens(o.at)}
                  className={cn(
                    "min-h-10 rounded-full px-3.5 text-[13px] font-bold ring-1",
                    opens === o.at
                      ? "bg-[var(--n-forest)] text-white ring-[var(--n-forest)]"
                      : "bg-white ring-black/10",
                  )}
                >
                  {o.said}
                </button>
              ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--n-ink)]/50">
            Hidden from {partner}&apos;s screen until then. It&apos;s a
            surprise, not encryption.
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={missing !== null}
          aria-describedby={missing ? "make-missing" : undefined}
          onClick={() => body && void onMade(body)}
          data-testid="make-send"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--n-ember)] px-6 font-extrabold text-white shadow-[0_12px_28px_-14px_rgba(194,87,26,0.9)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <Send className="h-4 w-4" aria-hidden />
          {busy ? "Saving…" : `Make it for ${partner}`}
        </button>
        {making !== "decide" && making !== "note" && making !== "secret" && (
          <button
            type="button"
            onClick={shuffle}
            data-testid="make-shuffle"
            className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-[14px] font-bold ring-1 ring-black/15"
          >
            {making === "surprise" ? (
              <Dices className="h-4 w-4" aria-hidden />
            ) : (
              <Shuffle className="h-4 w-4" aria-hidden />
            )}
            Another
          </button>
        )}
      </div>
      {missing && !busy && (
        <p
          id="make-missing"
          className="mt-2 text-[13px] font-semibold text-[var(--n-ink)]/60"
          data-testid="make-missing"
        >
          {missing}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ cards

const REACTIONS = [
  { id: "lol", label: "😂" },
  { id: "no", label: "Absolutely not" },
  { id: "wait", label: "…wait, actually" },
] as const;

function PlayCard({
  play,
  partner,
  opensAt,
  focus,
  busy,
  isOwner,
  answer,
  remove,
  apply,
  linkTo,
  linkReady,
  textIt,
}: PlaysProps & {
  play: PlayView;
  textIt: (play: PlayView, words?: string) => Promise<void>;
}) {
  const p = play;
  const from = p.mine ? "You" : partner;
  const theirs = p.theirs;
  const yours = p.yours;
  const choice = (i: 0 | 1 | undefined) =>
    i === undefined ? undefined : i === 0 ? p.a : p.b;
  const when = whenSaid(p.opens, opensAt);
  const turn = turnOf(p);

  async function pick(i: 0 | 1) {
    if (!(await answer(p, { pick: i }))) return;
    // The owner deciding something that changes the plan: it changes.
    const what = p.apply?.[i];
    if (p.k === "decide" && isOwner && what) await apply(what);
  }

  let body: React.ReactNode = null;
  if (p.k === "pick" || p.k === "decide") {
    const answered = p.mine ? theirs : yours;
    const picked = answered?.pick;
    body = (
      <>
        <p className="mt-1 text-[18px] leading-snug font-extrabold">
          {p.a} <span className="font-semibold text-[var(--n-ink)]/45">or</span>{" "}
          {p.b}?
        </p>
        {!p.mine && picked === undefined && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([0, 1] as const).map((i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => void pick(i)}
                data-testid={`answer-${i}`}
                className="min-h-14 rounded-2xl bg-[var(--n-forest)] px-3 text-[15px] font-extrabold text-white disabled:opacity-60"
              >
                {choice(i)}
              </button>
            ))}
          </div>
        )}
        {picked !== undefined && (
          <p className="mt-2 text-[15px] font-bold" data-testid="play-result">
            {p.mine
              ? `${partner} picked ${choice(picked)}`
              : `You picked ${choice(picked)}`}
            {p.k === "pick" &&
              p.guess !== undefined &&
              (p.mode === "predict"
                ? picked === p.guess
                  ? p.mine
                    ? ". You called it. 🎯"
                    : `. ${partner} called it. 🎯`
                  : p.mine
                    ? `. You guessed ${choice(p.guess)}. Wrong! 😏`
                    : `. ${partner} guessed ${choice(p.guess)}. Ha. 😏`
                : picked === p.guess
                  ? `. Same as ${p.mine ? "you" : partner}. 🎯`
                  : `. ${p.mine ? "You" : partner} picked ${choice(p.guess)}. Opposites. ⚡`)}
            {p.k === "decide" && "."}
          </p>
        )}
        {p.mine && picked === undefined && (
          <p className="mt-2 text-[13.5px] font-semibold text-[var(--n-ink)]/55">
            Waiting for {partner}.
            {p.k === "pick" && p.guess !== undefined && (
              <>
                {" "}
                {p.mode === "predict" ? "Your guess" : "Yours"}:{" "}
                {choice(p.guess)}.
              </>
            )}
          </p>
        )}
        {p.k === "decide" &&
          p.mine &&
          isOwner &&
          picked !== undefined &&
          p.apply?.[picked] && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply(p.apply![picked]!)}
              data-testid="decide-apply"
              className="mt-3 min-h-11 rounded-full bg-[var(--n-forest)] px-5 text-[14px] font-bold text-white disabled:opacity-60"
            >
              Make it so
            </button>
          )}
      </>
    );
  } else if (p.k === "dare") {
    const state = p.mine ? theirs?.state : yours?.state;
    body = (
      <>
        <p className="mt-1 font-[family-name:var(--font-fraunces)] text-[20px] leading-snug italic">
          “{p.text}”
        </p>
        {!p.mine && state !== "done" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {state !== "on" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  data-testid="dare-on"
                  onClick={() => void answer(p, { state: "on" })}
                  className="min-h-12 rounded-full bg-[var(--n-ember)] px-5 font-extrabold text-white disabled:opacity-60"
                >
                  I&apos;m in 🔥
                </button>
                <button
                  type="button"
                  disabled={busy}
                  data-testid="dare-nope"
                  onClick={() => void answer(p, { state: "nope" })}
                  className="min-h-12 rounded-full px-5 font-bold ring-1 ring-black/15 disabled:opacity-60"
                >
                  Chicken 🐔
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                data-testid="dare-done"
                onClick={() => void answer(p, { state: "done" })}
                className="min-h-12 rounded-full bg-[var(--n-forest)] px-5 font-extrabold text-white disabled:opacity-60"
              >
                Done it ✓
              </button>
            )}
          </div>
        )}
        {state && (
          <p className="mt-2 text-[15px] font-bold" data-testid="play-result">
            {state === "on"
              ? p.mine
                ? `${partner} is in. 🔥`
                : "You're in. Now do it."
              : state === "nope"
                ? p.mine
                  ? `${partner} chickened out. 🐔 Noted.`
                  : "You chickened out. 🐔 It's on record."
                : p.mine
                  ? `${partner} did it. ✓ Legend.`
                  : "Done. ✓ Legend."}
          </p>
        )}
        {p.mine && !state && (
          <p className="mt-2 text-[13.5px] font-semibold text-[var(--n-ink)]/55">
            Waiting for {partner}.
          </p>
        )}
      </>
    );
  } else if (p.k === "note") {
    body = p.hidden ? (
      <p
        className="mt-1 flex items-center gap-2 text-[16px] font-bold"
        data-testid="note-locked"
      >
        <Lock className="h-4 w-4" aria-hidden />
        {p.secret
          ? "Something's planned."
          : `A note from ${partner}.`} Opens {when}.
      </p>
    ) : (
      <>
        <p className="mt-1 font-[family-name:var(--font-fraunces)] text-[20px] leading-snug italic">
          “{p.text}”
        </p>
        <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--n-ink)]/50">
          {p.mine
            ? p.opens === "now"
              ? `${partner} can read it now.`
              : `${partner} sees it ${when}.`
            : null}
        </p>
        {!p.mine && !yours && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(p, { react: "love" })}
            className="mt-2 min-h-11 rounded-full px-4 font-bold ring-1 ring-black/15 disabled:opacity-60"
          >
            ❤️ Got it
          </button>
        )}
        {(p.mine ? theirs : yours)?.react === "love" && (
          <p className="mt-2 text-[14px] font-bold">
            ❤️ {p.mine ? `${partner} loved it.` : "Loved."}
          </p>
        )}
      </>
    );
  } else if (p.k === "bad-idea") {
    const react = (p.mine ? theirs : yours)?.react;
    body = (
      <>
        <p className="mt-1 font-[family-name:var(--font-fraunces)] text-[20px] leading-snug italic">
          “{p.text}”
        </p>
        {!p.mine && !react && (
          <div className="mt-3 flex flex-wrap gap-2">
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={busy}
                onClick={() => void answer(p, { react: r.id })}
                className="min-h-11 rounded-full px-4 font-bold ring-1 ring-black/15 disabled:opacity-60"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {react && (
          <p className="mt-2 text-[15px] font-bold" data-testid="play-result">
            {p.mine ? `${partner}: ` : "You: "}
            {REACTIONS.find((r) => r.id === react)?.label}
          </p>
        )}
      </>
    );
  }

  const answered = !p.mine && yours;
  return (
    <article
      id={`play-${p.id}`}
      data-testid="play"
      data-kind={p.k}
      className={cn(
        "scroll-mt-24 rounded-[24px] bg-white p-4 ring-1 ring-black/5 sm:p-5",
        focus === p.id && "ring-2 ring-[var(--n-ember)]",
      )}
    >
      <p className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.16em] text-[var(--n-ember)] uppercase">
        <MessageCircleHeart className="h-3.5 w-3.5" aria-hidden />
        {p.k === "note" && p.secret ? "Secret surprise" : KIND_NAME[p.k]}
        {p.k === "pick" && p.mode === "predict" ? " · Prediction" : ""}
        {p.k === "dare" && p.flavour === "photo" ? " · Photo" : ""}
        <span className="font-semibold tracking-normal text-[var(--n-ink)]/45 normal-case">
          {p.mine ? "from you" : `from ${from}`}
        </span>
        <TurnChip turn={turn} partner={partner} />
      </p>
      {body}
      {(p.mine || answered) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
          <button
            type="button"
            onClick={() =>
              void textIt(
                p,
                p.mine
                  ? undefined
                  : `Answered your ${KIND_NAME[p.k]}. Your move. 😏`,
              )
            }
            data-testid="text-partner"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--n-ink)] px-4 text-[14px] font-bold text-[var(--n-cream)]"
          >
            <Send className="h-4 w-4" aria-hidden />
            {p.mine ? `Send to ${partner}` : `Tell ${partner}`}
          </button>
          <button
            type="button"
            data-testid="copy-link"
            onClick={async () => {
              const url = linkReady(p.id) ?? (await linkTo(p.id));
              if (url && (await copy(messageOf(textFor(p, when), url))))
                toast.success(`Copied. Paste it into a message to ${partner}.`);
              else toast.error("Couldn't copy the link. Try again.");
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-bold ring-1 ring-black/10"
          >
            <Copy className="h-4 w-4" aria-hidden /> Copy link
          </button>
          {p.mine && p.canChange && (
            <button
              type="button"
              onClick={() => void remove(p)}
              aria-label={`Take back this ${KIND_NAME[p.k]}`}
              className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--n-ink)]/45 hover:bg-black/5"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function TurnChip({ turn, partner }: { turn: Turn; partner: string }) {
  if (turn === "locked") return null;
  return (
    <span
      data-testid="turn"
      data-turn={turn}
      className={cn(
        "ml-auto rounded-full px-2 py-0.5 text-[10.5px] tracking-[0.08em]",
        turn === "yours" && "bg-[var(--n-ember)] text-white",
        turn === "theirs" && "bg-black/[0.06] text-[var(--n-ink)]/60",
        turn === "done" && "bg-[var(--n-forest)]/10 text-[var(--n-forest)]",
      )}
    >
      {turn === "yours"
        ? "Your turn"
        : turn === "theirs"
          ? `${partner}'s turn`
          : "Done ✓"}
    </span>
  );
}
