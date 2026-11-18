"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHECK_LIMITS,
  POST_INFO,
  POST_TYPES,
  type Post,
  type PostType,
} from "@/lib/pulse/check";
import { REPORT_REASONS, type ReportReason } from "@/lib/pulse/model";
import { fmtDay } from "./SourceAdder";

/**
 * **Talk about the claim, with each kind of thing in its own place**:
 * personal experiences, questions, opinions, and sources visitors suggest.
 * None of it is evidence until the asker reads a source in as a correction.
 */
export function Discussion({
  pulseId,
  token,
  initial,
}: {
  pulseId: string;
  token: string;
  initial: readonly Post[];
}) {
  const [posts, setPosts] = useState<readonly Post[]>(initial);
  const [type, setType] = useState<PostType>("experience");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pulse/check/${pulseId}/posts`, {
      cache: "no-store",
    }).catch(() => null);
    if (res?.ok) setPosts((await res.json()).posts);
  }, [pulseId]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pulse/check/${pulseId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        body,
        url: type === "source" ? url : undefined,
        token,
      }),
    }).catch(() => null);
    const out = await res?.json().catch(() => null);
    if (res?.ok && out?.post) {
      setPosts((p) => [...p, out.post]);
      setBody("");
      setUrl("");
      setSent(true);
    } else setError(out?.message ?? "That didn't post. Try again.");
    setBusy(false);
  }

  return (
    <section
      aria-labelledby="check-discussion"
      className="grid grid-cols-[minmax(0,1fr)] gap-5"
      data-testid="check-discussion"
    >
      <div>
        <h2
          id="check-discussion"
          className="text-[22px] font-bold tracking-tight"
        >
          What people say
        </h2>
        <p className="mt-1 text-[14px] text-[#5c6370]">
          Experiences and opinions are not evidence, and nobody here has checked
          them. Never post anyone&apos;s name, health details or private
          messages.
        </p>
      </div>

      {POST_TYPES.map((t) => {
        const list = posts.filter((p) => p.type === t);
        return (
          <div key={t} data-testid={`check-posts-${t}`}>
            <h3 className="text-[12px] font-bold tracking-[0.14em] text-[#5c6370] uppercase">
              {POST_INFO[t].section} · {list.length}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[#8a909a]">
              {POST_INFO[t].note}
            </p>
            {list.length ? (
              <ul className="mt-2 grid gap-2">
                {list.map((p) => (
                  <PostItem key={p.id} p={p} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-[#8a909a]">Nothing yet.</p>
            )}
          </div>
        );
      })}

      <form
        onSubmit={send}
        className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-[#e7e3da] bg-white p-4"
        data-testid="check-post-form"
      >
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">
            Add to the conversation
          </legend>
          <div className="flex flex-wrap gap-2">
            {POST_TYPES.map((t) => (
              <label
                key={t}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 px-4 text-[14px] font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#14161a]/40 ${type === t ? "border-[#14161a] bg-[#14161a] text-white" : "border-[#e7e3da] bg-white"}`}
              >
                <input
                  type="radio"
                  name="post-type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                  data-testid={`check-post-type-${t}`}
                />
                {POST_INFO[t].label}
              </label>
            ))}
          </div>
        </fieldset>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSent(false);
          }}
          rows={3}
          maxLength={CHECK_LIMITS.post}
          aria-label="Your post"
          data-testid="check-post-body"
          placeholder={
            type === "experience"
              ? "What happened to you? Describe it in general terms."
              : type === "question"
                ? "What would you want to know before believing it?"
                : type === "source"
                  ? "What does this source show?"
                  : "What do you think, and why?"
          }
          className="resize-none rounded-xl border border-[#d9d4c8] px-3.5 py-3 text-[16px]"
        />
        {type === "source" ? (
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            aria-label="Link to the source"
            data-testid="check-post-url"
            className="min-h-12 rounded-xl border border-[#d9d4c8] px-3 text-[16px]"
          />
        ) : null}
        <p className="text-[12.5px] text-[#5c6370]">
          Posted without your name. Reported posts are hidden until a moderator
          looks.
        </p>
        {error ? (
          <p role="alert" className="text-[14px] font-medium text-[#b42318]">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p role="status" className="text-[14px] font-medium">
            Posted. Thanks for adding to it.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || body.trim().length < CHECK_LIMITS.postMin}
          data-testid="check-post-send"
          className="min-h-12 rounded-full bg-[#14161a] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </form>
    </section>
  );
}

function PostItem({ p }: { p: Post }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "done">("idle");
  async function report(reason: ReportReason) {
    const res = await fetch(`/api/pulse/check/posts/${p.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    if (res?.ok) setState("done");
  }
  return (
    <li
      className="rounded-xl border border-[#e7e3da] bg-white px-3.5 py-3"
      data-testid="check-post"
    >
      <p className="text-[15px] leading-relaxed whitespace-pre-line">
        {p.body}
      </p>
      {p.url ? (
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="mt-1 block truncate text-[13.5px] font-medium text-[#2a78d6] underline underline-offset-2"
        >
          {p.url}
        </a>
      ) : null}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-[#8a909a]">
        <span>{fmtDay(p.at)}</span>
        {p.mine ? (
          <span className="font-semibold text-[#14161a]">Yours</span>
        ) : null}
        {state === "done" ? (
          <span role="status">Reported — thanks.</span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="min-h-8 underline underline-offset-2"
          >
            Report
          </button>
        )}
      </p>
      {open && state !== "done" ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(
            ([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => report(k)}
                className="min-h-9 rounded-full border border-[#d9d4c8] px-3 text-[12.5px] font-medium"
              >
                {label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </li>
  );
}
