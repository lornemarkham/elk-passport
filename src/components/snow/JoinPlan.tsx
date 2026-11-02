"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ABILITIES,
  ABILITY_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  type Ability,
  type Discipline,
} from "@/domain/snow/ability";
import {
  parseDay,
  applyAction,
  chosenFor,
  type SnowDay,
} from "@/domain/snow/day";
import { readFragment } from "@/domain/snow/recap";
import { newId, readDay, rememberSharedDay, writeDay, writeMe } from "./store";
import { btn, btnOn, field, styles } from "./kit";

/**
 * **Open a plan a friend sent.** The plan is in the part of the link after
 * `#`, which never reaches a server. You get your own copy and add yourself
 * to it.
 */
export function JoinPlan() {
  // An invite link carries a token (`?t=`); an old-style copy link carries the
  // plan itself after `#`. Which one is only known in the browser.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known in the browser */
    setToken(new URLSearchParams(location.search).get("t"));
  }, []);
  if (token === undefined) return <p>Opening the invite…</p>;
  return token ? <JoinTogether token={token} /> : <JoinCopy />;
}

/**
 * **Join a snow day that every phone shares.** You sign in, say how you ride,
 * and land in the same day as everyone else — not in a copy of it.
 */
function JoinTogether({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("ski");
  const [ability, setAbility] = useState<Ability>("intermediate");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/snow/api/join?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((b: { state?: string }) => live && setState(b.state ?? "none"))
      .catch(() => live && setState("down"));
    return () => {
      live = false;
    };
  }, [token]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("What should the crew call you?");
    setBusy(true);
    try {
      const res = await fetch("/snow/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, discipline, ability }),
      });
      if (res.status === 401)
        return router.push(
          `/auth?next=${encodeURIComponent(`/snow/join?t=${token}`)}`,
        );
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !body.id)
        return setError(body.error ?? "Couldn't join just now. Try again.");
      rememberSharedDay(body.id, "Snow day");
      router.push(`/snow/day/${body.id}`);
    } catch {
      setError("No signal — joining needs one.");
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return <p>Checking the invite…</p>;
  if (state !== "valid")
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-black">That invite doesn&apos;t work</h1>
        <p className={styles.muted}>
          {state === "down"
            ? "Couldn't reach Passport. Try again in a moment."
            : "It may have been used up, expired, or switched off. Ask the host for a new one."}
        </p>
      </div>
    );

  return (
    <form onSubmit={join} className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-widest text-[var(--sn-aurora)] uppercase">
          You&apos;re invited
        </p>
        <h1 className="text-4xl font-black">Join the snow day</h1>
        <p className={styles.muted}>
          You&apos;ll sign in, then you&apos;re in the same day as the rest of
          the crew: their votes, their chat, their photos. Only people in it see
          any of it.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Your name</span>
        <input
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoComplete="given-name"
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Riding">
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Level">
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
        I&apos;m in
      </button>
    </form>
  );
}

function JoinCopy() {
  const router = useRouter();
  const [plan, setPlan] = useState<SnowDay | null | "none">(null);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("ski");
  const [ability, setAbility] = useState<Ability>("intermediate");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseDay(readFragment(location.hash.slice(1)));
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- the fragment exists only in the browser */
    setPlan(parsed ?? "none");
  }, []);

  if (plan === null) return <p>Opening the plan…</p>;
  if (plan === "none")
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-black">
          That link didn&apos;t open a plan
        </h1>
        <p className={styles.muted}>
          It may have been cut short when it was pasted. Ask for it again.
        </p>
      </div>
    );

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (plan === null || plan === "none") return;
    const person = { id: newId(), name, discipline, ability, ownGear: true };
    // A second tap on the same link keeps one copy, not two.
    const existing = readDay(plan.id);
    const base = existing ?? plan;
    const result = applyAction(
      base,
      { type: "addPerson", person },
      new Date().toISOString(),
    );
    if (!result.ok) return setError(result.reason);
    const failed = writeDay(result.day);
    if (failed) return setError(failed);
    writeMe(plan.id, person.id);
    router.push(`/snow/day/${plan.id}`);
  }

  return (
    <form onSubmit={join} className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-widest text-[var(--sn-aurora)] uppercase">
          You&apos;re invited
        </p>
        <h1 className="text-4xl font-black">{plan.title}</h1>
        <p className={styles.muted}>
          {[
            chosenFor(plan, "mountain")?.label,
            plan.date,
            `${plan.people.length} in: ${plan.people.map((p) => p.name).join(", ")}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Your name</span>
        <input
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Riding">
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Level">
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
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--sn-glow)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        className={`${styles.go} min-h-14 w-full rounded-full text-lg uppercase`}
      >
        I&apos;m in
      </button>
    </form>
  );
}
