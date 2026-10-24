"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Link2, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InviteView, MemberView } from "@/lib/adventures/store";
import { usesLabel } from "@/lib/adventures/present";

/**
 * **Who's going, and how somebody new gets in.**
 *
 * The same panel for every kind of adventure. Invitations are links and
 * nothing more: no email field, no contacts, no inbox. Copy it, send it
 * however you already talk to that person. A link is for one person unless
 * the owner makes an open one for a group chat.
 *
 * Nobody's user id is here — people are member ids, random per adventure.
 */
export function AdventurePeople({
  adventureId,
  isOwner,
  members,
  you,
  invites,
}: {
  adventureId: string;
  isOwner: boolean;
  members: readonly MemberView[];
  you: MemberView;
  /** Live links, read by the page for an owner; empty for anyone else. */
  invites: readonly InviteView[];
}) {
  const router = useRouter();
  const [fresh, setFresh] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function makeLink(open: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`/api/adventures/${adventureId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(open ? { maxUses: null, label: "Open link" } : {}),
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json();
      const url = `${window.location.origin}${body.path}`;
      setFresh({ id: body.invite.id, url });
      await copy(url);
      router.refresh();
    } catch {
      toast.error("Couldn't make a link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Send it to whoever's coming.");
    } catch {
      // Clipboard can be refused (often, on iOS). The link is on screen.
    }
  }

  async function revoke(inviteId: string) {
    const response = await fetch(
      `/api/adventures/${adventureId}/invites?invite=${encodeURIComponent(inviteId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      toast.error("Couldn't turn that link off.");
      return;
    }
    if (fresh?.id === inviteId) setFresh(null);
    router.refresh();
  }

  async function remove(member: MemberView) {
    const response = await fetch(
      `/api/adventures/${adventureId}/members/${encodeURIComponent(member.memberId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      toast.error(`Couldn't take ${member.displayName} off.`);
      return;
    }
    toast.success(`${member.displayName} is off this one.`);
    router.refresh();
  }

  async function leave() {
    const response = await fetch(`/api/adventures/${adventureId}/members/me`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Couldn't take you off just now.");
      return;
    }
    router.push("/adventures");
    router.refresh();
  }

  async function setListed(listed: boolean) {
    const response = await fetch(`/api/adventures/${adventureId}/members/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: listed ? "members" : "hidden" }),
    });
    if (!response.ok) toast.error("Couldn't change that.");
    router.refresh();
  }

  return (
    <section aria-labelledby="people-heading" className="space-y-4">
      <h2
        id="people-heading"
        className="ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl"
      >
        Who&apos;s going
      </h2>

      <ul
        className="divide-y divide-[var(--gh-line)] rounded-3xl border border-[var(--gh-line)] bg-white"
        aria-label="Members"
      >
        {members.map((member) => (
          <li
            key={member.memberId}
            className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 text-base"
          >
            <span>
              {member.displayName}
              {member.isYou && (
                <span className="text-muted-foreground"> (you)</span>
              )}
              {member.role === "owner" && (
                <span className="text-muted-foreground"> · started it</span>
              )}
              {member.visibility === "hidden" && (
                <span className="text-muted-foreground"> · unlisted</span>
              )}
            </span>
            {isOwner && member.role !== "owner" && (
              <button
                type="button"
                onClick={() => remove(member)}
                className="text-muted-foreground hover:text-destructive inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold"
                aria-label={`Remove ${member.displayName}`}
              >
                <UserMinus className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {!isOwner && (
        <p className="text-muted-foreground text-xs">
          Only people who chose to be listed are shown to the group.
        </p>
      )}

      {you.role !== "owner" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={you.visibility === "members"}
              onChange={(e) => setListed(e.target.checked)}
            />
            Show me to the others
          </label>
          {confirmLeave ? (
            <span className="inline-flex items-center gap-2">
              Leave this one?
              <Button size="lg" variant="destructive" onClick={leave}>
                Yes, leave
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => setConfirmLeave(false)}
              >
                Stay
              </Button>
            </span>
          ) : (
            <Button
              size="lg"
              variant="ghost"
              onClick={() => setConfirmLeave(true)}
            >
              Leave
            </Button>
          )}
        </div>
      )}

      {isOwner && (
        <div className="space-y-3 rounded-3xl bg-[var(--gh-cream)] p-5">
          <p className="ghad-display text-xl font-extrabold">
            Invite people — send them a link
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => makeLink(false)} disabled={busy}>
              <Link2 className="h-4 w-4" aria-hidden />
              Link for one person
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => makeLink(true)}
              disabled={busy}
            >
              Open link for a group chat
            </Button>
          </div>

          {fresh && (
            <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-2">
              <code
                className="flex-1 text-xs break-all"
                data-testid="invite-url"
              >
                {fresh.url}
              </code>
              <Button size="lg" variant="ghost" onClick={() => copy(fresh.url)}>
                <Copy className="h-4 w-4" aria-hidden />
                Copy
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            You see a link once; Passport keeps only a fingerprint of it.
            Somebody holding a link learns only what kind of adventure it&apos;s
            for — never its name or who&apos;s in.
          </p>

          {invites.length > 0 && (
            <ul className="space-y-1 text-sm" aria-label="Live links">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-muted-foreground">
                    {invite.label ?? "Link"} ·{" "}
                    {usesLabel(invite.maxUses, invite.uses)}
                  </span>
                  <button
                    type="button"
                    onClick={() => revoke(invite.id)}
                    aria-label={`Turn off ${invite.label ?? "link"} (${usesLabel(invite.maxUses, invite.uses)})`}
                    className="text-muted-foreground hover:text-destructive inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Turn off
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
