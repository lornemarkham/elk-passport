"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MAX_OPTIONS, PROVINCES } from "@/lib/pulse/model";

type Ends = "never" | "1d" | "1w" | "1m";
const ENDS: { value: Ends; label: string; ms: number }[] = [
  { value: "never", label: "No end date", ms: 0 },
  { value: "1d", label: "In a day", ms: 86_400_000 },
  { value: "1w", label: "In a week", ms: 7 * 86_400_000 },
  { value: "1m", label: "In a month", ms: 30 * 86_400_000 },
];

const input =
  "w-full rounded-xl border border-[#d9d4c8] bg-white px-3.5 py-3 text-[16px] text-[#14161a] placeholder:text-[#8a909a] focus:border-[#14161a] focus:ring-2 focus:ring-[#14161a]/15 focus:outline-none";
const label = "block text-[14px] font-semibold text-[#14161a]";
const hint = "mt-1 text-[13px] text-[#5c6370]";

/**
 * **Ask a question in under 30 seconds.** A question and Yes/No is enough;
 * everything else is behind "Add details".
 */
export function CreatePulse() {
  const router = useRouter();
  const ids = useId();
  // When the form appeared; a submission sooner than a person types is refused.
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
  }, []);
  const [question, setQuestion] = useState("");
  const [kind, setKind] = useState<"yesno" | "custom">("yesno");
  const [answers, setAnswers] = useState(["", ""]);
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"canada" | "province" | "city">("canada");
  const [province, setProvince] = useState("BC");
  const [city, setCity] = useState("");
  const [ends, setEnds] = useState<Ends>("never");
  const [claimText, setClaimText] = useState("");
  const [claimPercent, setClaimPercent] = useState("");
  const [claimOption, setClaimOption] = useState("o1");
  const [claimSource, setClaimSource] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<{
    field?: string;
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const options = kind === "yesno" ? ["Yes", "No"] : answers;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const end = ENDS.find((x) => x.value === ends)!;
    try {
      const res = await fetch("/api/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          options,
          description,
          scope:
            scope === "canada"
              ? { kind: "canada" }
              : scope === "province"
                ? { kind: "province", province }
                : { kind: "city", province, city },
          expiresAt: end.ms
            ? new Date(Date.now() + end.ms).toISOString()
            : null,
          claim: {
            text: claimText,
            percent: claimPercent,
            optionId: claimOption,
            source: claimSource,
            url: claimUrl,
          },
          sourceUrl,
          website,
          openedAt: opened.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.id) {
        router.push(`/labs/pulse/${body.id}?new=1`);
        return;
      }
      setError({
        field: body.field,
        message:
          body.message ??
          (res.status === 503
            ? "People's Pulse isn't set up here yet."
            : res.status === 429
              ? (body.because ?? "Too many just now — try again shortly.")
              : "That didn't go through. Try again."),
      });
    } catch {
      setError({
        message: "No connection. Try again when you're back online.",
      });
    }
    setBusy(false);
  }

  const err = (field: string) =>
    error?.field === field ? (
      <p role="alert" className="mt-2 text-[14px] font-medium text-[#b42318]">
        {error.message}
      </p>
    ) : null;

  return (
    <form
      onSubmit={submit}
      className="grid gap-6"
      data-testid="pulse-create"
      noValidate
    >
      <div>
        <label htmlFor={`${ids}-q`} className={label}>
          Your question
        </label>
        <textarea
          id={`${ids}-q`}
          name="question"
          required
          rows={2}
          maxLength={200}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Should Vernon build a second sheet of ice?"
          className={`${input} mt-2 resize-none text-[18px] leading-snug`}
          aria-invalid={error?.field === "question"}
        />
        {err("question")}
      </div>

      <fieldset>
        <legend className={label}>Answers</legend>
        <div
          className="mt-2 inline-flex rounded-full border border-[#d9d4c8] bg-white p-1"
          role="group"
        >
          {(
            [
              ["yesno", "Yes / No"],
              ["custom", "Your own answers"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={`min-h-10 rounded-full px-4 text-[14px] font-semibold transition ${
                kind === value ? "bg-[#14161a] text-white" : "text-[#3f4550]"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        {kind === "custom" ? (
          <div className="mt-3 grid gap-2">
            {answers.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Answer ${i + 1}`}
                  value={a}
                  maxLength={60}
                  onChange={(e) =>
                    setAnswers(
                      answers.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                  placeholder={`Answer ${i + 1}`}
                  className={input}
                />
                {answers.length > 2 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAnswers(answers.filter((_, j) => j !== i))
                    }
                    className="min-h-11 min-w-11 rounded-xl border border-[#d9d4c8] bg-white text-[18px] text-[#5c6370]"
                    aria-label={`Remove answer ${i + 1}`}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {answers.length < MAX_OPTIONS ? (
              <button
                type="button"
                onClick={() => setAnswers([...answers, ""])}
                className="min-h-11 justify-self-start rounded-full px-1 text-[14px] font-semibold text-[#2a78d6]"
              >
                + Add an answer
              </button>
            ) : null}
          </div>
        ) : null}
        {err("options")}
      </fieldset>

      <fieldset>
        <legend className={label}>Where is this about?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["canada", "All of Canada"],
              ["province", "A province"],
              ["city", "A city or town"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-medium ${
                scope === value
                  ? "border-[#14161a] bg-[#14161a] text-white"
                  : "border-[#d9d4c8] bg-white text-[#3f4550]"
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
                className="sr-only"
              />
              {text}
            </label>
          ))}
        </div>
        {scope !== "canada" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              aria-label="Province or territory"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className={input}
            >
              {PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            {scope === "city" ? (
              <input
                aria-label="City or town"
                value={city}
                maxLength={60}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City or town"
                className={input}
              />
            ) : null}
          </div>
        ) : null}
        {err("scope")}
      </fieldset>

      <details className="group rounded-2xl border border-[#e7e3da] bg-white p-4 open:pb-5">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
          Add details
          <span className="text-[13px] font-normal text-[#5c6370] group-open:hidden">
            Description, end date, a published claim
          </span>
        </summary>
        <div className="mt-4 grid gap-5">
          <div>
            <label htmlFor={`${ids}-d`} className={label}>
              Description{" "}
              <span className="font-normal text-[#5c6370]">(optional)</span>
            </label>
            <textarea
              id={`${ids}-d`}
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${input} mt-2`}
              placeholder="A sentence or two of fair context."
            />
            <p className={hint}>
              Keep it neutral. Misleading framing can be reported and removed.
            </p>
            {err("description")}
          </div>

          <div>
            <label htmlFor={`${ids}-e`} className={label}>
              Voting ends
            </label>
            <select
              id={`${ids}-e`}
              value={ends}
              onChange={(e) => setEnds(e.target.value as Ends)}
              className={`${input} mt-2`}
            >
              {ENDS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            {err("expiresAt")}
          </div>

          <fieldset className="grid gap-3">
            <legend className={label}>
              Compare with a published claim{" "}
              <span className="font-normal text-[#5c6370]">(optional)</span>
            </legend>
            <p className={hint}>
              Saw a statistic in an article or survey? Put it here and
              People&apos;s Pulse shows it beside your results. A published
              figure always needs who published it and a link.
            </p>
            <input
              aria-label="The claim"
              value={claimText}
              maxLength={240}
              onChange={(e) => setClaimText(e.target.value)}
              placeholder="An article reports that 65% support a second sheet of ice."
              className={input}
            />
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <input
                aria-label="Published percentage"
                inputMode="decimal"
                value={claimPercent}
                onChange={(e) =>
                  setClaimPercent(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="65 %"
                className={input}
              />
              <select
                aria-label="Which answer the percentage is for"
                value={claimOption}
                onChange={(e) => setClaimOption(e.target.value)}
                className={input}
              >
                {options.map((o, i) => (
                  <option key={i} value={`o${i + 1}`}>
                    said “{o || `Answer ${i + 1}`}”
                  </option>
                ))}
              </select>
            </div>
            <input
              aria-label="Who published it"
              value={claimSource}
              maxLength={120}
              onChange={(e) => setClaimSource(e.target.value)}
              placeholder="Who published it (e.g. Vernon Morning Star)"
              className={input}
            />
            <input
              aria-label="Link to the claim"
              type="url"
              inputMode="url"
              value={claimUrl}
              onChange={(e) => setClaimUrl(e.target.value)}
              placeholder="https://"
              className={input}
            />
            {err("claim")}
          </fieldset>

          <div>
            <label htmlFor={`${ids}-s`} className={label}>
              Source link{" "}
              <span className="font-normal text-[#5c6370]">(optional)</span>
            </label>
            <input
              id={`${ids}-s`}
              type="url"
              inputMode="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https:// — where people can read more"
              className={`${input} mt-2`}
            />
            {err("sourceUrl")}
          </div>
        </div>
      </details>

      {/* For form-filling scripts only: people never see or fill this. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            name="website"
          />
        </label>
      </div>

      {error && !error.field ? (
        <p role="alert" className="text-[14px] font-medium text-[#b42318]">
          {error.message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={busy}
          data-testid="pulse-create-submit"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#14161a] px-6 text-[16px] font-semibold text-white transition hover:bg-black disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Creating…" : "Create and share"}
        </button>
        <p className={`${hint} mt-3`}>
          Ask about ideas, not private people. No personal details. Anyone with
          the link can vote, and Pulses can be reported.
        </p>
      </div>
    </form>
  );
}
