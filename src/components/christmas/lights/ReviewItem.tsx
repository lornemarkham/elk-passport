"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FEATURES,
  KIND_LABEL,
  KINDS,
  TOWN_LABEL,
  photoSrc,
  type FeatureId,
  type Kind,
  type PinView,
} from "@/domain/christmas/lights/model";
import { send } from "./api";

/**
 * What a submitter asked to change on a published display, each line beside
 * what the public sees now. Only the fields they touched are listed.
 */
function changesOf(pin: PinView) {
  const c = pin.proposed;
  if (!c) return [];
  const labels = (ids: readonly FeatureId[]) =>
    ids
      .map((id) => FEATURES.find((f) => f.id === id)?.label ?? id)
      .join(", ") || "none";
  const lines: { label: string; now: string; proposed: string }[] = [];
  if (c.name !== undefined)
    lines.push({ label: "Name", now: pin.name, proposed: c.name });
  if (c.description !== undefined)
    lines.push({
      label: "Special features",
      now: pin.description || "none",
      proposed: c.description || "cleared",
    });
  if (c.hours !== undefined)
    lines.push({
      label: "Hours",
      now: pin.hours || "none",
      proposed: c.hours || "cleared",
    });
  if (c.features)
    lines.push({
      label: "Features",
      now: labels(pin.features),
      proposed: labels(c.features),
    });
  return lines;
}

/** Why a submission is turned down — said to the audit record, never to the submitter. */
const REJECT = [
  ["people", "Shows identifiable people"],
  ["plate", "Shows a licence plate"],
  ["private", "Shows private activity or the inside of a home"],
  ["inappropriate", "Inappropriate content"],
  ["spam", "Spam or harassment"],
  ["duplicate", "Duplicate of another display"],
  ["not-lights", "Not a Christmas display"],
] as const;

const STATUS: Record<PinView["status"], string> = {
  pending: "Pending review",
  approved: "Published",
  declined: "Rejected",
  hidden: "Hidden",
  removed: "Removed",
};

const btn =
  "min-h-12 rounded-full px-5 font-bold ring-1 ring-[#0f3b2b]/25 active:scale-[0.98]";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Vancouver",
  });

/**
 * **One display, for the administrator, on a phone.** The photo first and
 * large, then where it is, what was said, when it came in and its status;
 * then the five actions — Approve, Reject, Edit, Hide, Delete — as big
 * buttons. Every action lands in the audit trail shown under "History".
 */
export function ReviewItem({ pin }: { readonly pin: PinView }) {
  const router = useRouter();
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [why, setWhy] = useState<string>(REJECT[0][1]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pin.name);
  const [description, setDescription] = useState(pin.description ?? "");
  const [hours, setHours] = useState(pin.hours ?? "");
  const [kind, setKind] = useState<Kind>(pin.kind);
  const [note, setNote] = useState("");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action,
      ...extra,
    });
    setBusy(false);
    if (r.ok) {
      setRejecting(false);
      setEditing(false);
      router.refresh();
    } else setSay(r.error ?? "That didn't work.");
  }

  const src = photoSrc(pin);
  const trail = pin.review?.trail ?? [];
  const removal = trail.filter((e) => e.kind === "removal-request");
  const asked = pin.review?.removalOpen;
  const status = pin.status;

  return (
    <li
      className={`overflow-hidden rounded-[24px] bg-white text-[#082319] shadow-[0_6px_24px_rgba(8,35,25,0.12)] ${asked ? "ring-2 ring-[#b3242f]" : ""}`}
      data-testid="review-item"
      data-id={pin.id}
      data-status={status}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Submitted photo of ${pin.name}`}
          className="max-h-[60vh] w-full bg-[#0f3b2b] object-contain"
          data-testid="review-photo"
        />
      ) : (
        <p className="bg-[#f7e3e1] p-3 text-center text-sm font-bold text-[#b3242f]">
          No photo
        </p>
      )}
      <div className="space-y-2 p-4">
        <p className="text-xs font-bold tracking-wider text-[#b3242f] uppercase">
          <span data-testid="review-status">{STATUS[status]}</span> ·{" "}
          {KIND_LABEL[pin.kind]} · {TOWN_LABEL[pin.town]}
        </p>
        <h3 className="ghad-display text-2xl leading-tight font-extrabold">
          {pin.name}
        </h3>
        {pin.description ? (
          <p>{pin.description}</p>
        ) : (
          <p className="text-[#5b4a2e]">No description.</p>
        )}
        <p className="text-sm">
          📍{" "}
          <a
            className="font-bold underline"
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${pin.at.lat},${pin.at.lng}`}
          >
            {pin.at.lat.toFixed(5)}, {pin.at.lng.toFixed(5)} — open map
          </a>
          {pin.hours ? ` · 🕯️ ${pin.hours}` : ""}
        </p>
        {pin.review && (
          <p className="text-sm text-[#3d4a43]">
            Submitted {when(pin.review.submittedAt)}
          </p>
        )}
        {asked && (
          <div
            className="rounded-2xl bg-[#fff1ef] p-3 text-sm"
            data-testid="removal-flag"
          >
            <p className="font-extrabold text-[#b3242f]">
              🏠 Removal requested — hidden from the public map
            </p>
            {removal.map((e) => (
              <p key={e.at + e.by} className="mt-1">
                {when(e.at)}
                {e.text ? ` — “${e.text}”` : ""}
                {e.contact ? ` · contact: ${e.contact}` : " · no contact left"}
              </p>
            ))}
          </div>
        )}
        {pin.review && pin.review.reports > 0 && (
          <p className="text-sm font-bold text-[#b3242f]">
            {pin.review.reports} problem report
            {pin.review.reports === 1 ? "" : "s"} — see History
          </p>
        )}
      </div>

      {pin.proposed && (
        <div
          className="mx-4 mb-4 space-y-2 rounded-2xl bg-[#fbf6ec] p-3 text-sm"
          data-testid="review-change"
        >
          <p className="font-extrabold">
            Change waiting for review — the public map still shows the words
            above
          </p>
          <ul className="space-y-1">
            {changesOf(pin).map((line) => (
              <li key={line.label}>
                <strong>{line.label}:</strong> {line.now} →{" "}
                <span className="font-bold">{line.proposed}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("approve-change")}
              className={`${btn} bg-[#0f3b2b] text-white`}
              data-testid="review-approve-change"
            >
              Approve change
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("decline-change", { why: note })}
              className={btn}
              data-testid="review-decline-change"
            >
              Decline change
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form
          className="mx-4 mb-4 space-y-3 rounded-2xl bg-[#fbf6ec] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act("details", { name, description, hours, kind });
          }}
          data-testid="review-edit"
        >
          <label className="block text-sm font-bold">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-xl border p-3 text-base font-normal"
              data-testid="edit-name"
            />
          </label>
          <label className="block text-sm font-bold">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-xl border p-3 text-base font-normal"
              data-testid="edit-description"
            />
          </label>
          <label className="block text-sm font-bold">
            Viewing hours
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-xl border p-3 text-base font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Kind
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="mt-1 w-full rounded-xl border p-3 text-base font-normal"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className={`${btn} bg-[#0f3b2b] text-white`}
              data-testid="edit-save"
            >
              Save changes
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
        <div className="mx-4 mb-4 space-y-2 rounded-2xl bg-[#fbf6ec] p-3">
          <label className="block text-sm font-bold">
            Reason (kept in the audit record)
            <select
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              className="mt-1 w-full rounded-xl border p-3 text-base font-normal"
              data-testid="reject-reason"
            >
              {REJECT.map(([id, label]) => (
                <option key={id} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("decline", { why })}
            className={`${btn} bg-[#b3242f] text-white`}
            data-testid="reject-confirm"
          >
            Reject
          </button>
        </div>
      )}

      {(status === "hidden" || status === "approved") && (
        <label className="mx-4 mb-3 block text-sm font-bold">
          Note for the record (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="mt-1 w-full rounded-xl border p-3 text-base font-normal"
            data-testid="review-note"
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {(status === "pending" || status === "declined") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("approve")}
            className={`${btn} bg-[#0f3b2b] text-white`}
            data-testid="review-approve"
          >
            Approve
          </button>
        )}
        {status === "pending" && !rejecting && (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className={btn}
            data-testid="review-reject"
          >
            Reject
          </button>
        )}
        {status === "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("hide", { why: note })}
            className={btn}
            data-testid="review-hide"
          >
            Hide
          </button>
        )}
        {status === "hidden" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("restore", { why: note })}
            className={btn}
            data-testid="review-restore"
          >
            {asked ? "Dispute resolved — restore" : "Restore"}
          </button>
        )}
        {status !== "removed" && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={btn}
            data-testid="review-edit-open"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            confirm(
              "Delete permanently? The photo, words and any contact are erased; the place stays blocked from being added again.",
            ) && void act("remove", { why: note })
          }
          className={`${btn} text-[#b3242f] ring-[#b3242f]/40`}
          data-testid="review-remove"
        >
          Delete
        </button>
      </div>
      {say && (
        <p className="px-4 pb-3 text-sm font-bold text-[#b3242f]" role="alert">
          {say}
        </p>
      )}
      <details className="border-t border-[#0f3b2b]/10 px-4 py-3 text-sm">
        <summary className="min-h-10 cursor-pointer font-bold">
          History ({trail.length})
        </summary>
        <ol className="mt-2 space-y-1" data-testid="review-trail">
          {trail.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              {when(e.at)} — <strong>{e.kind}</strong>
              {e.by.includes("@") ? ` by ${e.by}` : ""}
              {e.text ? ` — ${e.text}` : ""}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
