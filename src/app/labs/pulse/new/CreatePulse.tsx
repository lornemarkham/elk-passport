"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  DECIDE_OPTIONS,
  MAX_OPTIONS,
  PROVINCES,
  RANK_MIN,
  SETTLE_MAX,
} from "@/lib/pulse/model";
import type { Preset } from "@/lib/pulse/templates";
import { SourceCheck, type ClaimNotes } from "./SourceCheck";

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
 * everything else is behind "Add details". The preset (a kind or a template)
 * only changes the starting point and the answers section; it is one form.
 */
export function CreatePulse({ preset }: { preset: Preset }) {
  const router = useRouter();
  const ids = useId();
  // When the form appeared; a submission sooner than a person types is refused.
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
  }, []);
  const mode = preset.kind;
  const firstTopic = preset.topics[0] ?? null;
  const [question, setQuestion] = useState(
    mode === "normal" && firstTopic ? firstTopic.question : preset.prefix,
  );
  const [kind, setKind] = useState<"yesno" | "custom">(
    preset.options || mode !== "pulse" ? "custom" : "yesno",
  );
  const [answers, setAnswers] = useState<string[]>(
    preset.options
      ? [...preset.options]
      : Array.from(
          { length: mode === "rank" || mode === "normal" ? RANK_MIN : 2 },
          () => "",
        ),
  );
  const [topic, setTopic] = useState<string>(firstTopic?.id ?? "own");
  const [groupLabel, setGroupLabel] = useState("");
  const [groupOptions, setGroupOptions] = useState(["", ""]);
  const [reasons, setReasons] = useState(preset.reasons);
  const [unlisted, setUnlisted] = useState(preset.unlisted);
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"canada" | "province" | "city">(
    preset.scope,
  );
  const [province, setProvince] = useState("BC");
  const [city, setCity] = useState("");
  const [ends, setEnds] = useState<Ends>(preset.ends);
  const [claimText, setClaimText] = useState("");
  const [claimPercent, setClaimPercent] = useState("");
  const [claimOption, setClaimOption] = useState("o1");
  const [claimSource, setClaimSource] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [claimNotes, setClaimNotes] = useState<ClaimNotes>({
    published: "",
    measures: "",
    method: "",
  });
  const [sourceUrl, setSourceUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<{
    field?: string;
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const chosenTopic = preset.topics.find((t) => t.id === topic) ?? null;
  const options =
    mode === "decide"
      ? [...DECIDE_OPTIONS]
      : mode === "normal" && chosenTopic
        ? [...chosenTopic.ranges]
        : kind === "yesno"
          ? ["Yes", "No"]
          : answers;
  const maxAnswers = mode === "settle" ? SETTLE_MAX : MAX_OPTIONS;
  const group =
    mode !== "normal"
      ? null
      : chosenTopic
        ? chosenTopic.group
        : groupLabel.trim()
          ? { label: groupLabel, options: groupOptions }
          : null;

  function pickTopic(id: string) {
    const was = preset.topics.find((t) => t.id === topic);
    const next = preset.topics.find((t) => t.id === id);
    setTopic(id);
    // Swap the question only if the person hadn't rewritten the last topic's.
    if (!question.trim() || question === was?.question)
      setQuestion(next?.question ?? "");
  }

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
          kind: mode,
          template:
            preset.template ??
            (mode === "normal" && chosenTopic
              ? `topic-${chosenTopic.id}`
              : null),
          reasons,
          unlisted,
          group,
          unit: chosenTopic?.unit ?? null,
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
            ...claimNotes,
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
          {preset.ask}
        </label>
        <textarea
          id={`${ids}-q`}
          name="question"
          required
          rows={2}
          maxLength={200}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={preset.placeholder}
          className={`${input} mt-2 resize-none text-[18px] leading-snug`}
          aria-invalid={error?.field === "question"}
        />
        {err("question")}
      </div>

      {mode === "normal" ? (
        <NormalAnswers
          topics={preset.topics}
          topic={topic}
          onTopic={pickTopic}
          answers={answers}
          setAnswers={setAnswers}
          groupLabel={groupLabel}
          setGroupLabel={setGroupLabel}
          groupOptions={groupOptions}
          setGroupOptions={setGroupOptions}
          error={err("options") ?? err("group")}
        />
      ) : mode === "decide" ? (
        <div data-testid="pulse-decide-answers">
          <p className={label}>Answers</p>
          <p className="mt-2 flex flex-wrap gap-2">
            {DECIDE_OPTIONS.map((o) => (
              <span
                key={o}
                className="rounded-full border border-[#d9d4c8] bg-white px-4 py-2 text-[15px] font-semibold"
              >
                {o}
              </span>
            ))}
          </p>
          <p className={hint}>
            People can add a short reason. You&apos;ll see the reasons once five
            people have answered.
          </p>
        </div>
      ) : (
        <fieldset>
          <legend className={label}>
            {mode === "rank"
              ? "Things to rank"
              : mode === "settle"
                ? "The sides"
                : "Answers"}
          </legend>
          {mode === "rank" ? (
            <p className={hint}>Three to six. People put them in order.</p>
          ) : mode === "settle" ? (
            <p className={hint}>Two to four. Everyone picks one.</p>
          ) : null}
          <div
            className={`mt-2 inline-flex rounded-full border border-[#d9d4c8] bg-white p-1 ${mode === "pulse" ? "" : "hidden"}`}
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
                    aria-label={
                      mode === "rank"
                        ? `Item ${i + 1}`
                        : mode === "settle"
                          ? `Side ${i + 1}`
                          : `Answer ${i + 1}`
                    }
                    value={a}
                    maxLength={60}
                    onChange={(e) =>
                      setAnswers(
                        answers.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                    placeholder={
                      mode === "settle"
                        ? (["Yes, it does", "No, never"][i] ?? `Side ${i + 1}`)
                        : mode === "rank"
                          ? `Item ${i + 1}`
                          : `Answer ${i + 1}`
                    }
                    className={input}
                  />
                  {answers.length > (mode === "rank" ? RANK_MIN : 2) ? (
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
              {answers.length < maxAnswers ? (
                <button
                  type="button"
                  onClick={() => setAnswers([...answers, ""])}
                  className="min-h-11 justify-self-start rounded-full px-1 text-[14px] font-semibold text-[#2a78d6]"
                >
                  {mode === "rank"
                    ? "+ Add one"
                    : mode === "settle"
                      ? "+ Add a side"
                      : "+ Add an answer"}
                </button>
              ) : null}
            </div>
          ) : null}
          {err("options")}
        </fieldset>
      )}

      <fieldset className="grid gap-2">
        <legend className={label}>Who&apos;s it for?</legend>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-[#e7e3da] bg-white p-3 text-[14px]">
          <input
            type="checkbox"
            checked={unlisted}
            onChange={(e) => setUnlisted(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[#14161a]"
            data-testid="pulse-unlisted"
          />
          <span>
            <span className="font-semibold">
              Only people I send the link to
            </span>
            <span className="block text-[#5c6370]">
              Not listed on People&apos;s Pulse. Anyone with the link can still
              answer.
            </span>
          </span>
        </label>
        {mode === "pulse" || mode === "settle" ? (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-[#e7e3da] bg-white p-3 text-[14px]">
            <input
              type="checkbox"
              checked={reasons}
              onChange={(e) => setReasons(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[#14161a]"
              data-testid="pulse-reasons-toggle"
            />
            <span>
              <span className="font-semibold">Let people say why</span>
              <span className="block text-[#5c6370]">
                An optional sentence with their answer, shown anonymously.
              </span>
            </span>
          </label>
        ) : null}
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

      <details
        className="group rounded-2xl border border-[#e7e3da] bg-white p-4 open:pb-5"
        open={preset.claim || undefined}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
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
            <SourceCheck
              claimText={claimText}
              percent={claimPercent}
              url={claimUrl}
              notes={claimNotes}
              onNotes={setClaimNotes}
              onSite={setClaimSource}
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

/**
 * Is This Normal?'s answers: a topic's ranges as they are (so everyone answers
 * the same buckets), or your own ranges in order, plus an optional category.
 */
function NormalAnswers({
  topics,
  topic,
  onTopic,
  answers,
  setAnswers,
  groupLabel,
  setGroupLabel,
  groupOptions,
  setGroupOptions,
  error,
}: {
  topics: Preset["topics"];
  topic: string;
  onTopic: (id: string) => void;
  answers: string[];
  setAnswers: (a: string[]) => void;
  groupLabel: string;
  setGroupLabel: (s: string) => void;
  groupOptions: string[];
  setGroupOptions: (a: string[]) => void;
  error: React.ReactNode;
}) {
  const chosen = topics.find((t) => t.id === topic) ?? null;
  return (
    <fieldset data-testid="pulse-normal-answers">
      <legend className={label}>What to compare</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="group">
        {[
          ...topics.map((t) => [t.id, t.name] as const),
          ["own", "Make your own"] as const,
        ].map(([id, name]) => (
          <button
            key={id}
            type="button"
            aria-pressed={topic === id}
            onClick={() => onTopic(id)}
            data-testid={`pulse-topic-${id}`}
            className={`min-h-11 rounded-full border px-4 text-[14px] font-medium ${
              topic === id
                ? "border-[#14161a] bg-[#14161a] text-white"
                : "border-[#d9d4c8] bg-white text-[#3f4550]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      {chosen ? (
        <div className="mt-3 rounded-xl bg-[#f3f1ec] p-3 text-[14px]">
          <p className="font-semibold">
            People pick a range{chosen.unit ? ` (${chosen.unit})` : ""}:
          </p>
          <p className="mt-1 text-[#3f4550]">{chosen.ranges.join(" · ")}</p>
          {chosen.group ? (
            <p className="mt-2 text-[#3f4550]">
              Optional comparison: <strong>{chosen.group.label}</strong> (
              {chosen.group.options.join(", ")})
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          <p className={hint}>
            Three to six ranges, lowest first. Ranges, not exact numbers, keep
            answers private.
          </p>
          {answers.map((a, i) => (
            <input
              key={i}
              aria-label={`Range ${i + 1}`}
              value={a}
              maxLength={60}
              onChange={(e) =>
                setAnswers(
                  answers.map((x, j) => (j === i ? e.target.value : x)),
                )
              }
              placeholder={
                ["Under $50", "$50–$99", "$100 or more"][i] ?? `Range ${i + 1}`
              }
              className={input}
            />
          ))}
          {answers.length < MAX_OPTIONS ? (
            <button
              type="button"
              onClick={() => setAnswers([...answers, ""])}
              className="min-h-11 justify-self-start rounded-full px-1 text-[14px] font-semibold text-[#2a78d6]"
            >
              + Add a range
            </button>
          ) : null}
          <label className={`${label} mt-2`}>
            Compare by{" "}
            <span className="font-normal text-[#5c6370]">
              (optional, e.g. household size)
            </span>
            <input
              value={groupLabel}
              maxLength={60}
              onChange={(e) => setGroupLabel(e.target.value)}
              className={`${input} mt-2`}
              placeholder="Household size"
            />
          </label>
          {groupLabel.trim()
            ? groupOptions.map((g, i) => (
                <input
                  key={i}
                  aria-label={`Group ${i + 1}`}
                  value={g}
                  maxLength={60}
                  onChange={(e) =>
                    setGroupOptions(
                      groupOptions.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    )
                  }
                  placeholder={["1 person", "2 or more"][i] ?? `Group ${i + 1}`}
                  className={input}
                />
              ))
            : null}
          {groupLabel.trim() && groupOptions.length < MAX_OPTIONS ? (
            <button
              type="button"
              onClick={() => setGroupOptions([...groupOptions, ""])}
              className="min-h-11 justify-self-start rounded-full px-1 text-[14px] font-semibold text-[#2a78d6]"
            >
              + Add a group
            </button>
          ) : null}
        </div>
      )}
      {error}
    </fieldset>
  );
}
