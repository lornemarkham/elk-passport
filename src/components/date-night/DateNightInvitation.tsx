"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Picture } from "@/components/adventures/Picture";
import {
  EMPTY_ANSWER,
  isEmpty,
  LIMITS,
  type DateNightAnswer,
} from "@/domain/date-night/answer";
import { cautionsFor, type Caution } from "@/domain/date-night/cautions";
import type { DayForecast, Sunlight } from "@/domain/date-night/conditions";
import {
  ADVENTUROUS_LEVELS,
  IDEA_PICKS,
  type Adventurous,
  type DateNight,
  type DateNightIdea,
  type IdeaPick,
} from "@/domain/date-night/types";
import type { NightPlace } from "@/app/date-night/[slug]/_server/load";
import styles from "./date-night.module.css";

type Sending = "idle" | "sending" | "sent" | "kept" | "failed";

/** Mutable working copy of an answer while it is filled in. */
interface Draft {
  picks: Record<string, IdeaPick>;
  ownIdeas: string[];
  placeIds: string[];
  places: string[];
  adventurous?: Adventurous;
  food: string[];
  foodNote: string;
  message: string;
}

const fresh = (): Draft => ({
  ...EMPTY_ANSWER,
  picks: {},
  ownIdeas: [],
  placeIds: [],
  places: [],
  food: [],
  foodNote: "",
  message: "",
});

function toAnswer(d: Draft): DateNightAnswer {
  const answer: DateNightAnswer = {
    picks: d.picks,
    ownIdeas: d.ownIdeas,
    placeIds: d.placeIds,
    places: d.places,
    food: d.food,
    ...(d.adventurous ? { adventurous: d.adventurous } : {}),
    ...(d.foodNote.trim() ? { foodNote: d.foodNote.trim() } : {}),
    ...(d.message.trim() ? { message: d.message.trim() } : {}),
  };
  return answer;
}

const storageKey = (slug: string) => `date-night:${slug}`;

/**
 * **The invitation itself** — one scrolling page that reads like a note from
 * the person who sent it, not a form: ideas to react to, room for her own,
 * places, how wild, food, a message, and one button. What has been done is
 * kept on the phone as she goes, so a closed tab loses nothing.
 */
export function DateNightInvitation({
  night,
  places,
  atlasDown,
  sunlight,
  forecast,
}: {
  readonly night: DateNight;
  readonly places: Readonly<Record<string, NightPlace>>;
  readonly atlasDown: boolean;
  readonly sunlight?: Sunlight;
  readonly forecast?: DayForecast;
}) {
  const [draft, setDraft] = useState<Draft>(fresh);
  const [sending, setSending] = useState<Sending>("idle");
  const restored = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(night.slug));
      if (raw) {
        const saved = JSON.parse(raw) as { draft?: Draft; sent?: boolean };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real external source (localStorage) after mount, as TrackRating.tsx does
        if (saved.draft) setDraft({ ...fresh(), ...saved.draft });
        if (saved.sent) setSending("sent");
      }
    } catch {
      // A private window, or something old and unreadable: start fresh.
    }
    restored.current = true;
  }, [night.slug]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(
        storageKey(night.slug),
        JSON.stringify({ draft, sent: sending === "sent" }),
      );
    } catch {
      // Storage full or refused; the page still works, it just won't remember.
    }
  }, [draft, sending, night.slug]);

  const update = (change: (d: Draft) => Draft) => {
    setDraft(change);
    if (sending === "sent" || sending === "failed" || sending === "kept")
      setSending("idle");
  };

  const answer = useMemo(() => toAnswer(draft), [draft]);
  const yesCount = Object.values(draft.picks).filter((p) => p === "yes").length;
  const empty = isEmpty(answer);

  async function send() {
    if (empty || sending === "sending") return;
    setSending("sending");
    try {
      const response = await fetch(
        `/api/date-night/${encodeURIComponent(night.slug)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(answer),
        },
      );
      if (response.ok) {
        setSending("sent");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setSending(
        response.status === 503 || response.status === 409 ? "kept" : "failed",
      );
    } catch {
      setSending("kept");
    }
  }

  const placeList = (night.suggestPlaceIds ?? [])
    .map((id) => places[id])
    .filter((p): p is NightPlace => Boolean(p));

  return (
    <main className={styles.page}>
      <div className={styles.sky} aria-hidden />
      <header className={styles.hero}>
        <p className={styles.kicker}>A Date Night invitation</p>
        <h1 className={styles.headline}>{night.headline}</h1>
        <p className={styles.invite}>{night.invitation}</p>
        <p className={styles.sub}>
          Here are some ideas, {night.to}. Pick the ones that make you grin, add
          your own, and send it back. Nothing&apos;s decided until we decide it
          together.
        </p>
        <Conditions night={night} sunlight={sunlight} forecast={forecast} />
      </header>

      {sending === "sent" && (
        <section className={styles.sent} role="status" data-testid="sent">
          <p className={styles.sentHearts} aria-hidden>
            ❤️ 🔥 🏔️
          </p>
          <h2>Sent!</h2>
          <p>{night.thanks}</p>
          <p className={styles.small}>
            Change your mind? Change anything below and send it again —{" "}
            {night.from} sees the newest one first.
          </p>
        </section>
      )}

      <Step
        n={1}
        title="Pick your adventures"
        hint="Tap how you feel about each one."
      >
        <ul className={styles.ideas}>
          {night.ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              pick={draft.picks[idea.id]}
              places={(idea.atlasIds ?? [])
                .map((id) => places[id])
                .filter((p): p is NightPlace => Boolean(p))}
              atlasDown={atlasDown}
              sunlight={idea.aboutSunset ? sunlight : undefined}
              onPick={(pick) =>
                update((d) => {
                  const picks = { ...d.picks };
                  if (picks[idea.id] === pick) delete picks[idea.id];
                  else picks[idea.id] = pick;
                  return { ...d, picks };
                })
              }
            />
          ))}
        </ul>
      </Step>

      <Step
        n={2}
        title="Your own adventure ideas"
        hint={`Anything at all. ${night.from} is listening.`}
      >
        <Adder
          label="Add an idea"
          placeholder="e.g. Hot springs, then pie"
          items={draft.ownIdeas}
          most={LIMITS.ownIdeas}
          max={LIMITS.ideaLength}
          onChange={(ownIdeas) => update((d) => ({ ...d, ownIdeas }))}
          testId="own-ideas"
        />
      </Step>

      <Step
        n={3}
        title="Suggest a place"
        hint="Tap a spot, or name one we should try."
      >
        {placeList.length > 0 && (
          <ul className={styles.places}>
            {placeList.map((place) => {
              const on = draft.placeIds.includes(place.id);
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    className={styles.place}
                    aria-pressed={on}
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        placeIds: on
                          ? d.placeIds.filter((id) => id !== place.id)
                          : [...d.placeIds, place.id],
                      }))
                    }
                  >
                    <Picture
                      experience={place.experience}
                      className={styles.placePicture}
                      showLabel={false}
                      fallbackTitle={place.experience.title}
                      tone="#2d4a3e"
                    />
                    <span className={styles.placeName}>
                      {on ? "✓ " : ""}
                      {place.experience.title}
                    </span>
                    {place.km !== undefined && (
                      <span className={styles.placeKm}>
                        ~{place.km} km away
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {atlasDown && (
          <p className={styles.small}>
            Passport couldn&apos;t reach its places just now — type one instead.
          </p>
        )}
        {placeList.length > 0 && (
          <p className={styles.small}>
            Places from Passport&apos;s Atlas. Distances are straight lines, not
            drives.
          </p>
        )}
        <Adder
          label="Add a place"
          placeholder="Somewhere you've been dying to go"
          items={draft.places}
          most={LIMITS.places}
          max={LIMITS.placeLength}
          onChange={(list) => update((d) => ({ ...d, places: list }))}
          testId="places"
        />
      </Step>

      <Step n={4} title="How adventurous are you feeling?">
        <div
          className={styles.levels}
          role="radiogroup"
          aria-label="How adventurous"
        >
          {ADVENTUROUS_LEVELS.map((level) => {
            const on = draft.adventurous === level.value;
            return (
              <button
                key={level.value}
                type="button"
                role="radio"
                aria-checked={on}
                className={styles.level}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    adventurous: on ? undefined : level.value,
                  }))
                }
              >
                <span className={styles.levelEmoji} aria-hidden>
                  {level.emoji}
                </span>
                <span className={styles.levelLabel}>{level.label}</span>
              </button>
            );
          })}
        </div>
        <p className={styles.levelLine} aria-live="polite">
          {ADVENTUROUS_LEVELS.find((l) => l.value === draft.adventurous)
            ?.line ?? "Tap one — from blankets to full send."}
        </p>
      </Step>

      <Step
        n={5}
        title="Food & drinks"
        hint="What sounds good out there, or after?"
      >
        <div className={styles.chips}>
          {night.food.map((food) => {
            const on = draft.food.includes(food);
            return (
              <button
                key={food}
                type="button"
                className={styles.chip}
                aria-pressed={on}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    food: on
                      ? d.food.filter((f) => f !== food)
                      : [...d.food, food],
                  }))
                }
              >
                {food}
              </button>
            );
          })}
        </div>
        <label className={styles.field}>
          <span>Anything else?</span>
          <input
            value={draft.foodNote}
            maxLength={LIMITS.foodNote}
            placeholder="A craving, a place, a no-go"
            onChange={(e) =>
              update((d) => ({ ...d, foodNote: e.target.value }))
            }
          />
        </label>
      </Step>

      <Step n={6} title={`A message for ${night.from}`}>
        <label className={styles.field}>
          <span className="sr-only">Message for {night.from}</span>
          <textarea
            rows={4}
            value={draft.message}
            maxLength={LIMITS.message}
            placeholder="Say anything…"
            onChange={(e) => update((d) => ({ ...d, message: e.target.value }))}
          />
        </label>
      </Step>

      <div className={styles.sendBar}>
        <div className={styles.sendInner}>
          <p className={styles.sendSummary} aria-live="polite">
            {sending === "kept"
              ? `Couldn't reach ${night.from}'s inbox — it's all kept on this phone. Try again in a minute.`
              : sending === "failed"
                ? "Something went wrong. Try again?"
                : sending === "sent"
                  ? `Sent to ${night.from} ❤️`
                  : empty
                    ? "Pick anything to start."
                    : yesCount > 0
                      ? `${yesCount} yes${yesCount === 1 ? "" : "es"} so far`
                      : "Ready when you are"}
          </p>
          <button
            type="button"
            className={styles.send}
            disabled={empty || sending === "sending" || sending === "sent"}
            onClick={send}
          >
            {sending === "sending"
              ? "Sending…"
              : sending === "sent"
                ? "Sent ✓"
                : `Send to ${night.from} ❤️`}
          </button>
        </div>
      </div>
      <footer className={styles.footer}>
        Made with <Link href="/">Go Have A Day</Link>. Your answers go only to{" "}
        {night.from}.
      </footer>
    </main>
  );
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  readonly n: number;
  readonly title: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={styles.step} aria-labelledby={`step-${n}`}>
      <div className={styles.stepHead}>
        <span className={styles.marker} aria-hidden>
          {n}
        </span>
        <div>
          <h2 id={`step-${n}`} className={styles.stepTitle}>
            {title}
          </h2>
          {hint && <p className={styles.stepHint}>{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Conditions({
  night,
  sunlight,
  forecast,
}: {
  readonly night: DateNight;
  readonly sunlight?: Sunlight;
  readonly forecast?: DayForecast;
}) {
  return (
    <div className={styles.conditions} data-testid="conditions">
      {sunlight && (
        <p>
          🌅 Sunset {sunlight.sunset} · sunrise {sunlight.sunrise}{" "}
          <span className={styles.muted}>({night.area.label})</span>
        </p>
      )}
      {forecast ? (
        <p>
          ⛅ {forecast.words.join(", ") || "Forecast"}
          {forecast.lowC !== undefined && forecast.highC !== undefined
            ? ` · ${Math.round(forecast.lowC)}° to ${Math.round(forecast.highC)}°C`
            : ""}
          {forecast.wettestChance !== undefined
            ? ` · up to ${forecast.wettestChance}% chance of precipitation`
            : ""}{" "}
          <span className={styles.muted}>
            ({forecast.covers}, {forecast.source}
            {forecast.city ? ` for ${forecast.city}` : ""})
          </span>
        </p>
      ) : (
        <p>
          ⛅ Check the sky before we go:{" "}
          <a
            href={`https://weather.gc.ca/en/location/index.html?coords=${night.area.latitude},${night.area.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Environment Canada forecast
          </a>
        </p>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  pick,
  places,
  atlasDown,
  sunlight,
  onPick,
}: {
  readonly idea: DateNightIdea;
  readonly pick?: IdeaPick;
  readonly places: readonly NightPlace[];
  readonly atlasDown: boolean;
  readonly sunlight?: Sunlight;
  readonly onPick: (pick: IdeaPick) => void;
}) {
  const cautions = cautionsFor(idea.cautions);
  return (
    <li
      className={styles.idea}
      data-pick={pick ?? "none"}
      data-testid={`idea-${idea.id}`}
    >
      <div className={styles.ideaTop}>
        <span className={styles.ideaEmoji} aria-hidden>
          {idea.emoji}
        </span>
        <div>
          <h3 className={styles.ideaTitle}>{idea.title}</h3>
          <p className={styles.ideaLine}>{idea.line}</p>
        </div>
      </div>
      {sunlight && (
        <p className={styles.ideaFact}>Sun sets at {sunlight.sunset}.</p>
      )}
      {places.length > 0 && (
        <p className={styles.ideaFact}>
          Ideas from Atlas:{" "}
          {places
            .map(
              (p) =>
                `${p.experience.title}${p.km !== undefined ? ` (~${p.km} km)` : ""}`,
            )
            .join(" · ")}
        </p>
      )}
      {idea.atlasIds && places.length === 0 && atlasDown && (
        <p className={styles.ideaFact}>
          Atlas&apos;s viewpoints didn&apos;t load just now.
        </p>
      )}
      {idea.placeAtlasDoesNotKnow && (
        <p className={styles.ideaFact}>
          Passport doesn&apos;t know {idea.placeAtlasDoesNotKnow} yet — no
          hours, access or conditions to show.
        </p>
      )}
      {cautions.length > 0 && <Cautions cautions={cautions} />}
      <div
        className={styles.picks}
        role="group"
        aria-label={`${idea.title}: how you feel`}
      >
        {IDEA_PICKS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={styles.pick}
            data-value={p.value}
            aria-pressed={pick === p.value}
            onClick={() => onPick(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </li>
  );
}

function Cautions({ cautions }: { readonly cautions: readonly Caution[] }) {
  return (
    <details className={styles.cautions}>
      <summary>
        ⚠️ Check first: {cautions.map((c) => c.label).join(" · ")}
      </summary>
      <ul>
        {cautions.map((c) => (
          <li key={c.id}>
            {c.check}{" "}
            {c.source && (
              <a href={c.source.url} target="_blank" rel="noreferrer">
                {c.source.name}
              </a>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Adder({
  label,
  placeholder,
  items,
  most,
  max,
  onChange,
  testId,
}: {
  readonly label: string;
  readonly placeholder: string;
  readonly items: readonly string[];
  readonly most: number;
  readonly max: number;
  readonly onChange: (items: string[]) => void;
  readonly testId: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const value = text.trim();
    if (!value || items.includes(value) || items.length >= most) return;
    onChange([...items, value]);
    setText("");
  };
  return (
    <div className={styles.adder} data-testid={testId}>
      {items.length > 0 && (
        <ul className={styles.added}>
          {items.map((item) => (
            <li key={item}>
              <span>✨ {item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(items.filter((i) => i !== item))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length < most && (
        <form
          className={styles.adderRow}
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="sr-only" htmlFor={`${testId}-input`}>
            {label}
          </label>
          <input
            id={`${testId}-input`}
            value={text}
            maxLength={max}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onBlur={add}
          />
          <button type="submit" disabled={!text.trim()}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}
