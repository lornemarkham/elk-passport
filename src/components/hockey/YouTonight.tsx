"use client";

import { useState } from "react";
import { Avatar } from "@/experience-lab/ui/atoms";
import { EMOJI } from "@/domain/hockey/identity";
import type { SharedNight } from "./useSharedNight";

/**
 * **How you show up.**
 *
 * The lab's participants had a vibe line — "Refuses to walk more than 8
 * minutes", "Suspiciously knows hockey" — and it did more for the page than
 * any avatar. Real people get to write their own. Collapsed by default: it is
 * a thing you do once, not a thing that should sit on the page.
 */
export function YouTonight({ night }: { night: SharedNight }) {
  const me = night.live.me;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(me?.name ?? "");
  const [emoji, setEmoji] = useState(me?.emoji ?? "🙂");
  const [vibe, setVibe] = useState(me?.vibe ?? "");
  const [leaving, setLeaving] = useState(false);

  if (!me) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(me.name);
          setEmoji(me.emoji);
          setVibe(me.vibe ?? "");
          setOpen(true);
        }}
        className="flex items-center gap-2 self-start text-[13px] text-white/45 hover:text-white"
      >
        <Avatar person={me} size={22} />
        {me.vibe ? `“${me.vibe}”` : "Tell the group who you are tonight"}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-white/15 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void night.send({
          type: "setMe",
          name: name.trim() || me.name,
          emoji,
          vibe: vibe.trim() || undefined,
        });
        setOpen(false);
      }}
    >
      <p className="text-[14px] font-medium">You, tonight</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        aria-label="Your name"
        className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[14px] text-white focus:border-white/40 focus:outline-none"
      />
      <input
        value={vibe}
        onChange={(e) => setVibe(e.target.value)}
        maxLength={80}
        placeholder="One line. e.g. Will explain icing whether asked or not"
        aria-label="Your vibe"
        className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[14px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
      />
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Your emoji"
      >
        {EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={e === emoji}
            onClick={() => setEmoji(e)}
            className={`h-9 w-9 rounded-full text-[18px] ${e === emoji ? "bg-white/25 ring-1 ring-white" : "bg-white/5"}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="submit"
          className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-black"
        >
          Save
        </button>
        {night.role === "guest" &&
          (leaving ? (
            <span className="flex items-center gap-2 text-[12.5px]">
              <span className="text-white/55">
                Leave? Your picks go with you.
              </span>
              <button
                type="button"
                className="rounded-full bg-white px-2.5 py-1 font-medium text-black"
                onClick={async () => {
                  await fetch(
                    `/hockey/api/occasions/${night.state.slug}/members/${me.id}`,
                    { method: "DELETE" },
                  );
                  window.location.href = "/hockey";
                }}
              >
                Leave
              </button>
              <button
                type="button"
                className="text-white/45"
                onClick={() => setLeaving(false)}
              >
                Stay
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setLeaving(true)}
              className="text-[12.5px] text-white/40"
            >
              Leave this night
            </button>
          ))}
      </div>
    </form>
  );
}
