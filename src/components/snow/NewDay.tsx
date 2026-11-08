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
import {
  applyAction,
  newDay,
  type Action,
  type SnowDay,
} from "@/domain/snow/day";
import { mountainById } from "@/domain/snow/mountains";
import {
  PLACEHOLDER_NAME,
  askLine,
  crewFromAsk,
  readAsk,
} from "@/domain/snow/ask";
import { newId, readDay, rememberSharedDay, writeDay, writeMe } from "./store";
import { btn, btnOn, field, styles } from "./kit";

/**
 * Four questions, none of them an account. Name the day, say who you are and
 * how you ride, and the crew can be added on the next screen.
 */
export function NewDay({
  mountainId,
  again,
  atlasName,
  sharedReady = false,
}: {
  mountainId?: string;
  again?: string;
  atlasName?: string;
  /** The database can hold a shared day (migration applied). */
  sharedReady?: boolean;
}) {
  const router = useRouter();
  const [sentence, setSentence] = useState("");
  const today = localToday();
  const ask = sentence.trim() ? readAsk(sentence, today) : null;
  // A mountain said in the sentence wins over the one the link came with.
  const mountain = ask?.mountain ?? mountainById(mountainId);
  const saidMountain = !!ask?.mountain;
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("ski");
  const [ability, setAbility] = useState<Ability>("intermediate");
  const [error, setError] = useState<string | null>(null);
  const [together, setTogether] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * Start it as a day every phone shares. Needs an account: who is in the
   * crew, and whose votes are whose, has to be somebody.
   */
  async function startTogether(hostName: string, dayTitle: string) {
    setBusy(true);
    try {
      const res = await fetch("/snow/api/days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dayTitle,
          name: hostName,
          discipline,
          ability,
          ownGear: true,
        }),
      });
      if (res.status === 401) {
        const back = new URLSearchParams();
        for (const [k, v] of Object.entries({
          mountain: mountainId,
          atlas: atlasName,
        }))
          if (v) back.set(k, v);
        router.push(
          `/auth?next=${encodeURIComponent(`/snow/new${back.size ? `?${back}` : ""}`)}`,
        );
        return;
      }
      const made = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !made.id) {
        setError(made.error ?? "Couldn't start a shared day just now.");
        return;
      }
      rememberSharedDay(made.id, dayTitle);
      const label = saidMountain
        ? mountain?.name
        : (atlasName ?? mountain?.name);
      const send = (action: Action) =>
        fetch(`/snow/api/${made.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      if (label) {
        // The mountain you came from goes on the list as the first option.
        const seen = (await (await fetch(`/snow/api/${made.id}`)).json()) as {
          me: string;
        };
        const proposalId = newId();
        await send({
          type: "propose",
          proposal: {
            id: proposalId,
            topic: "mountain",
            label,
            detail: atlasName && !saidMountain ? undefined : mountain?.region,
            by: seen.me,
            source: atlasName && !saidMountain ? "atlas" : "passport-list",
          },
        });
        // "We're going to SilverStar" is a decision, not a suggestion.
        if (saidMountain)
          await send({
            type: "choose",
            topic: "mountain",
            proposalId,
            by: seen.me,
            changeId: newId(),
          });
      }
      if (ask?.date) await send({ type: "when", date: ask.date.date });
      router.push(`/snow/day/${made.id}`);
    } catch {
      setError("No signal — a shared day needs one to start.");
    } finally {
      setBusy(false);
    }
  }

  function start(e: React.FormEvent) {
    e.preventDefault();
    const hostName = name.trim();
    if (!hostName) return setError("What should the crew call you?");
    if (together) {
      const label = saidMountain
        ? mountain?.name
        : (atlasName ?? mountain?.name);
      return void startTogether(
        hostName,
        title || (label ? `${label} day` : "Our snow day"),
      );
    }
    const id = newId();
    const hostId = newId();
    const now = new Date().toISOString();
    let day = newDay({
      id,
      title:
        title ||
        (saidMountain
          ? `${mountain!.name}${ask?.date?.key === "opening" ? " opening weekend" : " day"}`
          : (atlasName ?? mountain?.name)
            ? `${atlasName ?? mountain?.name} day`
            : "Our snow day"),
      now,
      host: { id: hostId, name: hostName, discipline, ability, ownGear: true },
    });
    if (atlasName && !saidMountain)
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
    if (ask) day = fromAsk(day, ask, hostId, discipline, now);
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

      <div className="space-y-2" data-testid="ask">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">
            Tell Passport about the day (optional)
          </span>
          <textarea
            className={`${field} min-h-24 py-2`}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="We're going to SilverStar opening weekend. Four people. Two skiers, one snowboarder and someone who doesn't ski."
            maxLength={400}
          />
        </label>
        {ask && (
          <div role="status" className="text-sm" data-testid="ask-read">
            {askLine(ask).length > 0 ? (
              <p className="font-semibold text-[var(--sn-aurora)]">
                Got it: {askLine(ask).join(" · ")}
                {ask.date && "date" in ask.date && ` (${ask.date.date})`}
              </p>
            ) : (
              <p className={styles.muted}>
                Nothing to go on yet — name a mountain, a weekend, who&apos;s
                coming.
              </p>
            )}
            {ask.openingUnknown && (
              <p className="text-[var(--sn-glow)]">
                {mountain?.name ?? "That resort"} hasn&apos;t published an
                opening day Passport has read, so it won&apos;t guess one. Pick
                the date on the next screen.
              </p>
            )}
            {sentence && !ask.mountain && /\b[A-Z][a-z]+\b/.test(sentence) && (
              <p className={styles.muted}>
                Passport knows {""}
                <a className="underline" href="/snow/mountains">
                  these mountains
                </a>
                ; add another on the next screen.
              </p>
            )}
            {together && crewFromAsk(ask, discipline).length > 0 && (
              <p className={styles.muted}>
                Shared days add people when they join with the invite link.
              </p>
            )}
          </div>
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

      {sharedReady && !again && (
        <label className="flex items-start gap-3 rounded-xl border border-[var(--sn-line)] p-3 text-sm">
          <input
            type="checkbox"
            checked={together}
            onChange={(e) => setTogether(e.target.checked)}
            className="mt-0.5 size-5"
          />
          <span>
            <span className="font-semibold">Plan it together, live.</span>{" "}
            Everyone joins from their own phone with an invite link, and votes,
            chat, points and photos are shared. Needs a Passport account.
          </span>
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--sn-glow)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className={`${styles.go} min-h-14 w-full rounded-full text-lg uppercase`}
      >
        {ask && askLine(ask).length > 0
          ? "Make us an awesome day"
          : "Create the day"}
      </button>
    </form>
  );
}

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * What the sentence said, applied through the same actions the screen uses:
 * the mountain it named is locked in (it was said as a decision), the date
 * set, and the people it described added with a placeholder name and the
 * most careful level, for the crew to correct.
 */
function fromAsk(
  day: SnowDay,
  ask: ReturnType<typeof readAsk>,
  hostId: string,
  discipline: Parameters<typeof crewFromAsk>[1],
  now: string,
): SnowDay {
  const run = (d: SnowDay, a: Action) => {
    const r = applyAction(d, a, now);
    return r.ok ? r.day : d;
  };
  let next = day;
  if (ask.mountain) {
    const m = next.proposals.find((p) => p.topic === "mountain");
    if (m)
      next = run(next, {
        type: "choose",
        topic: "mountain",
        proposalId: m.id,
        by: hostId,
        changeId: newId(),
      });
  }
  if (ask.date) next = run(next, { type: "when", date: ask.date.date });
  const seen: Record<string, number> = {};
  for (const d of crewFromAsk(ask, discipline)) {
    seen[d] = (seen[d] ?? 0) + 1;
    const n = seen[d] + (d === discipline ? 1 : 0);
    next = run(next, {
      type: "addPerson",
      person: {
        id: newId(),
        name: `${PLACEHOLDER_NAME[d]} ${n}`,
        discipline: d,
        ability: "beginner",
        ownGear: true,
        note: "Name and level not set yet — change it in Crew",
      },
    });
  }
  return next;
}
