"use client";

import { Avatar } from "./atoms";
import type { ExperienceDefinition, Participant } from "../core/types";

/**
 * **The thirty seconds that decide everything.**
 *
 * Someone taps a link in Slack. They have never heard of Passport. This
 * screen has one job: make joining cost one tap and put something to *do*
 * immediately behind it. There is no account, no explanation of what Passport
 * is, and no description of the feature set — those are all things people
 * skip, and they are all things a person can infer in about four seconds from
 * the page behind this one.
 *
 * The list is the invite list. Claiming a name is how a real Slack invite
 * behaves, and it is a deliberately weak identity — see README on what
 * replaces it.
 */
export function JoinGate({
  definition,
  participants,
  onJoin,
  onLurk,
}: {
  definition: ExperienceDefinition;
  participants: readonly Participant[];
  onJoin: (id: string) => void;
  onLurk: () => void;
}) {
  const host = participants.find((p) => p.id === definition.hostId);

  return (
    <div className="mx-auto max-w-2xl px-5 pb-10">
      <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5">
        <p className="text-[15.5px] text-white/75">
          {definition.inviteLine ?? (
            <>
              <span className="font-semibold text-white">{host?.name}</span>{" "}
              invited you to {definition.title}.
            </>
          )}
        </p>
        <p className="mt-1.5 text-[14px] text-white/50">
          Which one are you? One tap, no account.
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {participants.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onJoin(person.id)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/12 px-3 py-2.5 text-left transition hover:border-white/50 hover:bg-white/[0.06]"
              >
                <Avatar person={person} size={32} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-white">
                    {person.name}
                  </span>
                  {person.vibe && (
                    <span className="block truncate text-[12px] text-white/45">
                      {person.vibe}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onLurk}
          className="mt-4 text-[13px] text-white/40 underline-offset-4 hover:text-white/70 hover:underline"
        >
          Just looking, thanks
        </button>
      </div>
    </div>
  );
}
