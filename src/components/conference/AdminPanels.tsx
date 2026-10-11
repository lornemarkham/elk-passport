"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrganiserView } from "@/domain/conference/views";
import { call } from "./api";
import { Problem, secondary, Section } from "./ui";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );

/**
 * **Ways in: the code and the links.** Both start switched off. A conference
 * nobody can join is the safe default, and opening it is the organiser's call.
 */
export function AccessPanel({ view }: { view: OrganiserView }) {
  const router = useRouter();
  const id = view.conference.id;
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const run = async (
    method: "POST" | "DELETE",
    url: string,
    body?: unknown,
  ) => {
    setBusy(true);
    setProblem(null);
    const r = await call(method, url, body);
    setBusy(false);
    if (!r.ok) setProblem(r.message);
    router.refresh();
  };
  const linkFor = (token: string) =>
    `${window.location.origin}/conferences/join/${token}`;

  return (
    <>
      <Section
        title="Access code"
        hint="Good for a slide or an email. Anyone with it can join, so change it if it travels too far."
      >
        {view.accessCode ? (
          <p
            className="font-mono text-[28px] font-bold tracking-[0.2em]"
            data-testid="access-code"
          >
            {view.accessCode}
          </p>
        ) : (
          <p className="text-black/55">Codes are off.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={secondary}
            disabled={busy}
            onClick={() =>
              run("POST", `/api/conferences/${id}/code`, { action: "new" })
            }
          >
            {view.accessCode
              ? "New code (old one stops working)"
              : "Turn on a code"}
          </button>
          {view.accessCode ? (
            <button
              className={secondary}
              disabled={busy}
              onClick={() =>
                run("POST", `/api/conferences/${id}/code`, { action: "off" })
              }
            >
              Turn codes off
            </button>
          ) : null}
        </div>
      </Section>

      <Section
        title="Invite links"
        hint="Send one however you already talk to people. Turning one off doesn't remove anyone who used it."
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-black/15 px-3 py-2.5 text-[15px]"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Link lasts"
          >
            <option value="">Works until turned off</option>
            <option value="7">Works for 7 days</option>
            <option value="30">Works for 30 days</option>
          </select>
          <button
            className={secondary}
            disabled={busy}
            onClick={() =>
              run("POST", `/api/conferences/${id}/invites`, {
                ...(days ? { expiresInDays: Number(days) } : {}),
              })
            }
          >
            New link
          </button>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {view.invites.map((i) => (
            <li
              key={i.token}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 p-3 text-[14px]"
              data-testid="invite-link"
              data-token={i.token}
            >
              <span className="font-mono text-black/70">
                …{i.token.slice(-6)}
              </span>
              <span className="text-black/50">
                made {when(i.createdAt)} · used {i.uses}
                {i.expiresAt ? ` · until ${when(i.expiresAt)}` : ""}
                {i.state !== "valid" ? ` · ${i.state}` : ""}
              </span>
              <span className="ml-auto flex gap-2">
                <button
                  className="font-semibold underline"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(linkFor(i.token));
                    setCopied(i.token);
                  }}
                >
                  {copied === i.token ? "Copied" : "Copy link"}
                </button>
                <button
                  className="text-black/50 underline"
                  disabled={busy}
                  onClick={() =>
                    run("DELETE", `/api/conferences/${id}/invites`, {
                      token: i.token,
                    })
                  }
                >
                  Turn off
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Problem>{problem}</Problem>
    </>
  );
}

export function MembersPanel({ view }: { view: OrganiserView }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Section
      title={`Who's in · ${view.members.length}`}
      hint="Only you and other organisers see this list. Hidden people are hidden from everyone else."
    >
      <ul
        className="flex flex-col divide-y divide-black/5"
        data-testid="members"
      >
        {view.members.map((m) => (
          <li
            key={m.memberId}
            className="flex items-center gap-3 py-2.5 text-[15px]"
          >
            <span className="font-semibold">
              {m.displayName ?? "No name given"}
              {m.isYou ? " (you)" : ""}
            </span>
            <span className="text-[13px] text-black/50">
              {m.role === "organiser" ? "organiser · " : ""}
              {m.visibility === "hidden" ? "hidden" : "visible"} · joined{" "}
              {when(m.joinedAt)}
            </span>
            {!m.isYou ? (
              <button
                className="ml-auto text-[14px] text-black/50 underline"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Remove them, and everything about them here?",
                    )
                  )
                    return;
                  const r = await call(
                    "DELETE",
                    `/api/conferences/${view.conference.id}/members/${m.memberId}`,
                  );
                  if (!r.ok) setProblem(r.message);
                  router.refresh();
                }}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <Problem>{problem}</Problem>
    </Section>
  );
}

export function DangerPanel({
  conferenceId,
  name,
}: {
  conferenceId: string;
  name: string;
}) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Section
      title="Delete"
      hint="Everything goes: details, members, links, and whatever every part of it holds. It can't be undone."
    >
      <button
        className="rounded-xl border border-[#b42318]/40 px-4 py-2.5 text-[15px] font-semibold text-[#b42318]"
        onClick={async () => {
          if (
            window.prompt(`Type the name to delete it: ${name}`)?.trim() !==
            name
          )
            return;
          const r = await call("DELETE", `/api/conferences/${conferenceId}`);
          if (!r.ok) return setProblem(r.message);
          router.push("/conferences");
        }}
      >
        Delete this conference
      </button>
      <Problem>{problem}</Problem>
    </Section>
  );
}
