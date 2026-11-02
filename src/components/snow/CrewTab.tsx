"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ABILITIES,
  ABILITY_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  groupLine,
  type Ability,
  type Discipline,
} from "@/domain/snow/ability";
import { personName } from "@/domain/snow/day";
import { shareFragment } from "@/domain/snow/recap";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { ChatCard } from "./ChatCard";
import { Card, btn, btnOn, field, styles } from "./kit";

/** Crew: who is in, how they ride, what everyone should know. */
export function CrewTab(p: TabProps) {
  const { day, me, act, shared } = p;
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("ski");
  const [ability, setAbility] = useState<Ability>("beginner");
  const [ownGear, setOwnGear] = useState(true);
  const [note, setNote] = useState("");
  const [update, setUpdate] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function inviteCrew() {
    if (!shared) return;
    try {
      const res = await fetch(`/snow/api/${shared.id}/invite`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string };
      if (!res.ok || !body.token)
        return setCopied(
          res.status === 404
            ? "Only the host can make the invite link."
            : "Couldn't make a link just now. Try again.",
        );
      const url = `${location.origin}/snow/join?t=${body.token}`;
      if (navigator.share) await navigator.share({ title: day.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(
          "Invite link copied. It works for up to 24 people over two weeks.",
        );
      }
    } catch {
      setCopied("Couldn't share from here. Try again from the same phone.");
    }
  }

  async function sharePlan() {
    const url = `${location.origin}/snow/join#${shareFragment(day)}`;
    try {
      if (navigator.share) await navigator.share({ title: day.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(
          "Link copied. The plan travels inside the link; nothing is uploaded.",
        );
      }
    } catch {
      setCopied(
        "Couldn't share from here. Long-press the address after opening it on another phone.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">The crew</h2>
        <p className="text-sm text-[var(--sn-frost)]" data-testid="group-line">
          {groupLine(day.people)}
        </p>
        <ul className="space-y-2" data-testid="crew-list">
          {day.people.map((x) => (
            <li
              key={x.id}
              className="rounded-xl border border-[var(--sn-line)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {x.name}
                    {x.id === me.id && (
                      <span className="ml-2 text-xs text-[var(--sn-aurora)]">
                        you
                      </span>
                    )}
                    {x.id === day.people[0].id && (
                      <span className="ml-2 text-xs text-[var(--sn-glow)]">
                        host
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-[var(--sn-frost)]">
                    {DISCIPLINE_LABEL[x.discipline]}
                    {x.discipline !== "apres" &&
                      ` · ${ABILITY_LABEL[x.ability]}`}
                    {x.discipline !== "apres" &&
                      !x.ownGear &&
                      " · needs rentals"}
                  </p>
                  {x.note && <p className="text-sm">{x.note}</p>}
                </div>
                <div className="flex gap-2">
                  {x.discipline !== "apres" && (!shared || x.id === me.id) && (
                    <select
                      className={`${field} !w-auto`}
                      value={x.ability}
                      aria-label={`${x.name}'s level`}
                      onChange={(e) =>
                        act({
                          type: "updatePerson",
                          id: x.id,
                          patch: { ability: e.target.value as Ability },
                        })
                      }
                    >
                      {ABILITIES.map((a) => (
                        <option key={a} value={a}>
                          {ABILITY_LABEL[a]}
                        </option>
                      ))}
                    </select>
                  )}
                  {x.id !== day.people[0].id &&
                    (!shared || shared.isOwner || x.id === me.id) && (
                      <button
                        className={btn}
                        aria-label={
                          shared && x.id === me.id
                            ? "Leave this snow day"
                            : `Remove ${x.name}`
                        }
                        onClick={() => act({ type: "removePerson", id: x.id })}
                      >
                        ✕
                      </button>
                    )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {shared && <ChatCard {...p} />}

      {!shared && (
        <Card className="space-y-3">
          <h2 className="text-xl font-extrabold">Add someone</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                act({
                  type: "addPerson",
                  person: {
                    id: newId(),
                    name,
                    discipline,
                    ability,
                    ownGear,
                    note: note || undefined,
                  },
                })
              ) {
                setName("");
                setNote("");
              }
            }}
          >
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Their name"
              maxLength={30}
            />
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Riding"
            >
              {DISCIPLINES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={discipline === d}
                  onClick={() => setDiscipline(d)}
                  className={`${btn} ${discipline === d ? btnOn : ""}`}
                >
                  {DISCIPLINE_LABEL[d]}
                </button>
              ))}
            </div>
            {discipline !== "apres" && (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Level"
              >
                {ABILITIES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={ability === a}
                    onClick={() => setAbility(a)}
                    className={`${btn} ${ability === a ? btnOn : ""}`}
                  >
                    {ABILITY_LABEL[a]}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!ownGear}
                onChange={(e) => setOwnGear(!e.target.checked)}
                className="size-5"
              />
              Needs rental gear
            </label>
            <input
              className={field}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know? (vegetarian, nervous on lifts…)"
              aria-label="Note"
              maxLength={80}
            />
            <button
              type="submit"
              className={`${styles.go} min-h-12 rounded-full px-6 text-sm uppercase`}
            >
              Add to the crew
            </button>
          </form>
        </Card>
      )}

      {shared ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-extrabold">Bring the crew in</h2>
          <p className="text-sm text-[var(--sn-frost)]">
            {shared.isOwner
              ? "Send the invite link. Everyone who opens it signs in, picks how they ride, and lands in this same day — votes, chat, points and photos are shared live."
              : "Only the host can make invite links. Ask them, or have them send it again."}
          </p>
          {shared.isOwner && (
            <button className={btn} onClick={inviteCrew}>
              Invite the crew
            </button>
          )}
          {copied && (
            <p role="status" className="text-sm">
              {copied}
            </p>
          )}
        </Card>
      ) : (
        <Card className="space-y-3">
          <h2 className="text-xl font-extrabold">Bring the crew in</h2>
          <p className="text-sm text-[var(--sn-frost)]">
            Send the plan to everyone. It opens as a copy on their phone, where
            they add themselves. The plan travels inside the link, so nothing is
            uploaded.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={sharePlan}>
              Share the plan
            </button>
            <Link
              className={`${btn} inline-flex items-center`}
              href={`/adventures/new?name=${encodeURIComponent(day.title)}`}
            >
              Make it a shared adventure
            </Link>
          </div>
          {copied && (
            <p role="status" className="text-sm">
              {copied}
            </p>
          )}
          <p className="text-xs text-[var(--sn-frost)]">
            Copies don&apos;t merge yet — one live shared crew needs
            Passport&apos;s account-based adventures. Group chat waits for that
            too.
          </p>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">Announcements</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (act({ type: "announce", id: newId(), by: me.id, text: update }))
              setUpdate("");
          }}
        >
          <input
            className={`${field} flex-1`}
            value={update}
            onChange={(e) => setUpdate(e.target.value)}
            placeholder="Lifts open at 9. Meet at the deck at 8:40."
            aria-label="Post an update"
            maxLength={200}
          />
          <button className={btn} type="submit">
            Post
          </button>
        </form>
        <ul className="space-y-2" data-testid="announcements">
          {day.announcements.length === 0 && (
            <li className="text-sm text-[var(--sn-frost)]">
              Nothing posted yet.
            </li>
          )}
          {day.announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-[var(--sn-line)] p-3 text-sm"
            >
              <p className="font-semibold">{a.text}</p>
              <p className="text-xs text-[var(--sn-frost)]">
                {a.kind === "change" ? "Plan change" : personName(day, a.by)} ·{" "}
                {new Date(a.at).toLocaleString("en-CA", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
