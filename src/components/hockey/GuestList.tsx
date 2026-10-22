"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, UserMinus } from "lucide-react";
import { Avatar, SectionHead, Surface } from "@/experience-lab/ui/atoms";
import type { SharedNight } from "./useSharedNight";

interface InviteView {
  readonly id: string;
  readonly label: string | null;
  readonly uses: number;
  readonly maxUses: number;
  readonly expiresAt: string | null;
  readonly revoked: boolean;
}

function statusOf(invite: InviteView): string {
  if (invite.revoked) return "revoked";
  if (invite.uses >= invite.maxUses) return "used";
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date())
    return "expired";
  return "waiting";
}

/**
 * **The host's one management surface, and it is a guest list.**
 *
 * The lab found that every admin affordance made the night feel like software,
 * so this is kept to the two things a real host genuinely has to do — let a
 * person in, and take one out — and put at the bottom of the page.
 *
 * One link, one person, once. A link pasted into a group chat lets in the
 * first person who taps it and nobody after; that is the point, and the copy
 * says so, because a hidden URL is not who-gets-in.
 */
export function GuestList({ night }: { night: SharedNight }) {
  const id = night.state.slug;
  const [invites, setInvites] = useState<InviteView[]>([]);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<{ url: string; label: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/hockey/api/occasions/${id}/invites`, {
      cache: "no-store",
    });
    if (res.ok) setInvites(await res.json());
  }, [id]);

  // The list arrives after mount, from the network — the "external system"
  // case effects exist for — so state is set in the promise, not the body.
  useEffect(() => {
    let current = true;
    fetch(`/hockey/api/occasions/${id}/invites`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((list: InviteView[]) => {
        if (current) setInvites(list);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [id]);

  async function makeLink() {
    setBusy(true);
    try {
      const res = await fetch(`/hockey/api/occasions/${id}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      if (!res.ok) return;
      const { token } = (await res.json()) as { token: string };
      setFresh({
        url: `${window.location.origin}/hockey/join/${token}`,
        label: label.trim(),
      });
      setCopied(false);
      setLabel("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    await fetch(`/hockey/api/occasions/${id}/invites?invite=${inviteId}`, {
      method: "DELETE",
    });
    await load();
  }

  async function remove(userId: string) {
    await fetch(`/hockey/api/occasions/${id}/members/${userId}`, {
      method: "DELETE",
    });
    setConfirming(null);
    await night.refresh();
  }

  const guests = night.live.participants.filter(
    (p) => p.id !== night.definition.hostId,
  );
  const open = invites.filter((i) => statusOf(i) === "waiting");
  // A link already waiting for somebody means they have been asked.
  const asked = new Set(open.map((i) => i.label));
  const crew = (night.series?.crew ?? []).filter(
    (p) =>
      !asked.has(p.name) && !night.live.participants.some((q) => q.id === p.id),
  );

  return (
    <section id="guest-list" aria-label="Guest list" className="scroll-mt-4">
      <SectionHead
        title="The guest list"
        subtitle="Only you see this. Each link lets in one person, once — send it to them, not to the group chat."
      />
      <Surface>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void makeLink();
          }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            placeholder="Who's it for? (a note for you)"
            aria-label="Who the invitation is for"
            className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-[16px] text-white placeholder:text-white/45 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-medium text-black disabled:opacity-40"
          >
            <Link2 className="h-4 w-4" />
            Make a link
          </button>
        </form>

        {crew.length > 0 && (
          <div className="mt-3">
            <p className="text-[14px] text-white/65">
              Last time&apos;s crew. Tap a name, then make their link — they
              still have to say yes.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {crew.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setLabel(p.name)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 px-3 text-[14.5px] text-white/80 hover:border-white/50"
                  >
                    <Avatar person={p} size={20} />
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fresh && (
          <div className="mt-3 rounded-xl border border-white/20 bg-white/[0.06] p-3">
            <p className="text-[14px] text-white/60">
              {fresh.label ? `For ${fresh.label}. ` : ""}This is the only time
              Passport will show it. Lose it and just make another.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code
                data-testid="invite-url"
                className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-2.5 py-1.5 text-[14px] text-white/90"
              >
                {fresh.url}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(fresh.url);
                  setCopied(true);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1.5 text-[14px]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {open.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3">
            {open.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between text-[15px]"
              >
                <span className="text-white/70">
                  {invite.label ?? "Unlabelled link"}{" "}
                  <span className="text-white/35">
                    · hasn&apos;t been opened
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void revoke(invite.id)}
                  className="text-[14px] text-white/65 hover:text-white"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}

        {guests.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3">
            {guests.map((guest) => (
              <li
                key={guest.id}
                className="flex items-center justify-between gap-3 text-[14px]"
              >
                <span className="flex items-center gap-2">
                  <Avatar person={guest} size={24} />
                  {guest.name}
                </span>
                {confirming === guest.id ? (
                  <span className="flex items-center gap-2 text-[14px]">
                    <span className="text-white/55">
                      They lose the page now, picks and all.
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove(guest.id)}
                      className="rounded-full bg-white px-2.5 py-1 font-medium text-black"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="text-white/65"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(guest.id)}
                    aria-label={`Remove ${guest.name}`}
                    className="inline-flex items-center gap-1 text-[14px] text-white/60 hover:text-white"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </section>
  );
}
