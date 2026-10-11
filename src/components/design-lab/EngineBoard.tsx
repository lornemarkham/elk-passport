"use client";

import { useMemo, useState } from "react";
import type { Subject } from "@/lib/design-lab/sample";
import { Plate, Shelf } from "@/components/design-lab/white";
import { useHere } from "@/lib/location/useHere";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **The engine: four questions, then photographs with their reasons.**
 *
 * Client-side because two of the four answers are only knowable in the
 * browser — where the reader is, and what they have tapped. The subjects and
 * the verbs come from the server, already read from the live corpus.
 */
export function EngineBoard({
  verbs,
  subjects,
  unphotographed,
  total,
}: {
  readonly verbs: readonly { label: string; ids: readonly string[] }[];
  readonly subjects: readonly Subject[];
  readonly unphotographed: readonly Subject[];
  readonly total: number;
}) {
  const [doing, setDoing] = useState<string>();
  const [who, setWho] = useState<string>();
  const [how, setHow] = useState<string>();
  const [far, setFar] = useState<string>();
  const { at, ask } = useHere();

  const chosen = verbs.find((verb) => verb.label === doing);

  /** How many ideas a stated length of day asks for. Never a duration. */
  const wanted = how === "an hour" ? 4 : how === "half a day" ? 8 : 14;

  const results = useMemo(() => {
    const within = (subject: Subject) => {
      if (!at || !subject.coordinates) return undefined;
      const [longitude, latitude] = subject.coordinates;
      return distanceKm(at, { latitude, longitude });
    };

    let pool = chosen
      ? subjects.filter((subject) => chosen.ids.includes(subject.id))
      : [...subjects];

    if (far === "this town" || far === "worth a drive") {
      // Only ever narrows what Atlas has placed. A subject with no
      // coordinates is not far away — it is unplaced, and it stays.
      pool = pool.filter((subject) => {
        const km = within(subject);
        if (km === undefined) return true;
        return far === "this town" ? km <= 15 : km > 15;
      });
    }

    return pool
      .map((subject) => ({ subject, km: within(subject) }))
      .sort((a, b) => {
        if (a.km === undefined && b.km === undefined) return 0;
        if (a.km === undefined) return 1;
        if (b.km === undefined) return -1;
        return a.km - b.km;
      })
      .slice(0, wanted);
  }, [chosen, subjects, at, far, wanted]);

  const href = (subject: Subject) => `/labs/design/v3/engine/${subject.id}`;

  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pt-10 sm:px-10 sm:pt-20">
        <h1 className="max-w-[16ch] text-[38px] leading-[0.95] font-bold tracking-[-0.045em] text-balance sm:text-[82px]">
          What do you feel like doing?
        </h1>

        <Question label="Something like">
          {verbs.map((verb) => (
            <Word
              key={verb.label}
              on={doing === verb.label}
              onClick={() =>
                setDoing(doing === verb.label ? undefined : verb.label)
              }
            >
              {verb.label}
              <span className="ml-1.5 text-[0.7em] tabular-nums opacity-40">
                {verb.ids.length}
              </span>
            </Word>
          ))}
        </Question>

        <Question label="Who is coming">
          {["on your own", "with a young child", "with friends"].map(
            (option) => (
              <Word
                key={option}
                on={who === option}
                onClick={() => setWho(who === option ? undefined : option)}
              >
                {option}
              </Word>
            ),
          )}
        </Question>

        <Question label="How long">
          {["an hour", "half a day", "all day"].map((option) => (
            <Word
              key={option}
              on={how === option}
              onClick={() => setHow(how === option ? undefined : option)}
            >
              {option}
            </Word>
          ))}
        </Question>

        <Question label="How far">
          {["anywhere", "this town", "worth a drive"].map((option) => (
            <Word
              key={option}
              on={far === option}
              disabled={option !== "anywhere" && !at}
              onClick={() => setFar(far === option ? undefined : option)}
            >
              {option}
            </Word>
          ))}
          {!at && ask && (
            <button
              type="button"
              data-testid="engine-locate"
              onClick={ask}
              className="text-[20px] font-semibold tracking-[-0.02em] text-blue-700 underline underline-offset-4 sm:text-[28px]"
            >
              share where you are
            </button>
          )}
        </Question>

        {/* The honest footnotes, where a control cannot do what it looks like
            it does. */}
        <p className="mt-7 max-w-[62ch] text-[13px] leading-relaxed text-black/40">
          {who
            ? "Who is coming changes nothing here yet — Atlas states who a place suits for a fraction of the corpus, and the real product asks for an age before claiming anything. "
            : ""}
          How long decides how many ideas to show, not how long anything takes:
          Atlas states a duration for 17 subjects out of{" "}
          {total.toLocaleString("en-CA")}.
        </p>
      </section>

      <section className="mt-10 sm:mt-16">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
          <h2 className="text-[22px] font-bold tracking-[-0.03em] sm:text-[32px]">
            {results.length} {results.length === 1 ? "idea" : "ideas"}
            {chosen ? ` for ${chosen.label.toLowerCase()}` : ""}
          </h2>
        </div>

        <div className="mt-5 sm:hidden">
          <Shelf
            subjects={results.map((r) => r.subject)}
            href={href}
            ratio="3/2"
            wide
          />
        </div>

        <ul className="mx-auto mt-5 hidden max-w-[1280px] grid-cols-2 gap-x-8 gap-y-12 px-10 sm:grid lg:grid-cols-3">
          {results.map(({ subject, km }) => (
            <li key={subject.id}>
              <Plate subject={subject} href={href(subject)} ratio="3/2" />
              <Reasons
                subject={subject}
                km={km}
                {...(chosen ? { doing: chosen.label } : {})}
              />
            </li>
          ))}
        </ul>

        {/* Reasons on mobile too, under the shelf, so the swipe is not the
            only thing a phone gets. */}
        <ul className="mx-auto mt-4 flex max-w-[1280px] flex-col gap-2 px-5 sm:hidden">
          {results.slice(0, 4).map(({ subject, km }) => (
            <li key={subject.id}>
              <p className="text-[14px] font-semibold tracking-[-0.01em]">
                {subject.title}
              </p>
              <Reasons
                subject={subject}
                km={km}
                {...(chosen ? { doing: chosen.label } : {})}
              />
            </li>
          ))}
        </ul>
      </section>

      {unphotographed.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 pt-14 pb-20 sm:px-10">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] text-black/35 uppercase">
            Atlas knows these too, without a photograph
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            {unphotographed.map((subject) => (
              <li
                key={subject.id}
                className="text-[16px] font-semibold text-black/45"
              >
                {subject.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * **Why this is here.** Every reason is something Atlas states, or a distance
 * between two stated positions. Nothing is shown that cannot be pointed at.
 */
function Reasons({
  subject,
  km,
  doing,
}: {
  readonly subject: Subject;
  readonly km?: number;
  /** The verb the person actually asked for, where they asked for one. */
  readonly doing?: string;
}) {
  // **The reason has to be the reason.** Filtering by Swimming and then
  // explaining "Atlas states Hiking here" — because hiking happened to be the
  // subject's first verb — is a reason that does not match its own result.
  const stated =
    subject.doing.find((verb) => verb === doing) ?? subject.doing[0];
  const reasons = [
    km !== undefined
      ? km < 1
        ? "under 1 km from you"
        : `${Math.round(km)} km from you`
      : undefined,
    stated ? `Atlas states ${stated} here` : undefined,
    subject.recurs,
    subject.place ?? subject.area,
  ].filter(Boolean);
  if (reasons.length === 0) return null;
  return (
    <p
      data-testid="engine-reasons"
      className="mt-1.5 text-[13px] leading-relaxed text-black/45"
    >
      {reasons.join(" · ")}
    </p>
  );
}

function Question({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="mt-9 border-t border-black/10 pt-5 sm:mt-12">
      <p className="text-[12px] font-semibold tracking-[0.1em] text-black/35 uppercase">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
        {children}
      </div>
    </div>
  );
}

function Word({
  on,
  disabled = false,
  onClick,
  children,
}: {
  readonly on: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid="engine-word"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={
        "text-[20px] font-semibold tracking-[-0.02em] transition-colors first-letter:uppercase sm:text-[28px] " +
        (disabled
          ? "cursor-not-allowed text-black/20"
          : on
            ? "text-black underline decoration-2 underline-offset-[6px]"
            : "text-black/35 hover:text-black/70")
      }
    >
      {children}
    </button>
  );
}
