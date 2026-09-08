"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Link2, UserMinus, Users } from "lucide-react";
import type { BoardRole } from "@/lib/collaboration/boardAccess";

/**
 * **Sharing a board: one link, and a list of who is on it.**
 *
 * No email field, no contact picker, no pending-invitation inbox. A person
 * copies a URL and sends it however they already talk to whoever they are
 * sharing with — the only mechanism that works the same on a phone, a laptop,
 * and whatever client comes next.
 */
interface Member {
  readonly userId: string;
  readonly role: BoardRole;
  readonly displayName: string;
  readonly isYou: boolean;
}

interface Invite {
  readonly token: string;
  readonly role: "editor" | "viewer";
}

export function ShareBoard({
  boardId,
  role,
}: {
  boardId: string;
  role: BoardRole;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  const isOwner = role === "owner";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/boards/${boardId}/members`);
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.json();
        if (!cancelled) setMembers(body.members ?? []);
      } catch {
        // Sharing is additive: a board still works perfectly as a private one
        // if this cannot be read, so the section hides rather than erroring at
        // somebody who only wanted to look at their saved places.
        if (!cancelled) setAvailable(false);
      }

      if (!isOwner) return;
      try {
        const response = await fetch(`/api/boards/${boardId}/invites`);
        if (response.ok && !cancelled) setInvites(await response.json());
      } catch {
        /* same reasoning */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, isOwner]);

  async function createLink(inviteRole: "editor" | "viewer") {
    setCreating(true);
    try {
      const response = await fetch(`/api/boards/${boardId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const invite: Invite = await response.json();
      setInvites((prev) => [invite, ...prev]);
      await copy(invite.token);
    } catch {
      toast.error("Couldn't make a link. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      toast.success("Link copied. Send it to whoever you like.");
      setTimeout(() => setCopied(null), 2500);
    } catch {
      // Clipboard permission is refusable, and on iOS Safari it is refused
      // often enough that "copied!" with nothing on the clipboard is a real
      // failure mode. Show the URL so it can be selected by hand.
      toast("Copy this link", { description: url, duration: 20000 });
    }
  }

  async function revoke(token: string) {
    setInvites((prev) => prev.filter((i) => i.token !== token));
    try {
      await fetch(
        `/api/boards/${boardId}/invites?token=${encodeURIComponent(token)}`,
        { method: "DELETE" },
      );
    } catch {
      toast.error("Couldn't turn that link off. Please try again.");
    }
  }

  async function remove(userId: string) {
    const previous = members;
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    try {
      const response = await fetch(
        `/api/boards/${boardId}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setMembers(previous);
      toast.error("Couldn't remove them. Please try again.");
    }
  }

  if (!available) return null;

  return (
    <section
      className="rounded-2xl border border-[#8a5a24]/20 bg-white/50 p-5"
      aria-labelledby="share-heading"
    >
      <h2
        id="share-heading"
        className="flex items-center gap-2 font-serif text-lg text-[#2c1f10]"
      >
        <Users className="h-4 w-4 text-[#8a5a24]" aria-hidden />
        Who&apos;s on this board
      </h2>

      {members.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex min-h-11 items-center justify-between gap-3 text-sm"
            >
              <span className="text-[#3b2a17]">
                {member.displayName}
                {member.isYou && <span className="text-[#8a7a60]"> (you)</span>}
                <span className="ml-2 text-xs text-[#8a7a60]">
                  {member.role}
                </span>
              </span>
              {isOwner && !member.isYou && (
                <button
                  type="button"
                  onClick={() => remove(member.userId)}
                  aria-label={`Remove ${member.displayName}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#8a7a60] hover:bg-[#8a5a24]/10"
                >
                  <UserMinus className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => createLink("editor")}
              disabled={creating}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#8a5a24] px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Link that can edit
            </button>
            <button
              type="button"
              onClick={() => createLink("viewer")}
              disabled={creating}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#8a5a24]/30 px-4 text-sm font-medium text-[#8a5a24] disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Link that can view
            </button>
          </div>

          {invites.length > 0 && (
            <ul className="flex flex-col gap-1">
              {invites.map((invite) => (
                <li
                  key={invite.token}
                  className="flex min-h-11 items-center justify-between gap-2 text-sm"
                >
                  <span className="text-[#6b5637]">
                    A {invite.role} link is active
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copy(invite.token)}
                      aria-label="Copy this link"
                      className="flex h-11 w-11 items-center justify-center rounded-full text-[#8a5a24] hover:bg-[#8a5a24]/10"
                    >
                      {copied === invite.token ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(invite.token)}
                      className="min-h-11 rounded-full px-3 text-xs text-[#8a7a60] hover:bg-[#8a5a24]/10"
                    >
                      Turn off
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#6b5637]">
          {role === "editor"
            ? "You can add and remove places on this board."
            : "You can see what's on this board."}
        </p>
      )}
    </section>
  );
}
