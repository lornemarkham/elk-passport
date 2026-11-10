"use client";

import { useState } from "react";

/**
 * **Something wrong? Is this yours?** Anyone can say either. Each goes to a
 * reviewer with the listing; neither changes what's shown until a person
 * checks it.
 */
export function ListingFlags({ id }: { readonly id: string }) {
  const [open, setOpen] = useState<"report" | "claim" | null>(null);
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    const r = await fetch(`/api/insiders/listings/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: open, text, contact }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(body.error ?? "That didn't send — try again.");
      return;
    }
    setSent(
      open === "claim"
        ? "Thanks — we'll be in touch to confirm it's yours, then you can correct it any time."
        : "Thanks — a local will check it.",
    );
    setOpen(null);
    setText("");
  }

  return (
    <section
      className="mt-8 rounded-[24px] bg-black/[0.03] p-5"
      aria-label="Correct or claim"
    >
      {sent && (
        <p data-testid="flag-sent" className="mb-3 font-semibold">
          {sent}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="flag-report"
          onClick={() => setOpen("report")}
          className="min-h-11 rounded-full border border-black/20 bg-white px-4 font-semibold"
        >
          Something wrong?
        </button>
        <button
          type="button"
          data-testid="flag-claim"
          onClick={() => setOpen("claim")}
          className="min-h-11 rounded-full border border-black/20 bg-white px-4 font-semibold"
        >
          Is this yours? Claim it
        </button>
      </div>
      {open && (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {open === "claim"
              ? "Who are you, and how should we reach you to confirm?"
              : "What's wrong? A link to the right information helps."}
            <textarea
              data-testid="flag-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={1000}
              required
              className="rounded-xl border border-black/20 bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Email or phone (optional, never shown)
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="rounded-xl border border-black/20 bg-white px-3 py-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            data-testid="flag-send"
            className="min-h-11 self-start rounded-full bg-black px-5 font-semibold text-white"
          >
            Send
          </button>
        </form>
      )}
    </section>
  );
}
