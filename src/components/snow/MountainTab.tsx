"use client";

import { useEffect, useState } from "react";
import {
  TOPIC_LABEL,
  chosenFor,
  personName,
  proposalsFor,
  undecided,
} from "@/domain/snow/day";
import { ABILITY_LABEL, groupCeiling, groupLine } from "@/domain/snow/ability";
import { mountainById, MOUNTAINS } from "@/domain/snow/mountains";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, Source, btn, field } from "./kit";

const QUICK = [
  "Heading to the lodge for a food break",
  "Back on the hill — meet at the lift base in 20",
  "Last run! Everyone down together",
  "Heading to the car",
] as const;

/**
 * **On the hill: coordination without pulling anyone out of the day.**
 *
 * Meeting points, quick updates, a "where I am" in words and a card that
 * works with no signal. Location here is a *label a person types or taps* —
 * Passport reads no GPS on the hill and never claims to know where anyone is.
 */
export function MountainTab({ day, me, act, now }: TabProps) {
  const [spot, setSpot] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const meet = chosenFor(day, "meeting");
  const spots = proposalsFor(day, "meeting");
  const mountain = chosenFor(day, "mountain");
  const known = mountainById(
    MOUNTAINS.find((m) => m.name === mountain?.label)?.id,
  );
  const meal = chosenFor(day, "meals");
  const mine = day.checkIns.find((c) => c.personId === me.id);
  const open = undecided(day);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reads the browser */
    setOffline(!navigator.onLine);
  }, [now]);

  async function shareSpot(text: string) {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied("Copied — paste it in your crew's group chat.");
      }
    } catch {
      setCopied("Couldn't share from here.");
    }
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      {offline && (
        <p
          role="status"
          className="rounded-xl border border-[var(--sn-aurora)] p-3 text-sm"
        >
          No signal. This page still works and saves on your phone. Updates
          reach the crew when you share them.
        </p>
      )}
      <Card className="space-y-2" data-testid="hill-card">
        <h2 className="text-xl font-extrabold">Today at a glance</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--sn-frost)]">Mountain</dt>
            <dd className="font-semibold">{mountain?.label ?? "not chosen"}</dd>
          </div>
          <div>
            <dt className="text-[var(--sn-frost)]">Meet</dt>
            <dd className="font-semibold">
              {[meet?.label, day.meetTime].filter(Boolean).join(" at ") ||
                "not set"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--sn-frost)]">Food break</dt>
            <dd className="font-semibold">{meal?.label ?? "not set"}</dd>
          </div>
          <div>
            <dt className="text-[var(--sn-frost)]">Riding level</dt>
            <dd className="font-semibold">
              {(() => {
                const c = groupCeiling(day.people);
                return c ? ABILITY_LABEL[c] : "lodge day";
              })()}
            </dd>
          </div>
        </dl>
        {open.length > 0 && (
          <p className="text-sm text-[var(--sn-glow)]">
            Still undecided:{" "}
            {open.map((t) => TOPIC_LABEL[t].toLowerCase()).join(", ")}.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {known && (
            <a
              className={`${btn} inline-flex items-center`}
              href={known.site}
              target="_blank"
              rel="noreferrer"
            >
              Snow report &amp; lift status ↗
            </a>
          )}
          <button className={btn} onClick={() => window.print()}>
            Print this card
          </button>
        </div>
        <p className="text-sm text-[var(--sn-frost)]">
          {groupLine(day.people)}
        </p>
        <p className="flex flex-wrap gap-2 text-xs">
          <Source kind="missing">
            snow &amp; lifts: the resort&apos;s own report
          </Source>
        </p>
        <p className="text-xs text-[var(--sn-frost)]">
          Find the ski patrol number on the resort&apos;s trail map and save it
          now.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">Tell the crew where you are</h2>
        <p className="text-sm text-[var(--sn-frost)]">
          A few words, not a map pin. Passport doesn&apos;t read your location
          on the mountain, and no precise position leaves your phone.
        </p>
        <div className="flex flex-wrap gap-2">
          {spots.map((s) => (
            <button
              key={s.id}
              className={btn}
              onClick={() =>
                act({ type: "checkIn", personId: me.id, spot: s.label })
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (act({ type: "checkIn", personId: me.id, spot })) setSpot("");
          }}
        >
          <input
            className={`${field} flex-1`}
            value={spot}
            onChange={(e) => setSpot(e.target.value)}
            placeholder="Chair 2 base, café line"
            aria-label="Where you are"
            maxLength={60}
          />
          <button className={btn} type="submit">
            I&apos;m here
          </button>
        </form>
        {mine && (
          <p className="text-sm" data-testid="my-checkin">
            You said: <strong>{mine.spot}</strong> at {when(mine.at)}.{" "}
            <button
              className="underline"
              onClick={() =>
                shareSpot(`${me.name} is at ${mine.spot} (${when(mine.at)})`)
              }
            >
              Send to the crew
            </button>{" "}
            ·{" "}
            <button
              className="underline"
              onClick={() => act({ type: "checkOut", personId: me.id })}
            >
              Clear
            </button>
          </p>
        )}
        <ul className="space-y-1 text-sm" data-testid="checkins">
          {day.checkIns
            .filter((c) => c.personId !== me.id)
            .map((c) => (
              <li key={c.personId}>
                {personName(day, c.personId)} — {c.spot}{" "}
                <span className="text-[var(--sn-frost)]">({when(c.at)})</span>
              </li>
            ))}
        </ul>
        {copied && (
          <p role="status" className="text-sm">
            {copied}
          </p>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-xl font-extrabold">Quick updates</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              className={btn}
              onClick={() =>
                act({ type: "announce", id: newId(), by: me.id, text: q })
              }
            >
              {q}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--sn-frost)]">
          They land on the Crew tab. Share the plan again to reach a crew phone.
        </p>
      </Card>
    </div>
  );
}
