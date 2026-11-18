"use client";

import { useState } from "react";
import { Copy, Mail, MessageSquare, Share2, Check } from "lucide-react";

/**
 * Count a share, results card or opened link for aggregate usage: a number
 * per day, nothing about who. Fire-and-forget; it never holds up the person.
 */
export function countEvent(
  pulseId: string,
  event: "share" | "card" | "link-open" | "circle-ask",
) {
  try {
    void fetch(`/api/pulse/${pulseId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* counting never matters more than sharing */
  }
}

/** What a shared link says, in the words of its kind. */
export function shareText(question: string, kind: string = "pulse") {
  if (kind === "decide")
    return `Help me decide: ${question} Yes, no or not yet?`;
  if (kind === "settle") return `Settle this: ${question}`;
  if (kind === "rank")
    return `${question} — put them in order and see the group's ranking`;
  if (kind === "normal") return `${question} — compare anonymously`;
  return `${question} — add your answer on People's Pulse`;
}

const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d9d4c8] bg-white px-4 text-[14px] font-semibold text-[#14161a] transition hover:border-[#14161a] focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none";

/**
 * **Share a Pulse from a phone.** The link carries the sharer's referral code,
 * so votes that arrive through it count towards their circle. Nothing reads
 * contacts: the phone's own share sheet, SMS or email app does the sending.
 */
export function Share({
  url,
  question,
  prominent = false,
  pulseId,
  kind = "pulse",
}: {
  url: string;
  question: string;
  prominent?: boolean;
  pulseId?: string;
  kind?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = shareText(question, kind);
  const counted = () => {
    if (pulseId) countEvent(pulseId, "share");
  };
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const enc = encodeURIComponent;

  async function copy() {
    counted();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function native() {
    counted();
    try {
      await navigator.share({ title: "People's Pulse", text, url });
    } catch {
      /* closed the sheet */
    }
  }

  return (
    <section
      aria-labelledby="pulse-share-title"
      data-testid="pulse-share"
      className={`rounded-2xl border p-4 ${
        prominent
          ? "border-[#14161a] bg-white shadow-sm"
          : "border-[#e7e3da] bg-white"
      }`}
    >
      <h2 id="pulse-share-title" className="text-[15px] font-semibold">
        {prominent
          ? kind === "decide"
            ? "Your question is live — send it to people who know you"
            : "Your Pulse is live — send it to people"
          : "Share this Pulse"}
      </h2>
      <p className="mt-1 text-[13px] text-[#5c6370]">
        Votes through your link make up <strong>your circle</strong>.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f3f1ec] p-1.5 pl-3">
        <span
          className="min-w-0 flex-1 truncate font-mono text-[13px] text-[#3f4550]"
          data-testid="pulse-share-url"
        >
          {url}
        </span>
        <button
          type="button"
          onClick={copy}
          data-testid="pulse-copy"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#14161a] px-3 text-[13px] font-semibold text-white"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
      <div className="mt-3 flex flex-wrap gap-2">
        {canShare ? (
          <button
            type="button"
            onClick={native}
            className={btn}
            data-testid="pulse-native-share"
          >
            <Share2 className="h-4 w-4" aria-hidden /> Share…
          </button>
        ) : null}
        <a
          className={btn}
          href={`sms:?&body=${enc(`${text} ${url}`)}`}
          onClick={counted}
          data-testid="pulse-sms"
        >
          <MessageSquare className="h-4 w-4" aria-hidden /> Text
        </a>
        <a
          className={btn}
          href={`mailto:?subject=${enc(question)}&body=${enc(`${text}\n\n${url}`)}`}
          onClick={counted}
          data-testid="pulse-email"
        >
          <Mail className="h-4 w-4" aria-hidden /> Email
        </a>
        <a
          className={btn}
          target="_blank"
          rel="noopener noreferrer"
          href={`https://wa.me/?text=${enc(`${text} ${url}`)}`}
          onClick={counted}
        >
          WhatsApp
        </a>
        <a
          className={btn}
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}
          onClick={counted}
        >
          Facebook
        </a>
        <a
          className={btn}
          target="_blank"
          rel="noopener noreferrer"
          href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`}
          onClick={counted}
        >
          X
        </a>
      </div>
    </section>
  );
}
