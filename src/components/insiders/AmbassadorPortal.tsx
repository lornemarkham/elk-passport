"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KINDS,
  KIND_LABEL,
  VERIFICATIONS,
  VERIFICATION_LABEL,
  type Ambassador,
  type Listing,
  type Note,
  type SubmitterRole,
} from "@/domain/insiders/model";
import { ShareButton } from "./ShareButton";

/**
 * **The ambassador portal.** An ambassador shares, follows what they sent,
 * fixes their own listings and suggests corrections to others. A reviewer
 * (an administrator, or a trusted ambassador) also works the queue: check a
 * date against its page, record permission, publish. An administrator also
 * invites ambassadors. Every action is checked again on the server; this
 * page only hides what the person can't do.
 */

export interface PortalListing {
  readonly listing: Listing;
  readonly blockers: readonly string[];
  readonly flags: readonly Note[];
  readonly editable: boolean;
  readonly atlasMatches: readonly { id: string; name: string }[];
}

interface Me {
  role: SubmitterRole;
  email: string;
  name: string;
  area: string;
  bio: string;
  trusted: boolean;
  reviewer: boolean;
}

async function post(url: string, body: unknown): Promise<string | null> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.ok) return null;
  const b = await r.json().catch(() => ({}));
  return b.error ?? `Failed (${r.status})`;
}

const STATUS_LABEL: Record<Listing["status"], string> = {
  submitted: "Waiting for review",
  "needs-info": "Needs more information",
  published: "Live on Go Have a Day",
  declined: "Not published",
  withdrawn: "Taken down",
};

const h2 = "ghad-display text-2xl font-extrabold tracking-[-0.02em]";

export function AmbassadorPortal({
  me,
  mine,
  stats,
  queue,
  everything,
  leadTimes,
  watch,
  ambassadors,
}: {
  me: Me;
  mine: readonly PortalListing[];
  stats: { published: number; waiting: number; medianLeadDays: number | null };
  queue: readonly PortalListing[];
  everything: readonly PortalListing[];
  leadTimes: readonly {
    id: string;
    title: string;
    starts?: string;
    days?: number;
  }[];
  watch: readonly {
    id: string;
    title: string;
    url: string;
    daysSinceChecked: number;
  }[];
  ambassadors: readonly Ambassador[];
}) {
  return (
    <div className="flex flex-col gap-10" data-testid="ambassador-portal">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-black/60 uppercase">
            {me.role === "admin"
              ? "Administrator"
              : me.trusted
                ? "Trusted ambassador"
                : "Ambassador"}{" "}
            · {me.area}
          </p>
          <h1 className="ghad-display text-4xl font-extrabold tracking-[-0.03em]">
            Hey {me.name.split(/[\s@]/)[0]} 👋
          </h1>
          <p className="mt-1 text-black/70" data-testid="ambassador-stats">
            {stats.published} live · {stats.waiting} waiting
            {stats.medianLeadDays !== null
              ? ` · your events reach us ${stats.medianLeadDays} days ahead (median)`
              : ""}
          </p>
        </div>
        <ShareButton />
      </header>

      {me.reviewer && (
        <section aria-label="Review queue" data-testid="review-queue">
          <h2 className={h2}>To review ({queue.length})</h2>
          {queue.length === 0 ? (
            <p className="mt-2 text-black/60">All caught up.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {queue.map((p) => (
                <ListingRow key={p.listing.id} p={p} me={me} review />
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-label="My contributions" data-testid="my-contributions">
        <h2 className={h2}>What you&apos;ve shared ({mine.length})</h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-black/60">
            Nothing yet — the button above takes a minute.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {mine.map((p) => (
              <ListingRow key={p.listing.id} p={p} me={me} review={false} />
            ))}
          </ul>
        )}
      </section>

      {everything.length > 0 && (
        <section aria-label="Every listing">
          <h2 className={h2}>Every other listing ({everything.length})</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {everything.map((p) => (
              <ListingRow key={p.listing.id} p={p} me={me} review />
            ))}
          </ul>
        </section>
      )}

      {me.reviewer && (
        <section aria-label="Discovery lead time" data-testid="lead-times">
          <h2 className={h2}>How early we hear about events</h2>
          <p className="mt-1 text-sm text-black/60">
            Days between Go Have a Day first hearing of an event and its checked
            start date. Below zero means we heard too late.
          </p>
          {leadTimes.length === 0 ? (
            <p className="mt-2 text-black/60">
              No published event has a checked date yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {leadTimes.map((r) => (
                <li key={r.id}>
                  <strong>{r.title}</strong> — {r.starts} ·{" "}
                  <span className={r.days! < 0 ? "font-bold text-red-700" : ""}>
                    {r.days} days ahead
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {me.reviewer && watch.length > 0 && <Watch watch={watch} />}

      {me.role === "admin" && <Ambassadors ambassadors={ambassadors} />}
      {me.role === "ambassador" && <Profile me={me} />}
    </div>
  );
}

function ListingRow({
  p,
  me,
  review,
}: {
  p: PortalListing;
  me: Me;
  review: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const l = p.listing;

  async function act(body: unknown) {
    setError(null);
    const e = await post(
      `/api/insiders/listings/${encodeURIComponent(l.id)}`,
      body,
    );
    if (e) setError(e);
    else {
      setEditing(false);
      setCorrection("");
      router.refresh();
    }
  }

  return (
    <li
      data-testid={`row-${l.id}`}
      className="rounded-[20px] border border-black/10 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold">
          {l.title}{" "}
          <span className="text-sm font-normal text-black/50">
            · {KIND_LABEL[l.kind]} · {l.place.town || "no town"}
          </span>
        </h3>
        <span
          data-testid="row-status"
          className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold"
        >
          {STATUS_LABEL[l.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-black/70">{l.description}</p>
      <p className="mt-1 text-xs text-black/50">
        {VERIFICATION_LABEL[l.verification]} · confidence {l.confidence} · from{" "}
        {l.submittedBy.role} · {l.provenance}
        {l.dates
          ? ` · date ${l.dates.starts}${l.dates.verifiedAt ? " (checked)" : " (not checked)"}`
          : ""}
        {l.atlas
          ? ` · Atlas: ${l.atlas.state}${l.atlas.detail ? ` (${l.atlas.detail})` : ""}`
          : ""}
      </p>
      {p.flags.length > 0 && (
        <ul
          className="mt-2 flex flex-col gap-1 rounded-xl bg-amber-50 p-3 text-sm"
          data-testid="row-flags"
        >
          {p.flags.map((f, i) => (
            <li key={i}>
              <strong>
                {f.kind === "report"
                  ? "Reported"
                  : f.kind === "claim"
                    ? "Claimed"
                    : "Correction"}
              </strong>{" "}
              by {f.by}: {f.text}
            </li>
          ))}
        </ul>
      )}
      {p.atlasMatches.length > 0 && (
        <p className="mt-2 text-sm" data-testid="row-atlas-matches">
          Atlas may already hold this:{" "}
          {p.atlasMatches.map((m) => (
            <Link
              key={m.id}
              href={`/passport/${m.id}`}
              className="underline underline-offset-4"
              target="_blank"
            >
              {m.name}
            </Link>
          ))}
          . Link it below instead of making a second one.
        </p>
      )}
      {review && p.blockers.length > 0 && l.status !== "published" && (
        <ul
          className="mt-2 list-disc pl-5 text-sm text-black/70"
          data-testid="row-blockers"
        >
          {p.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {p.editable && (
          <button
            type="button"
            data-testid="row-edit"
            onClick={() => setEditing((e) => !e)}
            className="min-h-10 rounded-full border border-black/20 px-4 text-sm font-semibold"
          >
            {editing ? "Close" : "Update details"}
          </button>
        )}
        {l.status === "published" && (
          <Link
            href={`/local/${l.id}`}
            className="inline-flex min-h-10 items-center rounded-full border border-black/20 px-4 text-sm font-semibold"
          >
            See it live
          </Link>
        )}
        {review && me.reviewer && l.status !== "published" && (
          <button
            type="button"
            data-testid="row-publish"
            disabled={p.blockers.length > 0}
            onClick={() => void act({ action: "decide", decision: "publish" })}
            className="min-h-10 rounded-full bg-black px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            Publish
          </button>
        )}
        {review && me.reviewer && l.status === "published" && (
          <button
            type="button"
            onClick={() =>
              void act({ action: "decide", decision: "withdraw", reason })
            }
            className="min-h-10 rounded-full border border-black/20 px-4 text-sm font-semibold"
          >
            Take down
          </button>
        )}
        {review && me.reviewer && p.flags.length > 0 && (
          <button
            type="button"
            data-testid="row-resolve"
            onClick={() => void act({ action: "edit", change: {} })}
            className="min-h-10 rounded-full border border-black/20 px-4 text-sm font-semibold"
          >
            Mark flags handled
          </button>
        )}
      </div>

      {review && me.reviewer && l.status !== "published" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why (sent to the person who shared it)"
            className="min-h-10 flex-1 rounded-full border border-black/20 px-4 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              void act({ action: "decide", decision: "needs-info", reason })
            }
            className="min-h-10 rounded-full border border-black/20 px-4 text-sm font-semibold"
          >
            Ask for more
          </button>
          <button
            type="button"
            onClick={() =>
              void act({ action: "decide", decision: "decline", reason })
            }
            className="min-h-10 rounded-full border border-black/20 px-4 text-sm font-semibold"
          >
            Decline
          </button>
        </div>
      )}

      {!p.editable && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "correct", text: correction });
          }}
        >
          <input
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Suggest a correction"
            className="min-h-10 flex-1 rounded-full border border-black/20 px-4 text-sm"
          />
          <button
            type="submit"
            className="min-h-10 rounded-full border border-black/20 px-4 text-sm font-semibold"
            disabled={!correction.trim()}
          >
            Suggest
          </button>
        </form>
      )}

      {editing && (
        <EditForm
          l={l}
          me={me}
          onSave={(change) => void act({ action: "edit", change })}
        />
      )}
    </li>
  );
}

function EditForm({
  l,
  me,
  onSave,
}: {
  l: Listing;
  me: Me;
  onSave: (change: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    title: l.title,
    description: l.description,
    kind: l.kind,
    town: l.place.town,
    venue: l.place.name ?? "",
    interests: l.interests.join(", "),
    organizer: l.organizer ?? "",
    organizerUrl: l.organizerUrl ?? "",
    provenance: l.provenance,
    starts: l.dates?.starts ?? "",
    ends: l.dates?.ends ?? "",
    dateSource: l.dates?.source ?? "",
    dateChecked: false,
    schedule: l.schedule ?? "",
    registrationUrl: l.registration?.url ?? "",
    registrationChecked: false,
    access: l.access,
    permissionBy: "",
    verification: l.verification,
    atlasEntityId: l.atlasEntityId ?? "",
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((x) => ({ ...x, [k]: v }));
  const cls = "w-full rounded-xl border border-black/20 px-3 py-2 text-sm";
  const text = (k: keyof typeof f, label: string) => (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      <input
        data-testid={`e-${k}`}
        value={f[k] as string}
        onChange={(e) => set(k, e.target.value)}
        className={cls}
      />
    </label>
  );
  return (
    <form
      data-testid="edit-form"
      className="mt-4 grid grid-cols-1 gap-3 rounded-[16px] bg-black/[0.03] p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...f,
          interests: f.interests
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean),
          starts: f.starts || null,
          ends: f.ends || null,
          registrationUrl: f.registrationUrl || null,
          atlasEntityId: f.atlasEntityId || null,
          ...(f.permissionBy ? {} : { permissionBy: undefined }),
        });
      }}
    >
      {text("title", "Name")}
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Kind
        <select
          value={f.kind}
          onChange={(e) => set("kind", e.target.value)}
          className={cls}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
        Description
        <textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={cls}
        />
      </label>
      {text("town", "Town")}
      {text("venue", "Venue")}
      {text("interests", "Interests")}
      {text("organizer", "Organizer")}
      {text("organizerUrl", "Organizer's page")}
      {text("provenance", "Where this came from")}
      {text("starts", "Starts (YYYY-MM-DD)")}
      {text("ends", "Ends")}
      {text("dateSource", "Page that states the date")}
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          data-testid="e-dateChecked"
          checked={f.dateChecked}
          onChange={(e) => set("dateChecked", e.target.checked)}
        />
        I checked the date on that page just now
      </label>
      {text("schedule", "Regular schedule")}
      {text("registrationUrl", "Registration link")}
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          data-testid="e-registrationChecked"
          checked={f.registrationChecked}
          onChange={(e) => set("registrationChecked", e.target.checked)}
        />
        I opened the registration link and it works
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Who can go
        <select
          value={f.access}
          onChange={(e) => set("access", e.target.value)}
          className={cls}
        >
          <option value="public">Anyone</option>
          <option value="members">Members only</option>
          <option value="ask-first">Ask first</option>
        </select>
      </label>
      {me.role === "admin" &&
        text("permissionBy", "Permission given by (name, how, when)")}
      <label className="flex flex-col gap-1 text-xs font-semibold">
        How sure
        <select
          data-testid="e-verification"
          value={f.verification}
          onChange={(e) => set("verification", e.target.value)}
          className={cls}
        >
          {VERIFICATIONS.map((v) => (
            <option key={v} value={v}>
              {VERIFICATION_LABEL[v]}
            </option>
          ))}
        </select>
      </label>
      {text("atlasEntityId", "Atlas entity id (if Atlas already holds it)")}
      <button
        type="submit"
        data-testid="e-save"
        className="min-h-10 self-end rounded-full bg-black px-5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start"
      >
        Save
      </button>
    </form>
  );
}

function Ambassadors({ ambassadors }: { ambassadors: readonly Ambassador[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    email: "",
    name: "",
    area: "Vernon",
    trusted: false,
  });
  const [error, setError] = useState<string | null>(null);
  async function send(body: unknown) {
    const e = await post("/api/insiders/ambassadors", body);
    setError(e);
    if (!e) {
      setF({ email: "", name: "", area: "Vernon", trusted: false });
      router.refresh();
    }
  }
  return (
    <section aria-label="Ambassadors" data-testid="ambassadors-admin">
      <h2 className={h2}>
        Ambassadors ({ambassadors.filter((a) => a.active).length})
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {ambassadors.map((a) => (
          <li key={a.email} className="flex flex-wrap items-center gap-2">
            <strong>{a.name}</strong> {a.email} · {a.area}{" "}
            {a.trusted ? "· trusted" : ""} {a.active ? "" : "· retired"}
            {a.active && (
              <button
                type="button"
                onClick={() => void send({ action: "retire", email: a.email })}
                className="text-xs underline"
              >
                retire
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ action: "invite", ...f });
        }}
      >
        <input
          data-testid="invite-email"
          required
          placeholder="Their Passport sign-in email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          className="min-h-10 rounded-full border border-black/20 px-4 text-sm"
        />
        <input
          data-testid="invite-name"
          required
          placeholder="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          className="min-h-10 rounded-full border border-black/20 px-4 text-sm"
        />
        <input
          placeholder="Area"
          value={f.area}
          onChange={(e) => setF({ ...f, area: e.target.value })}
          className="min-h-10 rounded-full border border-black/20 px-4 text-sm"
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={f.trusted}
            onChange={(e) => setF({ ...f, trusted: e.target.checked })}
          />{" "}
          trusted (publishes checked listings directly, reviews)
        </label>
        <button
          type="submit"
          data-testid="invite-send"
          className="min-h-10 rounded-full bg-black px-4 text-sm font-semibold text-white"
        >
          Invite
        </button>
      </form>
      <p className="mt-2 text-xs text-black/50">
        They sign in to Go Have a Day with that email (and verify it), then open
        /ambassadors.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

function Profile({ me }: { me: Me }) {
  const router = useRouter();
  const [f, setF] = useState({ name: me.name, area: me.area, bio: me.bio });
  const [saved, setSaved] = useState(false);
  return (
    <section aria-label="Your profile" data-testid="ambassador-profile">
      <h2 className={h2}>Your local profile</h2>
      <form
        className="mt-3 flex max-w-xl flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await post("/api/insiders/ambassadors", {
            action: "profile",
            ...f,
          });
          setSaved(!err);
          router.refresh();
        }}
      >
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          className="min-h-10 rounded-full border border-black/20 px-4 text-sm"
          aria-label="Name"
        />
        <input
          value={f.area}
          onChange={(e) => setF({ ...f, area: e.target.value })}
          className="min-h-10 rounded-full border border-black/20 px-4 text-sm"
          aria-label="Area"
        />
        <textarea
          value={f.bio}
          onChange={(e) => setF({ ...f, bio: e.target.value })}
          rows={3}
          placeholder="What you're into, what you know about"
          className="rounded-xl border border-black/20 px-3 py-2 text-sm"
          aria-label="About you"
        />
        <button
          type="submit"
          className="min-h-10 self-start rounded-full bg-black px-4 text-sm font-semibold text-white"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </form>
    </section>
  );
}

function Watch({
  watch,
}: {
  watch: readonly {
    id: string;
    title: string;
    url: string;
    daysSinceChecked: number;
  }[];
}) {
  const router = useRouter();
  return (
    <section aria-label="Watch list" data-testid="watch-list">
      <h2 className={h2}>Watch for the next one</h2>
      <p className="mt-1 text-sm text-black/60">
        No date announced yet. Open the page; if there&apos;s a new date, add it
        to the listing with the page it&apos;s on. If not, mark it checked.
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {watch.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-2">
            <strong>{w.title}</strong>
            <a
              href={w.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              open the page
            </a>
            <span className="text-black/50">
              checked {w.daysSinceChecked} days ago
            </span>
            <button
              type="button"
              className="text-xs underline"
              onClick={async () => {
                await post(
                  `/api/insiders/listings/${encodeURIComponent(w.id)}`,
                  {
                    action: "edit",
                    change: {},
                  },
                );
                router.refresh();
              }}
            >
              checked today, nothing new
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
