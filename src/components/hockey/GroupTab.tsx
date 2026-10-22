"use client";

import { Avatar } from "@/experience-lab/ui/atoms";
import { MyLimit } from "@/experience-lab/ui/CuratorSetup";
import { GuestList } from "./GuestList";
import { TonightSettings } from "./Modules";
import { YouTonight } from "./YouTonight";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

/**
 * **Group: who's coming, who you are tonight, and — for the host — the door.**
 *
 * Everything that is about the people rather than the night: the roster, your
 * name and vibe, how far you'll go, and the host's invitations and switches.
 * Moved out of the night's main column, where it read as account settings
 * at the bottom of a game.
 */
export function GroupTab({ night }: { night: SharedNight }) {
  const { live, state, role, definition } = night;
  const hostId = definition.hostId;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="whos-in">
        <h2
          id="whos-in"
          className={`${styles.wide} text-[28px] leading-none text-white`}
        >
          Who&apos;s in
        </h2>
        <p className="mt-2 text-[15px] text-white/70">
          {live.participants.length === 1
            ? role === "host"
              ? "Just you so far. A hockey night for one is a Tuesday. Invite somebody below."
              : "Just you so far."
            : `${live.participants.length} people. Everyone gets a say.`}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {live.participants.map((person) => (
            <li
              key={person.id}
              className={`flex items-center gap-3 rounded-2xl bg-[#101826] px-3 py-3 ring-1 ${
                person.id === live.me?.id
                  ? "ring-[#ffd84d]/60"
                  : "ring-white/10"
              }`}
            >
              <Avatar person={person} size={40} />
              <span className="min-w-0">
                <p className="flex items-center text-[16px] font-bold text-white">
                  <span className="truncate">{person.name}</span>
                  {person.id === hostId && (
                    <span className="ml-1.5 shrink-0 rounded-full bg-[#ffd84d] px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-[#0b1220] uppercase">
                      host
                    </span>
                  )}
                </p>
                {person.vibe && (
                  <p className="truncate text-[13px] text-white/60">
                    {person.vibe}
                  </p>
                )}
                {person.id === live.me?.id && !person.vibe && (
                  <p className="text-[13px] text-white/50">That&apos;s you</p>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <YouTonight night={night} />

      {live.me && (
        <section aria-labelledby="my-limit">
          <h2
            id="my-limit"
            className={`${styles.wide} mb-2 text-[22px] leading-none text-white`}
          >
            How far you&apos;ll go
          </h2>
          <p className="mb-3 text-[15px] text-white/70">
            Nobody sees your setting. You&apos;re never offered a dare above it.
          </p>
          <MyLimit
            nightEdge={state.brief?.edge ?? 1}
            mine={state.myEdge}
            onChange={night.setMyEdge}
          />
        </section>
      )}

      {role === "host" && <GuestList night={night} />}

      <TonightSettings night={night} />

      <p className="text-[13px] leading-relaxed text-white/50">
        Private to the people on this page. Points are bragging rights only — no
        money, no bets, nothing to settle but your dignity.
      </p>
    </div>
  );
}
