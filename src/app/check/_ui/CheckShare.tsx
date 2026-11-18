"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Check, Copy, MessageSquareText, Share2 } from "lucide-react";
import {
  suggestedComment,
  visitSource,
  type ShareChannel,
} from "@/lib/pulse/check";

/** Fire-and-forget aggregate counts: a kind of place or channel, per day. */
function count(event: "visit" | "share", source: string) {
  try {
    void fetch("/api/pulse/check/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, source }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* counting never matters more than reading */
  }
}

const CircleContext = createContext<{
  circle: string | null;
  setCircle: (c: string) => void;
}>({ circle: null, setCircle: () => {} });

/**
 * Holds this browser's referral code for the check, learned from the poll,
 * so the share links carry it and votes through them form the sharer's circle.
 */
export function CircleProvider({ children }: { children: React.ReactNode }) {
  const [circle, setCircle] = useState<string | null>(null);
  return (
    <CircleContext.Provider value={{ circle, setCircle }}>
      {children}
    </CircleContext.Provider>
  );
}

export const useCircle = () => useContext(CircleContext);

/** Counts one visit per tab, by the kind of site it came from — never the address. */
export function VisitCounter({ pulseId }: { pulseId: string }) {
  useEffect(() => {
    const k = `pulse-check-visit-${pulseId}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    count("visit", visitSource(document.referrer, window.location.host));
  }, [pulseId]);
  return null;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

const btn =
  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold transition focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * **Share a Pulse Check into the conversation it came from.** Copy the link,
 * copy a suggested comment (edited first if you like), or use the phone's
 * share sheet. Nothing is ever posted for you: you choose where and when.
 */
export function CheckShare({
  path,
  claim,
  fresh,
}: {
  path: string;
  claim: string;
  fresh: boolean;
}) {
  const { circle } = useCircle();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"link" | "comment" | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page's own address and the share sheet exist only in the browser
    setOrigin(window.location.origin);
    setCanShare("share" in navigator);
  }, []);

  const url = origin ? `${origin}${path}${circle ? `?c=${circle}` : ""}` : "";
  // The suggested comment follows the link until the person edits it.
  const text = comment ?? (url ? suggestedComment(url) : "");

  function done(what: "link" | "comment", channel: ShareChannel) {
    count("share", channel);
    setCopied(what);
    setTimeout(() => setCopied(null), 2400);
  }

  async function native() {
    count("share", "native");
    try {
      await navigator.share({
        title: "Is this true? — Pulse Check",
        text: `🤔 Is this true? “${claim.length > 120 ? `${claim.slice(0, 117)}…` : claim}” Check the sources and have your say:`,
        url,
      });
    } catch {
      /* closed the sheet */
    }
  }

  const enc = encodeURIComponent;
  return (
    <section
      aria-labelledby="check-share-title"
      data-testid="check-share"
      className={`rounded-2xl border p-4 ${fresh ? "border-[#14161a] bg-white shadow-sm" : "border-[#e7e3da] bg-white"}`}
    >
      <h2 id="check-share-title" className="text-[17px] font-bold">
        {fresh
          ? "Your Pulse Check is live. Now post it under the original."
          : "Share this Pulse Check"}
      </h2>
      <p className="mt-1 text-[13.5px] text-[#5c6370]">
        Copy the comment, go back to the post, and paste it as a reply. Nothing
        is posted for you.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={!url}
          data-testid="check-copy-link"
          onClick={async () => {
            await copyText(url);
            done("link", "copy-link");
          }}
          className={`${btn} border border-[#d9d4c8] bg-white text-[#14161a] hover:border-[#14161a]`}
        >
          {copied === "link" ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied === "link" ? "Link copied" : "Copy link"}
        </button>
        <button
          type="button"
          disabled={!url}
          data-testid="check-copy-comment"
          onClick={async () => {
            await copyText(text);
            done("comment", "copy-comment");
          }}
          className={`${btn} bg-[#14161a] text-white hover:bg-black`}
        >
          {copied === "comment" ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <MessageSquareText className="h-4 w-4" aria-hidden />
          )}
          {copied === "comment" ? "Comment copied" : "Copy comment"}
        </button>
        {canShare ? (
          <button
            type="button"
            disabled={!url}
            onClick={native}
            data-testid="check-native-share"
            className={`${btn} border border-[#d9d4c8] bg-white text-[#14161a] hover:border-[#14161a]`}
          >
            <Share2 className="h-4 w-4" aria-hidden /> Share
          </button>
        ) : (
          <a
            href={
              url
                ? `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`
                : undefined
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => count("share", "facebook")}
            data-testid="check-share-facebook"
            className={`${btn} border border-[#d9d4c8] bg-white text-[#14161a] hover:border-[#14161a]`}
          >
            <Share2 className="h-4 w-4" aria-hidden /> Share
          </a>
        )}
      </div>
      <span role="status" className="sr-only">
        {copied === "link"
          ? "Link copied"
          : copied === "comment"
            ? "Comment copied"
            : ""}
      </span>

      <label className="mt-4 grid gap-1.5 text-[13.5px] font-medium text-[#3f4550]">
        Suggested comment{" "}
        <span className="font-normal text-[#5c6370]">
          — edit it before you copy
        </span>
        <textarea
          value={text}
          rows={7}
          maxLength={1500}
          onChange={(e) => setComment(e.target.value)}
          data-testid="check-comment"
          className="rounded-xl border border-[#d9d4c8] bg-[#fbfaf7] px-3.5 py-3 text-[15px] leading-relaxed"
        />
      </label>
      {comment !== null ? (
        <button
          type="button"
          onClick={() => setComment(null)}
          className="mt-1 text-[13px] font-medium text-[#5c6370] underline underline-offset-2"
        >
          Start the comment over
        </button>
      ) : null}
      <p
        className="mt-3 truncate font-mono text-[12.5px] text-[#5c6370]"
        data-testid="check-share-url"
      >
        {url}
      </p>
      <details className="mt-2 text-[13.5px]">
        <summary className="cursor-pointer py-3 font-medium text-[#5c6370]">
          More ways to send it
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            [
              "Facebook",
              "facebook",
              `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
            ],
            ["WhatsApp", "whatsapp", `https://wa.me/?text=${enc(text)}`],
            [
              "X",
              "x",
              `https://twitter.com/intent/tweet?text=${enc("🤔 Is this true? Check the sources and have your say:")}&url=${enc(url)}`,
            ],
            ["Text", "sms", `sms:?&body=${enc(text)}`],
            [
              "Email",
              "email",
              `mailto:?subject=${enc("Is this true?")}&body=${enc(text)}`,
            ],
          ].map(([label, channel, href]) => (
            <a
              key={channel}
              href={href}
              target={
                channel === "sms" || channel === "email" ? undefined : "_blank"
              }
              rel="noopener noreferrer"
              onClick={() => count("share", channel!)}
              className="inline-flex min-h-11 items-center rounded-full border border-[#d9d4c8] bg-white px-4 font-semibold"
            >
              {label}
            </a>
          ))}
        </div>
      </details>
    </section>
  );
}
