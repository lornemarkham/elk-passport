"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Flag, Home, Plus, Share2, Trash2 } from "lucide-react";
import {
  CHECKS,
  REPORTS,
  type CheckId,
  type PinView,
  type ReportId,
} from "@/domain/christmas/lights/model";
import { send, signInHref } from "./api";
import { toggleStash, useStash } from "./stash";

/** Add to tour and share: the two things a family does most. */
export function TourAndShare({ pin }: { readonly pin: PinView }) {
  const stash = useStash();
  const on = stash.includes(pin.id);
  const [said, setSaid] = useState<string | null>(null);
  async function share() {
    const url = `${location.origin}/christmas/lights/${pin.id}`;
    const text = `${pin.name} — on the Christmas Lights Map`;
    try {
      if (navigator.share) {
        await navigator.share({ title: pin.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid("Link copied — paste it to the family chat.");
    } catch {
      setSaid(url);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pin.status === "approved" && (
        <button
          type="button"
          onClick={() => toggleStash(pin.id)}
          aria-pressed={on}
          data-testid="detail-add-to-tour"
          className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-extrabold ${on ? "bg-[#0f3b2b] text-white" : "bg-[#ffd98a] text-[#082319]"}`}
        >
          {on ? (
            <Check className="h-5 w-5" aria-hidden />
          ) : (
            <Plus className="h-5 w-5" aria-hidden />
          )}
          {on ? "On my tour" : "Add to my Christmas tour"}
        </button>
      )}
      {on && (
        <Link
          href="/christmas/lights/tour"
          className="inline-flex min-h-12 items-center rounded-full px-5 font-bold text-[#082319] ring-1 ring-[#0f3b2b]/25"
        >
          Build the tour →
        </Link>
      )}
      {pin.status === "approved" && (
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-bold text-[#082319] ring-1 ring-[#0f3b2b]/25"
        >
          <Share2 className="h-5 w-5" aria-hidden /> Share
        </button>
      )}
      {said && (
        <p className="w-full text-sm text-[#3d4a43]" role="status">
          {said}
        </p>
      )}
    </div>
  );
}

/** Keep displays current: what a family saw tonight. */
export function Checks({
  pin,
  signedIn,
}: {
  readonly pin: PinView;
  readonly signedIn: boolean;
}) {
  const router = useRouter();
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function tell(what: CheckId) {
    setBusy(true);
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "check",
      what,
    });
    setBusy(false);
    if (r.ok) {
      setSay(
        what === "on"
          ? "💡 Thank you! It's marked lit this season."
          : "Thanks — that helps the next family.",
      );
      router.refresh();
    } else setSay(r.error ?? "That didn't work.");
  }
  if (pin.status !== "approved") return null;
  return (
    <section
      className="rounded-[24px] bg-white p-5 shadow-[0_6px_24px_rgba(8,35,25,0.08)]"
      data-testid="checks"
    >
      <h2 className="ghad-display text-xl font-extrabold text-[#082319]">
        Been by lately?
      </h2>
      <p className="text-sm text-[#3d4a43]">
        Tell the next family what you saw. It keeps the map true this season.
      </p>
      {signedIn ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {CHECKS.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => void tell(c.id)}
              data-testid={`check-${c.id}`}
              className={`min-h-11 rounded-full px-4 text-sm font-bold ${c.id === "on" ? "bg-[#ffd98a] text-[#082319]" : "text-[#082319] ring-1 ring-[#0f3b2b]/20"}`}
            >
              {c.id === "on" ? "💡 " : ""}
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm">
          <Link
            className="font-bold underline"
            href={signInHref(`/christmas/lights/${pin.id}`)}
          >
            Sign in
          </Link>{" "}
          to say what you saw.
        </p>
      )}
      {say && (
        <p className="mt-2 text-sm font-bold text-[#0f3b2b]" role="status">
          {say}
        </p>
      )}
    </section>
  );
}

/** Something wrong? Anyone, signed in or not. And remove, for whoever pinned it. */
export function ReportAndRemove({ pin }: { readonly pin: PinView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportId>("wrong");
  const [text, setText] = useState("");
  const [say, setSay] = useState<string | null>(null);
  async function sendReport() {
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "report",
      reason,
      text,
    });
    if (r.ok) {
      setOpen(false);
      setSay("Thanks — the administrator will look at it.");
    } else setSay(r.error ?? "That didn't send.");
  }
  async function removeIt() {
    if (!confirm("Remove this pin for good? Its photo goes too.")) return;
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "remove",
    });
    if (r.ok) router.push("/christmas/lights");
    else setSay(r.error ?? "That didn't work.");
  }
  return (
    <section className="text-sm text-[#3d4a43]" data-testid="report">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold ring-1 ring-[#0f3b2b]/20"
          data-testid="report-open"
        >
          <Flag className="h-4 w-4" aria-hidden /> Something wrong?
        </button>
        {pin.yours && (
          <button
            type="button"
            onClick={() => void removeIt()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold text-[#b3242f] ring-1 ring-[#b3242f]/30"
            data-testid="remove-pin"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Remove my pin
          </button>
        )}
      </div>
      {open && (
        <form
          className="mt-3 space-y-3 rounded-[20px] bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendReport();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="font-bold text-[#082319]">
              What&apos;s wrong?
            </legend>
            {REPORTS.filter((r) => r.id !== "privacy").map((r) => (
              <label key={r.id} className="flex min-h-10 items-center gap-2">
                <input
                  type="radio"
                  name="reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="font-bold text-[#082319]">
              Anything to add? (optional)
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-2"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-[#082319] px-5 font-bold text-white"
            data-testid="report-send"
          >
            Send
          </button>
        </form>
      )}
      {say && (
        <p className="mt-2 font-bold text-[#0f3b2b]" role="status">
          {say}
        </p>
      )}
    </section>
  );
}

/**
 * **"Is this your home? Request removal."** Prominent on every listing, open
 * to anyone, no account and no proof asked. Sending it hides the listing
 * from everybody straight away; the administrator is told, and later removes
 * it for good or resolves a dispute.
 */
export function RequestRemoval({ pin }: { readonly pin: PinView }) {
  // The map's "Request removal" link lands here with #removal: open at once.
  const fromLink = useSyncExternalStore(
    () => () => undefined,
    () => location.hash === "#removal",
    () => false,
  );
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? fromLink;
  const setOpen = (f: (o: boolean) => boolean) => setToggled(f(open));
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "request-removal",
      text,
      contact,
    });
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(r.error ?? "That didn't send — try again.");
  }
  if (done)
    return (
      <section
        id="removal"
        className="rounded-[20px] bg-[#e8f3ec] p-4 font-bold text-[#082319]"
        role="status"
        data-testid="removal-done"
      >
        Done — this listing is hidden from the map now. The administrator has
        been told and will remove it for good, or contact you if you left a way
        to reach you. You don&apos;t need to do anything else.
      </section>
    );
  return (
    <section
      id="removal"
      className="rounded-[20px] bg-[#fff1ef] p-4 ring-2 ring-[#b3242f]/40"
      data-testid="removal"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 text-left text-lg font-extrabold text-[#b3242f]"
        data-testid="removal-open"
      >
        <Home className="h-5 w-5 shrink-0" aria-hidden /> Is this your home?
        Request removal
      </button>
      {!open && (
        <p className="mt-1 text-sm text-[#3d4a43]">
          No account, no proof needed. It comes off the map immediately.
        </p>
      )}
      {open && (
        <form
          className="mt-3 space-y-3 text-sm text-[#082319]"
          onSubmit={(e) => {
            e.preventDefault();
            void go();
          }}
        >
          <p>
            If this is your home, or you have a privacy concern, say so and
            we&apos;ll <strong>hide it from the map right away</strong>.
            There&apos;s nothing to prove first — the administrator reviews it
            afterwards and removes it permanently.
          </p>
          <label className="block">
            <span className="font-bold">
              Anything we should know? (optional)
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-2 text-base"
              data-testid="removal-text"
            />
          </label>
          <label className="block">
            <span className="font-bold">
              Email or phone, if you&apos;d like a reply (optional)
            </span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={120}
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-2 text-base"
              data-testid="removal-contact"
            />
            <span className="text-xs text-[#5b4a2e]">
              Seen only by the administrator and erased when the listing is
              deleted.
            </span>
          </label>
          {error && (
            <p className="font-bold text-[#b3242f]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-full bg-[#b3242f] px-6 font-extrabold text-white disabled:opacity-60"
            data-testid="removal-send"
          >
            {busy ? "Hiding it…" : "Hide this listing now"}
          </button>
        </form>
      )}
    </section>
  );
}
