"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, X } from "lucide-react";
import {
  ASK_INFO,
  ASK_TYPES,
  ASSESSMENTS,
  ASSESSMENT_INFO,
  CHECK_LIMITS,
  CONFIRMATIONS,
  FILE_LIMITS,
  SEEN_ON,
  STANCE_LABEL,
  assessmentProblem,
  suggestAssessment,
  type Assessment,
  type AskType,
  type ClaimParts,
  type ConfirmKey,
  type Lead,
  type SeenOn,
} from "@/lib/pulse/check";
import { PROVINCES } from "@/lib/pulse/model";
import { SourceAdder, type Picked } from "../_ui/SourceAdder";

const CONFIRM = CONFIRMATIONS;

interface Analysis {
  parts: ClaimParts;
  questions: string[];
  leads: Lead[];
  duplicates: { slug: string; claim: string; assessment: Assessment }[];
}

const STEPS = ["See it", "Why", "Investigate", "Publish"] as const;

const field =
  "rounded-xl border border-[#d9d4c8] bg-white px-3.5 text-[16px] placeholder:text-[#8a909a]";
const primary =
  "min-h-14 w-full rounded-full bg-[#14161a] text-[17px] font-semibold text-white transition hover:bg-black disabled:opacity-40";

/**
 * Shrink a picture on the phone before it is sent: at most 1600 px, JPEG.
 * Re-drawing it also drops its hidden metadata (camera, time, GPS).
 */
async function shrink(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-image");
  if (file.size > 25_000_000) throw new Error("too-big");
  const bitmap = await createImageBitmap(file);
  for (const [edge, quality] of [
    [1600, 0.82],
    [1280, 0.7],
    [1000, 0.6],
  ] as const) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) =>
      canvas.toBlob(r, "image/jpeg", quality),
    );
    if (blob && blob.size <= FILE_LIMITS.bytes * 0.95)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
  }
  throw new Error("too-big");
}

export function CheckWizard() {
  const router = useRouter();
  const opened = useRef(0);
  const [step, setStep] = useState(0);

  // 1. See it
  const [link, setLink] = useState("");
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [claim, setClaim] = useState("");
  const [seenOn, setSeenOn] = useState<SeenOn>("facebook");
  const [file, setFile] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<"screenshot" | "photo">(
    "screenshot",
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [usedHeadline, setUsedHeadline] = useState(false);

  // 2. Why
  const [why, setWhy] = useState("");
  const [scopeKind, setScopeKind] = useState<"canada" | "province" | "city">(
    "canada",
  );
  const [province, setProvince] = useState("BC");
  const [city, setCity] = useState("");

  // 3. Investigate
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sources, setSources] = useState<Picked[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [summary, setSummary] = useState("");

  // 4. Publish
  const [ask, setAsk] = useState<AskType>("fact");
  const [question, setQuestion] = useState<string>(ASK_INFO.opinion.question);
  const [options, setOptions] = useState("Yes, No");
  const [confirm, setConfirm] = useState<Record<ConfirmKey, boolean>>({
    accurate: false,
    publicSubject: false,
    noPersonal: false,
    notVerified: false,
  });
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Once: an effect can run again while state is kept (a route re-shown),
    // and the form's age must count from when it was first opened.
    if (!opened.current) opened.current = Date.now();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const now = new Date();
  const suggested = suggestAssessment(
    sources.map((s) => ({ stance: s.stance, published: s.source.published })),
    now,
  );
  const chosen = assessment ?? suggested;
  const sum = summary.trim() || null;

  async function readLink() {
    if (!link.trim()) return;
    setReading(true);
    setLinkNote(null);
    const res = await fetch("/api/pulse/check/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ as: "origin", url: link.trim() }),
    }).catch(() => null);
    const out = await res?.json().catch(() => null);
    if (out?.seenOn) setSeenOn(out.seenOn);
    if (out?.ok) {
      setLinkTitle(out.title);
      setLinkNote(
        out.title
          ? `Read “${out.title}” from ${out.site}.`
          : `Opened ${out.site}, but it has no headline.`,
      );
    } else
      setLinkNote(
        out?.reason ?? "Couldn't read that link. Type what it says below.",
      );
    setReading(false);
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFileError(null);
    try {
      setFile(await shrink(f));
      setFileKind(/screen|shot|capture/i.test(f.name) ? "screenshot" : "photo");
    } catch (err) {
      setFileError(
        String(err).includes("not-image")
          ? "That isn't a picture. Add a screenshot or photo."
          : "That picture is too big or can't be read here.",
      );
    }
  }

  async function investigate() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pulse/check/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim,
        form: claimForm(),
        url: link.trim() || null,
        scope: scope(),
      }),
    }).catch(() => null);
    const out = await res?.json().catch(() => null);
    if (res?.ok && out?.parts) {
      setAnalysis(out);
      setStep(2);
    } else
      setError(out?.error ?? "Couldn't read the claim. Check your connection.");
    setBusy(false);
  }

  function claimForm() {
    if (file) return fileKind;
    if (usedHeadline) return "headline";
    if (link.trim()) return "url";
    return "text";
  }

  function scope() {
    if (scopeKind === "canada") return { kind: "canada" };
    if (scopeKind === "province") return { kind: "province", province };
    return { kind: "city", province, city };
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pulse/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: {
          text: claim,
          form: claimForm(),
          seenOn,
          url: link.trim() || null,
          pageTitle: linkTitle,
        },
        why,
        scope: scope(),
        ask,
        question: ask === "opinion" ? question : undefined,
        options:
          ask === "opinion"
            ? options
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
        sources: sources.map(({ sealed, stance, note }) => ({
          sealed,
          stance,
          note,
        })),
        assessment: chosen,
        summary,
        confirm,
        file,
        website,
        openedAt: opened.current,
      }),
    }).catch(() => null);
    const out = await res?.json().catch(() => null);
    if (res?.ok && out?.slug) {
      router.push(`/check/${out.slug}?new=1`);
      return;
    }
    setError(
      out?.message ??
        (res?.status === 503
          ? "Pulse Check isn't set up here yet."
          : "That didn't publish. Check your connection and try again."),
    );
    if (out?.field === "claim" || out?.field === "url" || out?.field === "file")
      setStep(0);
    else if (out?.field === "why" || out?.field === "scope") setStep(1);
    else if (
      out?.field === "sources" ||
      out?.field === "assessment" ||
      out?.field === "summary"
    )
      setStep(2);
    setBusy(false);
  }

  const claimOk = claim.trim().length >= CHECK_LIMITS.claim.min;
  const allConfirmed = Object.values(confirm).every(Boolean);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-3">
      <nav aria-label="Steps">
        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={`w-full border-t-4 pt-1.5 text-left text-[12px] font-semibold ${
                  i <= step
                    ? "border-[#e5484d] text-[#14161a]"
                    : "border-[#e7e3da] text-[#8a909a]"
                }`}
              >
                {i + 1}. {s}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 ? (
        <section
          className="grid grid-cols-[minmax(0,1fr)] gap-5"
          aria-labelledby="step-see"
        >
          <div>
            <h1
              id="step-see"
              className="font-heading text-[30px] leading-tight font-bold tracking-tight"
            >
              What did you see?
            </h1>
            <p className="mt-1 text-[15px] text-[#5c6370]">
              A post, a screenshot, a photo or a headline. Then write out the
              claim itself.
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <label
              htmlFor="check-link"
              className="flex items-center gap-2 text-[14px] font-semibold"
            >
              <Link2 className="h-4 w-4" aria-hidden /> Link to the post or
              article
              <span className="font-normal text-[#5c6370]">Optional</span>
            </label>
            <div className="flex gap-2">
              <input
                id="check-link"
                type="url"
                inputMode="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setLinkNote(null);
                  setLinkTitle(null);
                }}
                placeholder="https://www.facebook.com/…"
                data-testid="check-link"
                className={`${field} min-h-12 min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={readLink}
                disabled={!link.trim() || reading}
                data-testid="check-link-read"
                className="min-h-12 shrink-0 rounded-xl border border-[#14161a] bg-white px-4 text-[15px] font-semibold disabled:opacity-40"
              >
                {reading ? "Reading…" : "Read"}
              </button>
            </div>
            {linkNote ? (
              <p
                className="text-[13.5px] text-[#3f4550]"
                data-testid="check-link-note"
              >
                {linkNote}
              </p>
            ) : null}
            {linkTitle && claim.trim() !== linkTitle ? (
              <button
                type="button"
                onClick={() => {
                  setClaim(linkTitle);
                  setUsedHeadline(true);
                }}
                className="justify-self-start text-[14px] font-semibold text-[#2a78d6] underline underline-offset-2"
              >
                Use the headline as the claim
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <ImagePlus className="h-4 w-4" aria-hidden /> Screenshot or photo
              <span className="font-normal text-[#5c6370]">Optional</span>
            </p>
            {file ? (
              <div
                className="flex items-center gap-3 rounded-2xl border border-[#e7e3da] bg-white p-3"
                data-testid="check-file-preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the person's own picture, never uploaded until they publish */}
                <img
                  src={file}
                  alt="Your screenshot"
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <p className="flex-1 text-[13px] text-[#3f4550]">
                  Kept private: only you and moderators can see it. It is never
                  shown on the public page or in link previews.
                </p>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remove the picture"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d9d4c8]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <label className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[#d9d4c8] bg-white px-4 text-[15px] font-semibold text-[#3f4550] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#14161a]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={pick}
                  className="sr-only"
                  data-testid="check-file"
                />
                Add a screenshot or take a photo
              </label>
            )}
            {fileError ? (
              <p
                role="alert"
                className="text-[14px] font-medium text-[#b42318]"
              >
                {fileError}
              </p>
            ) : null}
            <p className="text-[12.5px] text-[#5c6370]">
              Screenshots can be cropped or edited, so a screenshot alone is
              never evidence. People&apos;s Pulse can&apos;t read the text in a
              picture — write the claim out below.
            </p>
          </div>

          <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[14px] font-semibold">
            What does it claim?
            <span className="font-normal text-[#5c6370]">
              Exactly as it was said — the claim only, not what you think of it.
            </span>
            <textarea
              value={claim}
              onChange={(e) => {
                setClaim(e.target.value);
                setUsedHeadline(false);
              }}
              rows={3}
              maxLength={CHECK_LIMITS.claim.max}
              placeholder="Kelowna General Hospital is operating at 147% capacity."
              data-testid="check-claim-input"
              className={`${field} resize-none py-3 font-normal`}
            />
          </label>

          <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[14px] font-semibold">
            Where did you see it?
            <select
              value={seenOn}
              onChange={(e) => setSeenOn(e.target.value as SeenOn)}
              data-testid="check-seen-on"
              className={`${field} min-h-12 font-normal`}
            >
              {(Object.entries(SEEN_ON) as [SeenOn, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!claimOk}
            onClick={() => setStep(1)}
            className={primary}
            data-testid="check-next-1"
          >
            {claimOk ? "Next" : "Write out the claim first"}
          </button>
        </section>
      ) : null}

      {step === 1 ? (
        <section
          className="grid grid-cols-[minmax(0,1fr)] gap-5"
          aria-labelledby="step-why"
        >
          <div>
            <h1
              id="step-why"
              className="font-heading text-[30px] leading-tight font-bold tracking-tight"
            >
              Why are you asking?
            </h1>
            <p className="mt-1 text-[15px] text-[#5c6370]">
              Your concern, what you noticed, what you want to know. Shown on
              the check as your words, apart from the claim.
            </p>
          </div>
          <blockquote className="rounded-2xl bg-[#f3f1ec] p-4 text-[16px] leading-relaxed">
            “{claim.trim()}”
          </blockquote>
          <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[14px] font-semibold">
            Why are you asking?
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={4}
              maxLength={CHECK_LIMITS.why}
              placeholder="I saw this on Facebook. Is the hospital really operating at 147% capacity?"
              data-testid="check-why-input"
              className={`${field} resize-none py-3 font-normal`}
            />
            <span className="text-[12.5px] font-normal text-[#5c6370]">
              No names, health details or anything private.
            </span>
          </label>
          <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <legend className="mb-1 text-[14px] font-semibold">
              Where is the claim about?
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["canada", "All of Canada"],
                  ["province", "A province"],
                  ["city", "A town or city"],
                ] as const
              ).map(([k, label]) => (
                <label
                  key={k}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 px-4 text-[14px] font-semibold ${scopeKind === k ? "border-[#14161a] bg-[#14161a] text-white" : "border-[#e7e3da] bg-white"}`}
                >
                  <input
                    type="radio"
                    name="scope"
                    className="sr-only"
                    checked={scopeKind === k}
                    onChange={() => setScopeKind(k)}
                    data-testid={`check-scope-${k}`}
                  />
                  {label}
                </label>
              ))}
            </div>
            {scopeKind !== "canada" ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                <select
                  aria-label="Province or territory"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className={`${field} min-h-12`}
                >
                  {PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {scopeKind === "city" ? (
                  <input
                    aria-label="Town or city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Kelowna"
                    data-testid="check-city"
                    className={`${field} min-h-12`}
                  />
                ) : null}
              </div>
            ) : null}
            <p className="text-[12.5px] text-[#5c6370]">
              Where the claim is about — never where you are.
            </p>
          </fieldset>
          {error ? (
            <p role="alert" className="text-[14px] font-medium text-[#b42318]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={investigate}
            disabled={busy || (scopeKind === "city" && city.trim().length < 2)}
            className={primary}
            data-testid="check-next-2"
          >
            {busy ? "Reading the claim…" : "Investigate"}
          </button>
        </section>
      ) : null}

      {step === 2 && analysis ? (
        <section
          className="grid grid-cols-[minmax(0,1fr)] gap-6"
          aria-labelledby="step-investigate"
        >
          <div>
            <h1
              id="step-investigate"
              className="font-heading text-[30px] leading-tight font-bold tracking-tight"
            >
              What does the evidence say?
            </h1>
            <p className="mt-1 text-[15px] text-[#5c6370]">
              People&apos;s Pulse can&apos;t search the web for you. Look in the
              places below, then paste what you find: we open each page and show
              exactly what it says.
            </p>
          </div>

          {analysis.duplicates.length ? (
            <div
              className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[14.5px] text-amber-950"
              data-testid="check-duplicates"
            >
              <p className="font-semibold">
                Someone may have checked this already
              </p>
              <ul className="mt-2 grid gap-1.5">
                {analysis.duplicates.map((d) => (
                  <li key={d.slug}>
                    <Link
                      href={`/check/${d.slug}`}
                      className="underline underline-offset-2"
                      target="_blank"
                    >
                      “{d.claim}”
                    </Link>{" "}
                    — {ASSESSMENT_INFO[d.assessment].label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px]">
                You can add evidence there in the conversation, or carry on with
                a new check.
              </p>
            </div>
          ) : null}

          <div
            className="rounded-2xl border border-[#e7e3da] bg-white p-4"
            data-testid="check-analysis"
          >
            <p className="text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
              The claim states
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ...analysis.parts.figures.map((x) => ["Figure", x]),
                ...analysis.parts.dates.map((x) => ["Date", x]),
                ...analysis.parts.places.map((x) => ["Place", x]),
                ...analysis.parts.organisations.map((x) => ["Who", x]),
                ...analysis.parts.terms.map((x) => ["Term", x]),
              ].map(([k, v]) => (
                <span
                  key={`${k}${v}`}
                  className="rounded-full bg-[#f3f1ec] px-3 py-1.5 text-[13.5px]"
                >
                  <span className="text-[#5c6370]">{k}:</span>{" "}
                  <strong>{v}</strong>
                </span>
              ))}
            </div>
            <p className="mt-4 text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
              Questions to answer
            </p>
            <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-[14.5px] leading-relaxed">
              {analysis.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-[#8a909a]">
              Read by rules from the claim&apos;s own words, not AI.
            </p>
          </div>

          {analysis.parts.namesPerson ? (
            <p
              className="rounded-2xl border border-[#b42318] bg-[#fff5f4] p-4 text-[14.5px] text-[#7a1a11]"
              data-testid="check-person-warning"
            >
              This seems to name a person. Pulse Check is for public claims
              about organisations, public figures and public statements — not
              for accusing private people. If it&apos;s about a private person,
              please don&apos;t publish it.
            </p>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <p className="text-[15px] font-semibold">Where to look</p>
            <ul
              className="grid grid-cols-[minmax(0,1fr)] gap-2"
              data-testid="check-leads"
            >
              {analysis.leads.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-[#e7e3da] bg-white px-3.5 py-3"
                  >
                    <span className="text-[15px] font-semibold">
                      {l.name} ↗
                    </span>
                    <span className="block text-[13px] text-[#5c6370]">
                      {l.why}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-[#5c6370]">
              These open a search of that site. They are places to look, not
              evidence.
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <p className="text-[15px] font-semibold">
              Sources you found · {sources.length}/{CHECK_LIMITS.sources}
            </p>
            {sources.map((s, i) => (
              <div
                key={s.sealed}
                className="flex items-start gap-3 rounded-xl border border-[#e7e3da] bg-white p-3"
                data-testid="check-picked"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {s.source.title ?? s.source.site}
                  </p>
                  <p className="text-[13px] text-[#5c6370]">
                    {s.source.site} · {STANCE_LABEL[s.stance]}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remove this source"
                  onClick={() =>
                    setSources((list) => list.filter((_, j) => j !== i))
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d9d4c8]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
            {sources.length < CHECK_LIMITS.sources ? (
              <SourceAdder
                claim={claim}
                onAdd={(p) =>
                  setSources((list) => [
                    ...list.filter((x) => x.source.url !== p.source.url),
                    p,
                  ])
                }
              />
            ) : null}
          </div>

          <fieldset
            className="grid grid-cols-[minmax(0,1fr)] gap-2"
            data-testid="check-assess"
          >
            <legend className="mb-1 text-[15px] font-semibold">
              So, what does the evidence support?
            </legend>
            <p className="text-[13px] text-[#5c6370]">
              Suggested from your sources:{" "}
              <strong>{ASSESSMENT_INFO[suggested].label}</strong>. Each verdict
              needs a source of its own kind.
            </p>
            {ASSESSMENTS.map((a) => {
              const why = assessmentProblem(a, sources, sum);
              return (
                <label
                  key={a}
                  className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 bg-white px-3 py-2.5 ${chosen === a ? "border-[#14161a]" : "border-[#e7e3da]"} ${why ? "cursor-not-allowed opacity-55" : ""}`}
                >
                  <input
                    type="radio"
                    name="assessment"
                    value={a}
                    checked={chosen === a}
                    disabled={!!why}
                    onChange={() => setAssessment(a)}
                    className="mt-1 h-4 w-4 accent-[#14161a]"
                    data-testid={`check-assess-${a}`}
                  />
                  <span>
                    <span
                      className="block text-[15px] font-bold"
                      style={{ color: ASSESSMENT_INFO[a].color }}
                    >
                      {ASSESSMENT_INFO[a].label}
                    </span>
                    <span className="block text-[13px] text-[#5c6370]">
                      {why ?? ASSESSMENT_INFO[a].line}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[14px] font-semibold">
            In your words, what do the sources show?
            <span className="font-normal text-[#5c6370]">
              Optional{chosen === "outdated" ? " — needed for Outdated" : ""}.
              Shown as your words.
            </span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              maxLength={CHECK_LIMITS.summary}
              data-testid="check-summary"
              className={`${field} resize-none py-3 font-normal`}
            />
          </label>

          {error ? (
            <p role="alert" className="text-[14px] font-medium text-[#b42318]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep(3);
            }}
            disabled={!!assessmentProblem(chosen, sources, sum)}
            className={primary}
            data-testid="check-next-3"
          >
            Review and publish
          </button>
        </section>
      ) : null}

      {step === 3 && analysis ? (
        <form
          className="grid grid-cols-[minmax(0,1fr)] gap-6"
          onSubmit={publish}
          aria-labelledby="step-publish"
        >
          <div>
            <h1
              id="step-publish"
              className="font-heading text-[30px] leading-tight font-bold tracking-tight"
            >
              Publish your Pulse Check
            </h1>
            <p className="mt-1 text-[15px] text-[#5c6370]">
              It gets a permanent public page anyone can read without signing
              up. You can add corrections later from this browser.
            </p>
          </div>

          <div
            className="rounded-2xl border border-[#e7e3da] bg-white p-4 text-[14.5px]"
            data-testid="check-review"
          >
            <p className="text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
              The claim
            </p>
            <p className="mt-1 text-[16px] font-semibold">“{claim.trim()}”</p>
            {why.trim() ? (
              <>
                <p className="mt-3 text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
                  Why you asked
                </p>
                <p className="mt-1">{why.trim()}</p>
              </>
            ) : null}
            <p className="mt-3 text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
              Evidence
            </p>
            <p className="mt-1">
              <strong style={{ color: ASSESSMENT_INFO[chosen].color }}>
                {ASSESSMENT_INFO[chosen].label}
              </strong>{" "}
              ·{" "}
              {sources.length === 1 ? "1 source" : `${sources.length} sources`}
            </p>
            {file ? (
              <p className="mt-3 text-[13px] text-[#5c6370]">
                Your screenshot stays private.
              </p>
            ) : null}
          </div>

          <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <legend className="mb-1 text-[15px] font-semibold">
              What should people be asked?
            </legend>
            {ASK_TYPES.map((t) => (
              <label
                key={t}
                className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 bg-white px-3 py-2.5 ${ask === t ? "border-[#14161a]" : "border-[#e7e3da]"}`}
              >
                <input
                  type="radio"
                  name="ask"
                  value={t}
                  checked={ask === t}
                  onChange={() => setAsk(t)}
                  className="mt-1 h-4 w-4 accent-[#14161a]"
                  data-testid={`check-ask-${t}`}
                />
                <span>
                  <span className="block text-[15px] font-bold">
                    {ASK_INFO[t].name} — {ASK_INFO[t].line}
                  </span>
                  <span className="block text-[13px] text-[#5c6370]">
                    {t === "opinion"
                      ? "You choose the question."
                      : `“${ASK_INFO[t].question}” ${ASK_INFO[t].options.join(" · ")}`}
                  </span>
                </span>
              </label>
            ))}
            {ask === "opinion" ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-xl bg-[#f3f1ec] p-3">
                <input
                  aria-label="Poll question"
                  value={question}
                  maxLength={CHECK_LIMITS.question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className={`${field} min-h-12`}
                />
                <input
                  aria-label="Answers, separated by commas"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  className={`${field} min-h-12`}
                />
                <p className="text-[12.5px] text-[#5c6370]">
                  Answers separated by commas. “Unsure” is added for you.
                </p>
              </div>
            ) : null}
            <p className="text-[12.5px] text-[#5c6370]">
              Votes show opinion. They never change the evidence assessment.
            </p>
          </fieldset>

          <fieldset
            className="grid grid-cols-[minmax(0,1fr)] gap-2"
            data-testid="check-confirm"
          >
            <legend className="mb-1 text-[15px] font-semibold">
              Before you publish
            </legend>
            {(Object.entries(CONFIRM) as [ConfirmKey, string][]).map(
              ([k, text]) => (
                <label
                  key={k}
                  className="flex min-h-11 cursor-pointer items-start gap-3 text-[14.5px] leading-snug"
                >
                  <input
                    type="checkbox"
                    checked={confirm[k]}
                    onChange={(e) =>
                      setConfirm((c) => ({ ...c, [k]: e.target.checked }))
                    }
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#14161a]"
                    data-testid={`check-confirm-${k}`}
                  />
                  {text}
                </label>
              ),
            )}
          </fieldset>

          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute -left-[9999px] h-px w-px opacity-0"
          />
          {error ? (
            <p
              role="alert"
              className="text-[14px] font-medium text-[#b42318]"
              data-testid="check-error"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !allConfirmed}
            className={primary}
            data-testid="check-publish"
          >
            {busy
              ? "Publishing…"
              : allConfirmed
                ? "Publish Pulse Check"
                : "Tick each box to publish"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
