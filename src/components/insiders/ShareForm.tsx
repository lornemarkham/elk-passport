"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Camera, Mic, MicOff } from "lucide-react";
import { KINDS, KIND_LABEL, type Kind } from "@/domain/insiders/model";
import type { Draft } from "@/domain/insiders/extract";

/**
 * **Share something cool, in under a minute.** Say it, paste it, or snap the
 * poster; Go Have a Day reads it into fields; check them; send. Every field
 * stays editable, and nothing the reader filled is sent unseen.
 *
 * Voice is the browser's own speech recognition where it has one (Chrome,
 * Safari, Edge) and simply absent where it doesn't.
 */

type Speech = {
  start(): void;
  stop(): void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
};

const noop = () => () => {};

function speechCtor(): (new () => Speech) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => Speech;
    webkitSpeechRecognition?: new () => Speech;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface Fields {
  kind: Kind | "";
  title: string;
  town: string;
  venue: string;
  interests: string;
  organizer: string;
  organizerUrl: string;
  starts: string;
  ends: string;
  schedule: string;
  registrationUrl: string;
  provenance: string;
  contact: string;
  access: "public" | "members" | "ask-first";
}

const EMPTY: Fields = {
  kind: "",
  title: "",
  town: "",
  venue: "",
  interests: "",
  organizer: "",
  organizerUrl: "",
  starts: "",
  ends: "",
  schedule: "",
  registrationUrl: "",
  provenance: "",
  contact: "",
  access: "public",
};

function fromDraft(d: Draft, prev: Fields): Fields {
  const keep = (mine: string, theirs: string | undefined) =>
    mine || theirs || "";
  return {
    ...prev,
    kind: prev.kind || d.kind || "",
    title: keep(prev.title, d.title),
    town: keep(prev.town, d.town),
    venue: keep(prev.venue, d.venue),
    interests: keep(prev.interests, d.interests.join(", ")),
    organizer: keep(prev.organizer, d.organizer),
    organizerUrl: keep(prev.organizerUrl, d.organizerUrl),
    starts: keep(prev.starts, d.starts),
    ends: keep(prev.ends, d.ends),
    schedule: keep(prev.schedule, d.schedule),
    registrationUrl: keep(prev.registrationUrl, d.registrationUrl),
  };
}

const input =
  "w-full rounded-xl border border-black/20 bg-white px-3 py-2.5 text-base focus:border-black focus:outline-none";

export function ShareForm({
  asAmbassador = null,
}: {
  readonly asAmbassador?: string | null;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState<"reading" | "sending" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    status: string;
    duplicateOf?: string;
  } | null>(null);
  const [listening, setListening] = useState(false);
  const speech = useRef<Speech | null>(null);
  const trap = useRef<HTMLInputElement>(null);

  // The browser decides; the server never shows the button.
  const canSpeak = useSyncExternalStore(
    noop,
    () => !!speechCtor(),
    () => false,
  );

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((f) => ({ ...f, [k]: v }));

  function toggleVoice() {
    if (listening) {
      speech.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const s = new Ctor();
    s.continuous = true;
    s.interimResults = false;
    s.lang = "en-CA";
    const before = text;
    s.onresult = (e) => {
      const said = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ");
      setText([before, said].filter(Boolean).join(" ").trim());
    };
    s.onend = () => setListening(false);
    speech.current = s;
    setListening(true);
    s.start();
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 4_000_000) {
      setError("That photo is over 4 MB — try a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function readIt(): Promise<boolean> {
    setError(null);
    setNote(null);
    if (!text.trim() && !image) {
      setError(
        "Tell us a little about it first — or add a photo of the poster.",
      );
      return false;
    }
    setBusy("reading");
    try {
      const r = await fetch("/api/insiders/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(image ? { image } : {}) }),
      });
      const body = await r.json();
      if (!r.ok) {
        setError(
          body.error ?? "Couldn't read that — fill in the fields instead.",
        );
        setRead(true);
        return false;
      }
      setFields((f) => fromDraft(body.draft as Draft, f));
      setRead(true);
      setNote(
        body.because ??
          (body.ai
            ? "Read by rules and AI. AI only copies what you wrote — check the fields."
            : "Read by rules — check the fields and fill any gaps."),
      );
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setError(null);
    // Nothing the reader filled is sent unseen: reading shows the fields first.
    if (!read) {
      await readIt();
      return;
    }
    setBusy("sending");
    try {
      const r = await fetch("/api/insiders/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          kind: fields.kind || undefined,
          description: text,
          interests: fields.interests
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean),
          website: trap.current?.value ?? "",
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setError(body.because ?? body.error ?? "That didn't send — try again.");
        return;
      }
      setDone({
        status: body.status,
        ...(body.duplicateOf ? { duplicateOf: body.duplicateOf } : {}),
      });
    } finally {
      setBusy(null);
    }
  }

  if (done)
    return (
      <div
        data-testid="share-done"
        className="rounded-[28px] bg-[#f4efe6] p-6 sm:p-8"
      >
        <h2 className="ghad-display text-3xl font-extrabold tracking-[-0.03em]">
          {done.status === "published"
            ? "It's live. Nice one."
            : "Got it — thank you!"}
        </h2>
        <p className="mt-2 text-base text-black/75">
          {done.duplicateOf
            ? "We already had this one, so we added what you told us to it. A local will check it."
            : done.status === "published"
              ? "Your listing is on Go Have a Day now."
              : "A local ambassador will check it before it goes up. Dates and links go up once someone checks them against a source."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setText("");
              setImage(null);
              setFields(EMPTY);
              setRead(false);
              setNote(null);
            }}
            className="min-h-11 rounded-full bg-black px-5 font-semibold text-white"
          >
            Share another
          </button>
          <Link
            href="/local"
            className="inline-flex min-h-11 items-center rounded-full border border-black/20 px-5 font-semibold"
          >
            See what locals shared
          </Link>
        </div>
      </div>
    );

  return (
    <form
      data-testid="share-form"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="flex flex-col gap-5"
    >
      {asAmbassador && (
        <p
          className="rounded-xl bg-black/5 px-3 py-2 text-sm"
          data-testid="share-as"
        >
          Sharing as ambassador <strong>{asAmbassador}</strong>.
        </p>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-lg font-bold">
          What is it? Tell it like you&apos;d tell a friend.
        </span>
        <textarea
          data-testid="share-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRead(false);
          }}
          rows={5}
          maxLength={4000}
          placeholder="The Squealing Pig — dirt bike race in the hills above Vernon, put on by the local club. Usually October. Their page: …"
          className={input}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        {canSpeak && (
          <button
            type="button"
            onClick={toggleVoice}
            data-testid="share-voice"
            aria-pressed={listening}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/20 px-4 font-semibold"
          >
            {listening ? (
              <MicOff className="h-4 w-4" aria-hidden />
            ) : (
              <Mic className="h-4 w-4" aria-hidden />
            )}
            {listening ? "Stop listening" : "Say it"}
          </button>
        )}
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-black/20 px-4 font-semibold">
          <Camera className="h-4 w-4" aria-hidden />
          {image ? "Poster added ✓" : "Add a poster or photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            data-testid="share-photo"
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          onClick={() => void readIt()}
          disabled={busy !== null}
          data-testid="share-read"
          className="min-h-11 rounded-full bg-black px-5 font-semibold text-white disabled:opacity-50"
        >
          {busy === "reading"
            ? "Reading…"
            : read
              ? "Read it again"
              : "Fill in the details for me"}
        </button>
      </div>

      {note && (
        <p className="text-sm text-black/60" data-testid="share-note">
          {note}
        </p>
      )}

      {read && (
        <fieldset
          className="grid grid-cols-1 gap-4 rounded-[24px] border border-black/10 p-4 sm:grid-cols-2 sm:p-5"
          data-testid="share-fields"
        >
          <legend className="px-1 text-sm font-bold">Check these</legend>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            What kind of thing
            <select
              data-testid="f-kind"
              className={input}
              value={fields.kind}
              onChange={(e) => set("kind", e.target.value as Kind)}
            >
              <option value="">Choose…</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <Field label="Name" k="title" fields={fields} set={set} />
          <Field label="Town" k="town" fields={fields} set={set} />
          <Field label="Venue or spot" k="venue" fields={fields} set={set} />
          <Field
            label="Interests (comma separated)"
            k="interests"
            fields={fields}
            set={set}
          />
          <Field label="Who runs it" k="organizer" fields={fields} set={set} />
          <Field
            label="Organizer's page or a public page about it"
            k="organizerUrl"
            fields={fields}
            set={set}
          />
          <Field
            label="Registration link"
            k="registrationUrl"
            fields={fields}
            set={set}
          />
          <Field
            label="Starts (only if a date is announced)"
            k="starts"
            fields={fields}
            set={set}
            type="date"
          />
          <Field label="Ends" k="ends" fields={fields} set={set} type="date" />
          <Field
            label="Or when it happens regularly"
            k="schedule"
            fields={fields}
            set={set}
          />
          <Field
            label="Where did you hear about it?"
            k="provenance"
            fields={fields}
            set={set}
          />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Who can go
            <select
              data-testid="f-access"
              className={input}
              value={fields.access}
              onChange={(e) =>
                set("access", e.target.value as Fields["access"])
              }
            >
              <option value="public">Anyone</option>
              <option value="members">Members only</option>
              <option value="ask-first">Ask the organizer first</option>
            </select>
          </label>
          <Field
            label="Your email or phone, if we can ask you (never shown)"
            k="contact"
            fields={fields}
            set={set}
          />
        </fieldset>
      )}

      <input
        ref={trap}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      {error && (
        <p
          role="alert"
          className="text-sm font-semibold text-red-700"
          data-testid="share-error"
        >
          {error}
        </p>
      )}

      {read && (
        <button
          type="submit"
          disabled={busy !== null}
          data-testid="share-send"
          className="min-h-12 self-start rounded-full bg-[var(--gh-sun,#ffd166)] px-6 text-lg font-bold disabled:opacity-50"
        >
          {busy === "sending"
            ? "Sending…"
            : read
              ? "Send it"
              : "Read it and send"}
        </button>
      )}
      <p className="text-xs text-black/50">
        A local ambassador checks everything before it goes up. Dates,
        registration links and organizers are shown only once someone has
        checked them.
      </p>
    </form>
  );
}

function Field({
  label,
  k,
  fields,
  set,
  type = "text",
}: {
  label: string;
  k: keyof Fields;
  fields: Fields;
  set: <K extends keyof Fields>(k: K, v: Fields[K]) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input
        data-testid={`f-${k}`}
        type={type}
        value={fields[k] as string}
        onChange={(e) => set(k, e.target.value as never)}
        className={input}
      />
    </label>
  );
}
