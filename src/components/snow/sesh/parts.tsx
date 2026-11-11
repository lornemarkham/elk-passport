"use client";

import Link from "next/link";
import { useState } from "react";
import { REPORT_REASONS } from "@/domain/snow/sesh/actions";
import {
  CATEGORY_LABEL,
  DIVISION_LABEL,
  REACTIONS,
  REACTION_LABEL,
  SPORT_LABEL,
  type Challenge,
  type Clip,
  type ThreadKind,
} from "@/domain/snow/sesh/model";
import {
  canChirp,
  challengeState,
  clipOf,
  featureOf,
  reactionCounts,
  riderOf,
  threadChirps,
} from "@/domain/snow/sesh/rules";
import { QUICK_CHIRPS } from "@/domain/snow/sesh/safety";
import { ago, timeLeft } from "@/domain/snow/sesh/time";
import { DemoReel } from "./art";
import { Chip, Refusal, RiderLink, cx, styles, useAct, useSesh } from "./ctx";

/**
 * A clip you watch only when you ask to: a still until tapped, then the
 * video with `preload="none"` until then — nothing autoplays, nothing
 * downloads in the background. Demo clips are drawings and say so.
 */
export function ClipPlayer({
  clip,
  compact = false,
}: {
  clip: Clip;
  compact?: boolean;
}) {
  const { world } = useSesh();
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const f = featureOf(world, clip.featureId);
  const kind = f?.kind ?? "jump";
  const m = clip.media;
  const label = `Play ${riderOf(world, clip.riderId)?.name ?? "the rider"}'s clip on ${f?.name ?? "the feature"}`;
  return (
    <div
      className={cx(
        styles.film,
        compact ? "aspect-video" : "aspect-video w-full",
      )}
    >
      {m.kind === "illustration" || broken ? (
        <button
          type="button"
          aria-label={playing ? "Pause the demo illustration" : label}
          onClick={() => setPlaying((p) => !p)}
          className="block h-full w-full"
        >
          <DemoReel
            kind={kind}
            seed={m.kind === "illustration" ? m.seed : 7}
            playing={playing}
            sport={clip.sport}
          />
          {broken && (
            <span className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1 text-xs text-[var(--sw-cream)]">
              Your demo clip stayed on your phone and is gone after a reload —
              here&apos;s a drawing instead.
            </span>
          )}
          {!playing && <PlayBadge />}
        </button>
      ) : playing ? (
        <video
          src={m.url}
          poster={m.kind === "video" ? m.poster : undefined}
          controls
          autoPlay
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
          className="h-full w-full bg-black object-contain"
        />
      ) : (
        <button
          type="button"
          aria-label={label}
          onClick={() => setPlaying(true)}
          className="relative block h-full w-full"
        >
          {m.kind === "video" && m.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.poster}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <span
              className={cx(
                styles.display,
                "flex h-full w-full items-center justify-center bg-[var(--sw-olive)] text-3xl text-[var(--sw-cream)] uppercase",
              )}
            >
              {f?.name ?? "Sesh"}
            </span>
          )}
          <PlayBadge />
          {m.kind === "local" && (
            <span className="absolute top-2 left-4 z-10">
              <Chip tone="demo">Your file · this phone only</Chip>
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function PlayBadge() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[var(--sw-char)] bg-[var(--sw-orange)] text-2xl text-[var(--sw-cream)] shadow-[3px_3px_0_var(--sw-char)]">
        ▶
      </span>
    </span>
  );
}

export function ClipCard({ clip }: { clip: Clip }) {
  const { world, base, now } = useSesh();
  const f = featureOf(world, clip.featureId);
  const rider = riderOf(world, clip.riderId);
  const counts = reactionCounts(world, clip.id);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <article className={cx(styles.card, "overflow-hidden")}>
      <ClipPlayer clip={clip} compact />
      <div className="p-3">
        <p className="text-sm">
          <RiderLink rider={rider} /> ·{" "}
          <span className="opacity-75">{ago(clip.at, now)}</span>
        </p>
        <p className="mt-0.5 text-sm font-semibold">
          {f ? (
            <Link
              href={`${base}/f/${f.id}`}
              className="underline underline-offset-2"
            >
              {f.name}
            </Link>
          ) : null}{" "}
          · {CATEGORY_LABEL[clip.category]}
        </p>
        {clip.caption && <p className="mt-1 text-sm">“{clip.caption}”</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold">
            {total > 0 ? `🔥 ${total}` : "Be the first to react"}
          </span>
          <Link
            href={`${base}/c/${clip.id}`}
            className={cx(styles.btn, "px-3 py-1 text-xs")}
          >
            Open clip
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ClipMeta({ clip }: { clip: Clip }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip>{SPORT_LABEL[clip.sport]}</Chip>
      <Chip>{DIVISION_LABEL[clip.division]} division</Chip>
      <Chip>{CATEGORY_LABEL[clip.category]}</Chip>
      {clip.byGuardian && <Chip>Posted by a parent</Chip>}
    </div>
  );
}

export function Reactions({ clip }: { clip: Clip }) {
  const { world, viewer } = useSesh();
  const { run, busy, reason } = useAct();
  const counts = reactionCounts(world, clip.id);
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="React">
        {REACTIONS.map((k) => {
          const mine = world.reactions.some(
            (r) =>
              r.clipId === clip.id &&
              r.riderId === viewer.riderId &&
              r.kind === k,
          );
          return (
            <button
              key={k}
              type="button"
              disabled={busy}
              aria-pressed={mine}
              onClick={() => run({ type: "react", clipId: clip.id, kind: k })}
              className={cx(styles.btn, "min-h-11 px-3 text-sm")}
            >
              {REACTION_LABEL[k].emoji} {REACTION_LABEL[k].words}{" "}
              {counts[k] ? <b className="ml-1">{counts[k]}</b> : null}
            </button>
          );
        })}
      </div>
      <Refusal reason={reason} />
    </div>
  );
}

/** The Chirp Room of a feature, clip or challenge. */
export function ChirpRoom({
  kind,
  id,
  title = "Chirp Room",
}: {
  kind: ThreadKind;
  id: string;
  title?: string;
}) {
  const { world, viewer, now, signIn, base } = useSesh();
  const { run, busy, reason } = useAct();
  const [text, setText] = useState("");
  const chirps = threadChirps(world, kind, id);
  const can = canChirp(world, viewer, kind, id);
  async function send(body: string) {
    const r = await run({ type: "chirp", thread: { kind, id }, body });
    if (r.ok) setText("");
  }
  return (
    <section aria-label={title} className={cx(styles.card, "mt-6 p-4")}>
      <h2 className={cx(styles.display, "text-xl uppercase")}>💬 {title}</h2>
      <p className="text-xs opacity-75">
        Chirp the riding, not the rider. Friendly or it doesn&apos;t post.
      </p>
      <ol className="mt-3 space-y-2">
        {chirps.length === 0 && (
          <li className="text-sm opacity-75">
            Quiet in here. Say something nice — or something funny.
          </li>
        )}
        {chirps.map((c) => (
          <li
            key={c.id}
            className="flex items-start justify-between gap-2 rounded-lg bg-[#fbf6e8] px-3 py-2 text-sm"
          >
            <span>
              <RiderLink rider={riderOf(world, c.authorId)} />: {c.body}
              <span className="ml-2 text-xs opacity-60">{ago(c.at, now)}</span>
            </span>
            {viewer.signedIn && c.authorId !== viewer.riderId && (
              <ReportButton kind="chirp" id={c.id} small />
            )}
          </li>
        ))}
      </ol>
      {can.ok ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHIRPS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => send(q)}
                className={cx(styles.btn, "px-3 py-1 text-xs")}
              >
                {q}
              </button>
            ))}
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Your chirp</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={280}
              placeholder="Chirp…"
              className={styles.input}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className={cx(styles.go, "mt-2 min-h-11 rounded-full px-5 text-sm")}
          >
            Chirp it
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm font-semibold">
          {can.reason}{" "}
          {!viewer.signedIn ? (
            <a href={signIn} className="underline">
              Sign in
            </a>
          ) : !viewer.riderId ? (
            <Link href={`${base}/me`} className="underline">
              Make your rider profile
            </Link>
          ) : null}
        </p>
      )}
      <Refusal reason={reason} />
    </section>
  );
}

export function ReportButton({
  kind,
  id,
  small,
}: {
  kind: "clip" | "chirp" | "feature";
  id: string;
  small?: boolean;
}) {
  const { viewer } = useSesh();
  const { run, busy, reason } = useAct();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (!viewer.signedIn) return null;
  if (done)
    return (
      <span className="text-xs font-semibold" role="status">
        Reported — thanks. A moderator will look.
      </span>
    );
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          small ? "text-xs underline" : cx(styles.btn, "min-h-11 px-4 text-sm"),
        )}
        aria-expanded={open}
      >
        ⚑ Report
      </button>
      {open && (
        <span className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-1 rounded-xl border-2 border-[var(--sw-char)] bg-[var(--sw-cream)] p-2 shadow-[3px_3px_0_var(--sw-char)]">
          {REPORT_REASONS.filter(
            (r) => kind === "feature" || !r.startsWith("This feature"),
          ).map((r) => (
            <button
              key={r}
              type="button"
              disabled={busy}
              className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--sw-paper)]"
              onClick={async () => {
                const out = await run({
                  type: "report",
                  target: { kind, id },
                  reason: r,
                });
                if (out.ok) setDone(true);
              }}
            >
              {r}
            </button>
          ))}
          <Refusal reason={reason} />
        </span>
      )}
    </span>
  );
}

/** A compact head-to-head line for lists. */
export function ChallengeRow({ ch }: { ch: Challenge }) {
  const { world, base, now } = useSesh();
  const s = challengeState(world, ch, now);
  const a = riderOf(world, clipOf(world, ch.defenderClipId)?.riderId ?? "");
  const b = riderOf(world, clipOf(world, ch.challengerClipId)?.riderId ?? "");
  const f = featureOf(world, ch.featureId);
  return (
    <Link
      href={`${base}/x/${ch.id}`}
      className={cx(
        styles.card,
        "flex items-center justify-between gap-3 p-3 hover:bg-[#f6efdc]",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-extrabold">
          {a?.name ?? "?"} <span className="text-[var(--sw-red)]">⚔️</span>{" "}
          {b?.name ?? "?"}
        </span>
        <span className="block truncate text-xs opacity-80">
          {f?.name} · {CATEGORY_LABEL[ch.category]}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs font-bold">
        {s.open ? (
          <>
            <span className="block">
              {s.tally.defender}–{s.tally.challenger}
            </span>
            <span className="block text-[var(--sw-red)]">
              {timeLeft(s.msLeft)}
            </span>
          </>
        ) : s.noContest ? (
          "No contest"
        ) : (
          <>👑 {riderOf(world, s.winnerRiderId)?.name}</>
        )}
      </span>
    </Link>
  );
}
