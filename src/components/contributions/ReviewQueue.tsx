"use client";

import { useState } from "react";
import {
  CATEGORIES,
  DECLINE_REASONS,
  categoryLabel,
  experienceLabel,
  placeLine,
  type DeclineReason,
  type ReviewView,
  type Status,
} from "@/domain/contributions/model";

/**
 * **The administrator's one queue** for every experience's suggestions:
 * phone-first, one column, 44 px buttons. Each card shows everything the
 * contributor gave — name, kind, where it came from, location, date, website,
 * description, photo, status — and the actions the brief asks for:
 * **Approve · Edit · Reject (with a reason) · Copy for Atlas**. Approving a
 * suggestion with a website also queues the page for Atlas to read.
 */

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending review",
  approved: "Approved",
  declined: "Rejected",
};

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold ring-1 ring-black/20 active:scale-[0.98] disabled:opacity-50";
const input =
  "w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm focus:border-black/40 focus:outline-none";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Vancouver",
  });

async function act(id: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/contributions/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(data.error ?? `Failed (${r.status})`));
  return data;
}

export function ReviewQueue({ initial }: { readonly initial: ReviewView[] }) {
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<Status>("pending");
  const counts = {
    pending: items.filter((s) => s.status === "pending").length,
    approved: items.filter((s) => s.status === "approved").length,
    declined: items.filter((s) => s.status === "declined").length,
  };
  const shown = items.filter((s) => s.status === tab);
  const byId = new Map(items.map((s) => [s.id, s]));
  const replace = (s: ReviewView) =>
    setItems((all) => all.map((x) => (x.id === s.id ? s : x)));
  return (
    <div className="mt-4">
      <nav
        aria-label="Queues"
        className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-[#fbf8f2]/95 px-4 py-2 backdrop-blur"
      >
        {(["pending", "approved", "declined"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            data-testid={`queue-${t}`}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ring-1 ${
              tab === t
                ? "bg-[#111] text-white ring-[#111]"
                : "bg-white ring-black/15"
            }`}
          >
            {STATUS_LABEL[t]} · {counts[t]}
          </button>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="mt-4 text-black/60" data-testid="queue-empty">
          Nothing here.
        </p>
      ) : (
        <ul className="mt-4 space-y-4" data-testid="queue-list">
          {shown.map((s) => (
            <Card
              key={s.id}
              s={s}
              twin={s.duplicateOf ? byId.get(s.duplicateOf) : undefined}
              onChange={replace}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({
  s,
  twin,
  onChange,
}: {
  readonly s: ReviewView;
  readonly twin?: ReviewView;
  readonly onChange: (s: ReviewView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<DeclineReason>("duplicate");
  const [note, setNote] = useState("");
  const [copyText, setCopyText] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: s.name,
    category: s.category,
    location: s.location.text,
    town: s.location.town ?? "",
    when: s.when ?? "",
    website: s.website ?? "",
    description: s.description ?? "",
  });

  async function run(body: Record<string, unknown>, done?: string) {
    setBusy(true);
    setSaid(null);
    try {
      const data = await act(s.id, body);
      if (data.suggestion) onChange(data.suggestion as ReviewView);
      if (done) setSaid(done);
      return data;
    } catch (e) {
      setSaid((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const data = await run({ action: "copy" });
    const text = (data?.copy as { text?: string } | undefined)?.text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setSaid("Copied — paste it into Atlas.");
    } catch {
      // No clipboard here (an older browser, or permission refused): the
      // block is shown to copy by hand.
      setCopyText(text);
      setSaid("Copy the block below and paste it into Atlas.");
    }
  }

  const maps =
    s.location.lat !== undefined && s.location.lng !== undefined
      ? `https://www.google.com/maps?q=${s.location.lat},${s.location.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(placeLine(s.location))}`;

  return (
    <li
      className="rounded-[20px] bg-white p-4 ring-1 ring-black/10"
      data-testid={`suggestion-${s.id}`}
      data-status={s.status}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span
          className="rounded-full bg-[#111] px-2.5 py-1 text-white"
          data-testid="card-experience"
        >
          {experienceLabel(s.experience)}
        </span>
        <span className="rounded-full bg-black/5 px-2.5 py-1">
          {categoryLabel(s.category)}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 ${
            s.status === "approved"
              ? "bg-[#e8f3ec] text-[#0f3b2b]"
              : s.status === "declined"
                ? "bg-black/5 text-black/55"
                : "bg-[#f7e3e1] text-[#b3242f]"
          }`}
          data-testid="card-status"
        >
          {STATUS_LABEL[s.status]}
          {s.declineReason
            ? ` · ${DECLINE_REASONS.find((r) => r.id === s.declineReason)?.label}`
            : ""}
        </span>
      </div>
      <h3
        className="ghad-display mt-2 text-2xl leading-tight font-extrabold"
        data-testid="card-name"
      >
        {s.name}
      </h3>
      <dl className="mt-2 space-y-1 text-sm">
        <div>
          <dt className="inline font-bold">Where: </dt>
          <dd className="inline">
            <a
              href={maps}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {placeLine(s.location)}
            </a>
            {s.location.lat !== undefined && (
              <span className="text-black/50">
                {" "}
                · {s.location.lat}, {s.location.lng}
              </span>
            )}
          </dd>
        </div>
        {s.when && (
          <div>
            <dt className="inline font-bold">When: </dt>
            <dd className="inline">{s.when}</dd>
          </div>
        )}
        {s.website && (
          <div>
            <dt className="inline font-bold">Website: </dt>
            <dd className="inline break-all">
              <a
                href={s.website}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {s.website}
              </a>
            </dd>
          </div>
        )}
        {s.description && (
          <div>
            <dt className="inline font-bold">About: </dt>
            <dd className="inline whitespace-pre-wrap">{s.description}</dd>
          </div>
        )}
        <div className="text-black/60">
          <dt className="inline">Sent </dt>
          <dd className="inline">
            {when(s.submittedAt)} · this contributor: {s.contributorApproved}{" "}
            approved, {s.contributorPending} waiting
          </dd>
        </div>
        {twin && (
          <div
            className="rounded-xl bg-[#fff3c4] px-3 py-2 text-[#5a4300]"
            data-testid="card-lookalike"
          >
            Looks like <strong>{twin.name}</strong> (
            {STATUS_LABEL[twin.status].toLowerCase()}) — compare before
            approving.
          </div>
        )}
        {s.atlas && (
          <div className="text-black/60" data-testid="card-atlas">
            Atlas: {s.atlas.state}
            {s.atlas.detail ? ` — ${s.atlas.detail}` : ""}
          </div>
        )}
      </dl>
      {s.photo && (
        // The administrator's private photo endpoint: not a public asset for next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/contributions/photo/${encodeURIComponent(s.id)}`}
          alt={`Photo sent with ${s.name}`}
          className="mt-3 max-h-72 w-full rounded-2xl object-cover"
          loading="lazy"
          data-testid="card-photo"
        />
      )}

      {editing && (
        <form
          className="mt-3 grid gap-2 rounded-2xl bg-[#fbf8f2] p-3"
          data-testid="card-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ action: "edit", ...draft }, "Saved.").then(() =>
              setEditing(false),
            );
          }}
        >
          <input
            className={input}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-label="Name"
            data-testid="edit-name"
          />
          <select
            className={input}
            value={draft.category}
            onChange={(e) =>
              setDraft({
                ...draft,
                category: e.target.value as ReviewView["category"],
              })
            }
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className={input}
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            aria-label="Location"
            placeholder="Location"
          />
          <input
            className={input}
            value={draft.town}
            onChange={(e) => setDraft({ ...draft, town: e.target.value })}
            aria-label="Town"
            placeholder="Town"
          />
          <input
            className={input}
            value={draft.when}
            onChange={(e) => setDraft({ ...draft, when: e.target.value })}
            aria-label="When"
            placeholder="When"
          />
          <input
            className={input}
            value={draft.website}
            onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            aria-label="Website"
            placeholder="Website"
          />
          <textarea
            className={`${input} min-h-20`}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            aria-label="Description"
            placeholder="Description"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className={`${btn} bg-[#111] text-white ring-[#111]`}
              data-testid="edit-save"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={btn}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {rejecting && (
        <div
          className="mt-3 grid gap-2 rounded-2xl bg-[#fbf8f2] p-3"
          data-testid="card-reject"
        >
          <label className="text-sm font-bold">
            Why?
            <select
              className={`${input} mt-1`}
              value={reason}
              onChange={(e) => setReason(e.target.value as DeclineReason)}
              data-testid="reject-reason"
            >
              {DECLINE_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <input
            className={input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A note for the record (optional)"
            aria-label="Note"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run({ action: "decline", reason, note }, "Rejected.").then(
                  () => setRejecting(false),
                )
              }
              className={`${btn} bg-[#b3242f] text-white ring-[#b3242f]`}
              data-testid="reject-confirm"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className={btn}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {s.status !== "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run({ action: "approve" }, "Approved.")}
            className={`${btn} bg-[#0f3b2b] text-white ring-[#0f3b2b]`}
            data-testid="card-approve"
          >
            Approve
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing((v) => !v)}
          className={btn}
          data-testid="card-edit-toggle"
        >
          Edit
        </button>
        {s.status !== "declined" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting((v) => !v)}
            className={btn}
            data-testid="card-reject-toggle"
          >
            Reject
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void copy()}
          className={btn}
          data-testid="card-copy"
        >
          Copy for Atlas
        </button>
        {s.website &&
          s.status === "approved" &&
          s.atlas?.state !== "queued" &&
          s.atlas?.state !== "already-queued" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run({ action: "atlas" }, "Sent to Atlas.")}
              className={btn}
              data-testid="card-atlas-send"
            >
              Send website to Atlas
            </button>
          )}
      </div>
      {said && (
        <p
          className="mt-2 text-sm font-bold"
          role="status"
          data-testid="card-said"
        >
          {said}
        </p>
      )}
      {copyText && (
        <textarea
          readOnly
          className={`${input} mt-2 min-h-32 font-mono text-xs`}
          value={copyText}
          aria-label="Copy for Atlas"
          data-testid="card-copy-text"
        />
      )}
      <details className="mt-2 text-xs text-black/60">
        <summary className="cursor-pointer font-bold">History</summary>
        <ul className="mt-1 space-y-0.5">
          {s.trail.map((e, i) => (
            <li key={i}>
              {when(e.at)} · {e.kind} · {e.by}
              {e.text ? ` — ${e.text}` : ""}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
