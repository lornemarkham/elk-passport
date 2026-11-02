"use client";

import Link from "next/link";
import { useState } from "react";
import { buildRecap, recapText } from "@/domain/snow/recap";
import { personName } from "@/domain/snow/day";
import { LIMITS } from "@/domain/snow/day";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, btn, field, styles } from "./kit";

/** Downscale on the phone: ~900px JPEG keeps a day's photos inside storage. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("not an image"));
      i.src = url;
    });
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Memories and recap: what happened, in the order you'd tell it. */
export function MemoriesTab({ day, me, act }: TabProps) {
  const [moment, setMoment] = useState("");
  const [idea, setIdea] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const recap = buildRecap(day);

  async function addPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setNote(null);
    try {
      act({
        type: "photo",
        photo: {
          id: newId(),
          personId: me.id,
          caption: "",
          src: await shrink(file),
          at: "",
        },
      });
    } catch {
      setNote("That file isn't a photo this phone can open.");
    }
  }

  async function shareRecap() {
    const text = recapText(day);
    try {
      if (navigator.share) await navigator.share({ title: day.title, text });
      else {
        await navigator.clipboard.writeText(text);
        setNote("Recap copied. Paste it anywhere.");
      }
    } catch {
      setNote("Couldn't share from here.");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3" data-testid="recap">
        <p className="text-xs font-bold tracking-widest text-[var(--sn-aurora)] uppercase">
          The recap
        </p>
        <h2 className="text-3xl font-black">{recap.title}</h2>
        <p className="text-sm text-[var(--sn-frost)]">
          {[recap.mountain, recap.when, `with ${recap.crew.join(", ")}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {recap.empty && (
          <p className="text-sm">
            Nothing recorded yet. Add a photo or a moment below, or tick off a
            challenge, and the recap fills itself in.
          </p>
        )}
        {recap.standings.length > 0 && (
          <div>
            <h3 className="font-bold">Final table</h3>
            <ol className="text-sm">
              {recap.standings.map((s) => (
                <li key={s.person.id}>
                  {s.rank}. {s.person.name} — {s.points} pts
                </li>
              ))}
            </ol>
          </div>
        )}
        {recap.awards.length > 0 && (
          <ul className="text-sm">
            {recap.awards.map((a) => (
              <li key={a.id}>
                {a.emoji} <strong>{a.title}</strong>:{" "}
                {a.winners.map((w) => w.name).join(" & ")}
              </li>
            ))}
          </ul>
        )}
        {recap.predictions.length > 0 && (
          <div>
            <h3 className="font-bold">Called</h3>
            <ul className="text-sm">
              {recap.predictions.map((p) => (
                <li key={p.text}>
                  {p.happened ? "✅" : "❌"} {p.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {recap.challengesDone.length > 0 && (
          <div>
            <h3 className="font-bold">Challenges done</h3>
            <ul className="text-sm">
              {recap.challengesDone.map((c) => (
                <li key={c.title}>
                  ✓ {c.title}{" "}
                  <span className="text-[var(--sn-frost)]">
                    — {c.who.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          className={`${styles.go} min-h-12 rounded-full px-6 text-sm uppercase`}
          onClick={shareRecap}
        >
          Share the recap
        </button>
        {note && (
          <p role="status" className="text-sm">
            {note}
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">Photos</h2>
        <label className={`${btn} inline-flex cursor-pointer items-center`}>
          Add a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Add a photo"
            onChange={(e) => addPhoto(e.target.files)}
          />
        </label>
        <p className="text-xs text-[var(--sn-frost)]">
          Kept on this phone (up to {LIMITS.photos}), shrunk to fit. They
          aren&apos;t uploaded and aren&apos;t in a shared plan link.
        </p>
        <ul
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          data-testid="photos"
        >
          {day.photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL on this device */}
              <img
                src={p.src}
                alt={`Photo by ${personName(day, p.personId)}`}
                className="aspect-square w-full rounded-xl object-cover"
              />
              <button
                className="absolute top-1 right-1 rounded-full bg-black/70 px-2 py-1 text-xs"
                aria-label="Remove photo"
                onClick={() => act({ type: "removePhoto", id: p.id })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-extrabold">Favourite moments</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              act({
                type: "moment",
                moment: { id: newId(), personId: me.id, text: moment, at: "" },
              })
            )
              setMoment("");
          }}
        >
          <input
            className={`${field} flex-1`}
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
            placeholder="Ben's face when the chair stopped"
            aria-label="A moment"
            maxLength={200}
          />
          <button className={btn} type="submit">
            Add
          </button>
        </form>
        <ul className="space-y-1 text-sm" data-testid="moments">
          {recap.moments.map((m, i) => (
            <li key={i}>
              “{m.text}”{" "}
              <span className="text-[var(--sn-frost)]">— {m.who}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3" data-testid="next">
        <h2 className="text-xl font-extrabold">Go have another</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (act({ type: "idea", id: newId(), text: idea, by: me.id }))
              setIdea("");
          }}
        >
          <input
            className={`${field} flex-1`}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Whistler in January, or a night-ski session"
            aria-label="Next adventure idea"
            maxLength={100}
          />
          <button className={btn} type="submit">
            Suggest
          </button>
        </form>
        <ul className="space-y-2">
          {recap.ideas.map((i) => {
            const mine = i.votes.includes(me.id);
            return (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--sn-line)] p-3 text-sm"
              >
                <span>
                  {i.text}{" "}
                  <span className="text-[var(--sn-frost)]">
                    — {personName(day, i.by)}
                  </span>
                </span>
                <button
                  className={btn}
                  aria-pressed={mine}
                  onClick={() =>
                    act({
                      type: "voteIdea",
                      id: i.id,
                      personId: me.id,
                      on: !mine,
                    })
                  }
                >
                  {mine ? "★" : "☆"} {i.votes.length}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link
            className={`${styles.go} inline-flex min-h-12 items-center rounded-full px-6 text-sm uppercase`}
            href={`/snow/new?again=${day.id}`}
          >
            Same crew, next snow day
          </Link>
          <Link
            className={`${btn} inline-flex items-center`}
            href="/snow/mountains"
          >
            Find a new mountain
          </Link>
          <Link
            className={`${btn} inline-flex items-center`}
            href="/discovery?q=skiing"
          >
            More winter in Discovery
          </Link>
          <Link className={`${btn} inline-flex items-center`} href="/saved">
            Saved
          </Link>
        </div>
      </Card>
    </div>
  );
}
