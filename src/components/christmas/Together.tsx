"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  Loader2,
  Repeat,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  CHALLENGES,
  challengeById,
  proofAsk,
  satisfies,
  type Challenge,
} from "@/domain/christmas/challenges";
import type {
  ChallengePick,
  ChallengePlace,
} from "@/domain/christmas/challengePicks";
import {
  recapLine,
  recapOf,
  type Moment,
  type MomentKind,
} from "@/domain/christmas/recap";
import { useRouter } from "next/navigation";
import { MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { shrinkPhoto } from "./photo";
import styles from "./christmas.module.css";

const POLL_MS = 45_000;

type Draft =
  | { readonly kind: "challenge"; readonly challenge: Challenge }
  | { readonly kind: "moment" | "tradition" };

/**
 * **Challenges, memories and the recap — one list of what the group shared.**
 *
 * A challenge is finished by sharing what happened, so finishing one *is* a
 * memory; the recap is read from the same list (`recapOf`) and invents
 * nothing. Photos go up shrunk to 1280px and come back one at a time, to
 * members only.
 */
export function Together({
  adventureId,
  initial,
  enabled,
  againHref,
  done,
  picks = [],
}: {
  readonly adventureId: string;
  /** The dares that lead for this adventure, with real places (`pickChallenges`). */
  readonly picks?: readonly ChallengePick[];
  readonly initial: readonly Moment[];
  readonly enabled: boolean;
  /** "Go have another": a new Christmas plan seeded with this one's places. */
  readonly againHref: string;
  /** The adventure's days are over. */
  readonly done: boolean;
}) {
  const [moments, setMoments] = useState<readonly Moment[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const recap = useMemo(() => recapOf(moments), [moments]);

  const refresh = useCallback(async () => {
    const response = await fetch(`/christmas/api/${adventureId}/moments`, {
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) setMoments(await response.json());
  }, [adventureId]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  async function remove(id: string) {
    const response = await fetch(
      `/christmas/api/${adventureId}/moments/${id}`,
      {
        method: "DELETE",
      },
    ).catch(() => null);
    if (!response?.ok) return toast.error("Couldn't remove it. Try again.");
    setMoments((m) => m.filter((x) => x.id !== id));
  }

  if (!enabled)
    return (
      <section
        id="memories"
        className="rounded-[28px] bg-white p-6 ring-1 ring-black/5"
      >
        <h2 className="ghad-display text-3xl font-extrabold">
          Challenges & memories
        </h2>
        <p className="mt-2 max-w-xl text-base text-[var(--gh-ink-soft)]">
          Sharing photos, traditions and finished challenges with your group
          switches on when Passport&apos;s sharing step is applied. Until then
          the{" "}
          <Link
            href={`/adventures/${adventureId}/guide#afterwards`}
            className="font-semibold underline"
          >
            adventure guide
          </Link>{" "}
          has room to write down what happened.
        </p>
      </section>
    );

  const finishedByMe = new Set(
    moments
      .filter((m) => m.mine && m.kind === "challenge")
      .map((m) => m.challengeId),
  );
  const finishedBy = (id: string) =>
    recap.challenges.find((c) => c.id === id)?.by ?? [];
  // A few dares lead; the rest wait one tap away rather than as a wall.
  const leading: readonly ChallengePick[] =
    picks.length > 0
      ? picks
      : CHALLENGES.slice(0, 3).map((challenge) => ({
          challenge,
          why: "",
          places: [],
        }));
  const rest = CHALLENGES.filter(
    (c) => !leading.some((p) => p.challenge.id === c.id),
  );

  return (
    <>
      <section
        id="challenges"
        className="scroll-mt-20"
        data-testid="challenges"
      >
        <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
          Christmas challenges
        </p>
        <h2 className="ghad-display mt-1 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          Small dares. Big memories.
        </h2>
        <p className="mt-2 max-w-2xl text-base text-[var(--gh-ink-soft)]">
          All optional. Finish one with a photo or a line — it lands in your
          memories for everyone.
        </p>
        {recap.tally.length > 0 && (
          <p
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ffd98a] px-4 py-2 font-bold text-[#082319]"
            data-testid="tally"
          >
            <Trophy className="h-4 w-4" aria-hidden />
            {recap.tally.map((t) => `${t.name} ${t.count}`).join(" · ")}
          </p>
        )}
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leading.map((pick) => (
            <ChallengeCard
              key={pick.challenge.id}
              adventureId={adventureId}
              pick={pick}
              by={finishedBy(pick.challenge.id)}
              mine={finishedByMe.has(pick.challenge.id)}
              celebrating={celebrate === pick.challenge.id}
              onDo={() =>
                setDraft({ kind: "challenge", challenge: pick.challenge })
              }
            />
          ))}
        </ul>
        <details className="mt-4" data-testid="more-challenges">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">
            More dares ({rest.length})
          </summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                adventureId={adventureId}
                pick={{ challenge, why: "", places: [] }}
                by={finishedBy(challenge.id)}
                mine={finishedByMe.has(challenge.id)}
                celebrating={celebrate === challenge.id}
                onDo={() => setDraft({ kind: "challenge", challenge })}
              />
            ))}
          </ul>
        </details>
      </section>

      <section id="memories" className="scroll-mt-20" data-testid="memories">
        <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
          Memories
        </p>
        <h2 className="ghad-display mt-1 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          {done ? "That was Christmas." : "Keep the good bits"}
        </h2>
        <p
          className="mt-2 text-base text-[var(--gh-ink-soft)]"
          data-testid="recap-line"
        >
          {recapLine(recap)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDraft({ kind: "moment" })}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0f3b2b] px-5 font-bold text-white"
            data-testid="share-moment"
          >
            <Camera className="h-5 w-5" aria-hidden />
            Share a moment
          </button>
          <button
            type="button"
            onClick={() => setDraft({ kind: "tradition" })}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-black/10 bg-white px-5 font-semibold"
            data-testid="share-tradition"
          >
            🕯️ A family tradition
          </button>
        </div>

        {!recap.empty && (
          <div className="mt-6 space-y-6">
            {recap.traditions.length > 0 && (
              <div>
                <h3 className="ghad-display text-xl font-extrabold">
                  Our traditions
                </h3>
                <ul className="mt-2 space-y-2">
                  {recap.traditions.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-2xl bg-white p-4 ring-1 ring-black/5"
                    >
                      🕯️ {t.text}{" "}
                      <span className="text-sm text-[var(--gh-ink-soft)]">
                        — {t.by}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul
              className="columns-2 gap-3 sm:columns-3 [&>li]:mb-3"
              data-testid="memory-wall"
            >
              {[...moments]
                .reverse()
                .filter((m) => m.kind !== "tradition" || m.hasPhoto)
                .map((m) => (
                  <li
                    key={m.id}
                    className="break-inside-avoid overflow-hidden rounded-[18px] bg-white ring-1 ring-black/5"
                  >
                    {m.hasPhoto && (
                      // eslint-disable-next-line @next/next/no-img-element -- a member-only photo, served by our own route
                      <img
                        src={`/christmas/api/${adventureId}/moments/${m.id}/photo`}
                        alt={m.text ?? `A photo ${m.by} shared`}
                        loading="lazy"
                        className="w-full"
                      />
                    )}
                    <div className="space-y-1 p-3 text-sm">
                      {m.kind === "challenge" &&
                        challengeById(m.challengeId) && (
                          <p className="font-bold text-[#b3242f]">
                            {challengeById(m.challengeId)!.emoji}{" "}
                            {challengeById(m.challengeId)!.title}
                          </p>
                        )}
                      {m.text && <p>{m.text}</p>}
                      <p className="flex items-center justify-between text-[var(--gh-ink-soft)]">
                        <span>{m.by}</span>
                        {m.mine && (
                          <button
                            type="button"
                            onClick={() => void remove(m.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
                            aria-label="Remove this"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="mt-8 rounded-[28px] bg-[#b3242f] p-6 text-white sm:p-8">
          <p className="ghad-display text-3xl font-extrabold">
            Go have another.
          </p>
          <p className="mt-2 max-w-xl text-base text-white/85">
            Same people, same places, new dates — or the bits you loved and
            something new.
          </p>
          <Link
            href={againHref}
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-[#8e1d26]"
            data-testid="go-again"
          >
            <Repeat className="h-5 w-5" aria-hidden />
            Plan another Christmas adventure
          </Link>
        </div>
      </section>

      {draft && (
        <ShareSheet
          adventureId={adventureId}
          draft={draft}
          onClose={() => setDraft(null)}
          onShared={async () => {
            if (draft.kind === "challenge") {
              setCelebrate(draft.challenge.id);
              window.setTimeout(() => setCelebrate(null), 2400);
            }
            setDraft(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function ShareSheet({
  adventureId,
  draft,
  onClose,
  onShared,
}: {
  readonly adventureId: string;
  readonly draft: Draft;
  readonly onClose: () => void;
  readonly onShared: () => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<"photo" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const challenge = draft.kind === "challenge" ? draft.challenge : null;
  const ready = challenge
    ? satisfies(challenge, { text, hasPhoto: Boolean(photo) })
    : Boolean(text.trim() || photo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    setError(null);
    try {
      setPhoto(await shrinkPhoto(file));
    } catch {
      setError("That photo couldn't be used. Try another.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    setError(null);
    const kind: MomentKind = draft.kind;
    const response = await fetch(`/christmas/api/${adventureId}/moments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        text: text || null,
        photo,
        ...(challenge ? { challengeId: challenge.id } : {}),
      }),
    }).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      const b = await response?.json().catch(() => ({}));
      setError(b?.error ?? "Couldn't share it. Try again.");
      return;
    }
    toast.success(challenge ? "Challenge done! 🌟" : "Shared with the group.");
    await onShared();
  }

  const title = challenge
    ? challenge.title
    : draft.kind === "tradition"
      ? "A family tradition"
      : "Share a moment";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ghad-display text-2xl font-extrabold">{title}</p>
            {challenge && (
              <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                {challenge.dare} <strong>{proofAsk(challenge.proof)}.</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {challenge?.proof !== "words" && (
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void pick(e.target.files?.[0])}
              data-testid="photo-input"
            />
            {photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview */}
                <img
                  src={`data:image/jpeg;base64,${photo}`}
                  alt="Your photo"
                  className="max-h-72 w-full rounded-2xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Remove photo"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy === "photo"}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-black/15 font-semibold"
              >
                {busy === "photo" ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-6 w-6" aria-hidden />
                )}
                Add a photo
              </button>
            )}
          </div>
        )}
        {challenge?.proof !== "photo" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              draft.kind === "tradition"
                ? "Pyjamas and a film on Christmas Eve, every year since 1998"
                : challenge
                  ? "What happened?"
                  : "Gran on skates for the first time in forty years"
            }
            maxLength={600}
            className="mt-4 min-h-28 w-full rounded-2xl border-2 border-black/10 p-3 text-base focus:border-[#0f3b2b] focus:outline-none"
            data-testid="moment-text"
          />
        )}
        {error && (
          <p role="alert" className="mt-3 font-semibold text-[#8e1d26]">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={!ready || busy !== null}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#b3242f] font-bold text-white disabled:opacity-50"
          data-testid="moment-send"
        >
          {busy === "send" && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          )}
          {challenge ? "Done — share it" : "Share with the group"}
        </button>
      </div>
    </div>
  );
}

/**
 * One dare: why it fits this adventure, real places to do it where Atlas
 * holds them (each one tap onto the plan), and the share that finishes it.
 */
function ChallengeCard({
  adventureId,
  pick,
  by,
  mine,
  celebrating,
  onDo,
}: {
  readonly adventureId: string;
  readonly pick: ChallengePick;
  readonly by: readonly string[];
  readonly mine: boolean;
  readonly celebrating: boolean;
  readonly onDo: () => void;
}) {
  const c = pick.challenge;
  const router = useRouter();
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  async function add(place: ChallengePlace) {
    const response = await fetch(`/api/adventures/${adventureId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atlasRef: place.id, note: c.title }),
    }).catch(() => null);
    if (!response?.ok) return toast.error("Couldn't add it. Try again.");
    setAdded((a) => new Set([...a, place.id]));
    toast.success(`${place.title} is in the ideas.`);
    router.refresh();
  }
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-[22px] p-5",
        by.length ? "bg-[#0f3b2b] text-white" : "bg-white ring-1 ring-black/5",
      )}
      data-testid={`challenge-${c.id}`}
    >
      <div className="flex gap-3">
        <span className={cn("text-3xl", celebrating && styles.pop)} aria-hidden>
          {celebrating ? "🌟" : c.emoji}
        </span>
        <div>
          <p className="ghad-display text-lg leading-tight font-extrabold">
            {c.title}
          </p>
          {pick.why && (
            <p className="mt-0.5 text-sm font-semibold text-[#b3242f]">
              {pick.why}
            </p>
          )}
          <p
            className={cn(
              "mt-1 text-sm",
              by.length ? "text-white/80" : "text-[var(--gh-ink-soft)]",
            )}
          >
            {c.dare}
          </p>
        </div>
      </div>
      {pick.places.length > 0 && (
        <ul className="space-y-2" data-testid="challenge-places">
          {pick.places.map((place) => (
            <li
              key={place.id}
              className={cn(
                "rounded-2xl p-3 text-sm",
                by.length ? "bg-white/10" : "bg-[#fbf6ec]",
              )}
            >
              <p className="font-bold">{place.title}</p>
              <p className="flex items-center gap-1 opacity-80">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {place.km !== undefined ? `${place.km} km · ` : ""}
                {place.because}
              </p>
              {added.has(place.id) ? (
                <p className="mt-1 font-semibold">Added to the ideas ✓</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void add(place)}
                  className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold underline"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add to the plan
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {pick.gap && (
        <p className="text-sm opacity-80" data-testid="challenge-gap">
          {pick.gap}
        </p>
      )}
      {by.length > 0 && (
        <p className="text-sm font-semibold text-[#ffd98a]">
          Done by {by.join(", ")}
        </p>
      )}
      <button
        type="button"
        onClick={onDo}
        className={cn(
          "mt-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold",
          by.length
            ? "bg-white/15 text-white hover:bg-white/25"
            : "bg-[#b3242f] text-white hover:brightness-110",
        )}
        data-testid="do-challenge"
      >
        {mine ? <Check className="h-4 w-4" aria-hidden /> : null}
        {mine ? "Share another" : "We did it — share it"}
      </button>
    </li>
  );
}
