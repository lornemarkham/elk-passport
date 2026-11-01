"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ABILITIES,
  ABILITY_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  type Ability,
  type Discipline,
} from "@/domain/snow/ability";
import { newDay } from "@/domain/snow/day";
import { mountainById } from "@/domain/snow/mountains";
import { newId, readDay, writeDay, writeMe } from "./store";
import { btn, btnOn, field, styles } from "./kit";

/**
 * Four questions, none of them an account. Name the day, say who you are and
 * how you ride, and the crew can be added on the next screen.
 */
export function NewDay({
  mountainId,
  again,
  atlasName,
}: {
  mountainId?: string;
  again?: string;
  atlasName?: string;
}) {
  const router = useRouter();
  const mountain = mountainById(mountainId);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("ski");
  const [ability, setAbility] = useState<Ability>("intermediate");
  const [error, setError] = useState<string | null>(null);

  function start(e: React.FormEvent) {
    e.preventDefault();
    const hostName = name.trim();
    if (!hostName) return setError("What should the crew call you?");
    const id = newId();
    const hostId = newId();
    const now = new Date().toISOString();
    let day = newDay({
      id,
      title:
        title ||
        ((atlasName ?? mountain?.name)
          ? `${atlasName ?? mountain?.name} day`
          : "Our snow day"),
      now,
      host: { id: hostId, name: hostName, discipline, ability, ownGear: true },
    });
    if (atlasName)
      day = {
        ...day,
        proposals: [
          {
            id: newId(),
            topic: "mountain",
            label: atlasName,
            by: hostId,
            source: "atlas",
          },
        ],
      };
    else if (mountain)
      day = {
        ...day,
        proposals: [
          {
            id: newId(),
            topic: "mountain",
            label: mountain.name,
            detail: mountain.region,
            by: hostId,
            source: "passport-list",
          },
        ],
      };
    // Go Have Another: the crew carries over, the plans and scores do not.
    const before = again ? readDay(again) : null;
    if (before) {
      day = {
        ...day,
        people: [
          day.people[0],
          ...before.people
            .filter((p) => p.name.toLowerCase() !== hostName.toLowerCase())
            .map((p) => ({ ...p, id: newId() })),
        ],
      };
    }
    const failed = writeDay(day);
    if (failed) return setError(failed);
    writeMe(id, hostId);
    router.push(`/snow/day/${id}`);
  }

  return (
    <form onSubmit={start} className="space-y-6" aria-labelledby="new-h">
      <div>
        <h1 id="new-h" className="text-4xl font-black">
          Start a snow day
        </h1>
        <p className={`mt-2 ${styles.muted}`}>
          {again
            ? "Same crew, new mountain. Their levels come along; plans and scores start fresh."
            : "You name it, the crew fills it in. No account needed."}
        </p>
        {(mountain || atlasName) && (
          <p className="mt-2 text-sm font-semibold text-[var(--sn-aurora)]">
            Starting with {atlasName ?? mountain?.name} as an option.
          </p>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Name the day</span>
        <input
          className={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Powder Friday"
          maxLength={60}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Your name</span>
        <input
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ana"
          maxLength={30}
          autoComplete="given-name"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">What are you riding?</legend>
        <div className="flex flex-wrap gap-2">
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
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Your level, honestly</legend>
        <div className="flex flex-wrap gap-2">
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
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--sn-glow)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        className={`${styles.go} min-h-14 w-full rounded-full text-lg uppercase`}
      >
        Create the day
      </button>
    </form>
  );
}
