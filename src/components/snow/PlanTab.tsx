"use client";

import { useState, type ReactNode } from "react";
import {
  TOPIC_LABEL,
  TOPIC_PROMPT,
  chosenFor,
  leading,
  personName,
  proposalsFor,
  undecided,
  votesFor,
  type Topic,
} from "@/domain/snow/day";
import { MOUNTAINS } from "@/domain/snow/mountains";
import { DISCIPLINE_LABEL, groupLine } from "@/domain/snow/ability";
import { crewPick } from "@/domain/snow/itinerary";
import { packedCount } from "@/domain/snow/prep";
import { resortFacts, seasonOn } from "@/domain/snow/resorts";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, Source, btn, btnOn, field, styles } from "./kit";
import { ConditionsCard } from "./ConditionsCard";
import { MountainScene } from "./MountainScene";
import { DatePicker, ResortFactsCard, dayWords } from "./MountainFacts";
import { AroundMountain, AtlasGaps } from "./AroundMountain";
import { DayPlan } from "./DayPlan";
import { mountainOf, useNearby, useTweaks } from "./useMountainDay";

const CARDS = [
  ["mountain", "Mountain", "🏔️"],
  ["date", "Date", "📅"],
  ["crew", "Crew", "🧑‍🤝‍🧑"],
  ["transport", "Getting there", "🚗"],
  ["tickets", "Lift tickets", "🎫"],
  ["activity", "Activities", "⛸️"],
  ["meals", "Lunch", "🥪"],
  ["apres", "Après", "🍻"],
  ["gear", "Gear", "🎒"],
] as const;
type CardKey = (typeof CARDS)[number][0];

const NOT_SKIING = [
  "skating",
  "tubing",
  "snowshoe",
  "spa",
  "family",
  "events",
] as const;

/**
 * **Plan: the adventure at a glance.** One card per thing the day turns
 * on, each saying where it stands; open one to decide it. The crew still
 * votes and locks things in exactly as before (`TopicCard`) — the cards are
 * a way in, not a second store. Below: the day laid out, and what Atlas
 * actually holds around the mountain.
 */
export function PlanTab(p: TabProps) {
  const {
    mountain,
    label: mountainLabel,
    locked: mountainLocked,
  } = mountainOf(p.day);
  const facts = resortFacts(mountain?.id);
  const nearby = useNearby(mountain?.id);
  const tw = useTweaks(p.day.id);
  // Only ask what's necessary: with no mountain yet, that's the one question.
  // Decided once, so choosing the mountain doesn't snap the panel shut.
  const [opened, setOpen] = useState<CardKey | null>(() =>
    mountainLabel ? null : "mountain",
  );
  const left = undecided(p.day);
  const people = p.day.people;
  const count = (d: string) => people.filter((x) => x.discipline === d).length;
  const packed = people.reduce(
    (acc, x) => {
      const c = packedCount(p.day, x);
      return { done: acc.done + c.done, total: acc.total + c.total };
    },
    { done: 0, total: 0 },
  );
  const photos =
    nearby.status === "connected"
      ? nearby.picks
          .filter(
            (x) => x.onMountain && x.image && !x.categories.includes("events"),
          )
          .slice(0, 3)
      : [];

  function status(key: CardKey): {
    line: string;
    state: "locked" | "leaning" | "open" | "info";
  } {
    if (key === "mountain")
      return mountainLabel
        ? { line: mountainLabel, state: mountainLocked ? "locked" : "leaning" }
        : { line: "Where are we riding?", state: "open" };
    if (key === "date") {
      if (!p.day.date) return { line: "Pick a day", state: "open" };
      const season = seasonOn(facts, p.day.date);
      return {
        line: `${dayWords(p.day.date)}${season === "before" ? " · before opening" : ""}`,
        state: "locked",
      };
    }
    if (key === "crew")
      return {
        line: `${people.length} in · ${[
          count("ski") && `${count("ski")} skiing`,
          count("snowboard") && `${count("snowboard")} boarding`,
          count("apres") && `${count("apres")} not skiing`,
        ]
          .filter(Boolean)
          .join(", ")}`,
        state: "info",
      };
    if (key === "gear")
      return {
        line: `${packed.done} of ${packed.total} packed`,
        state: packed.done === packed.total ? "locked" : "open",
      };
    const c = crewPick(p.day, key);
    if (c)
      return { line: c.proposal.label, state: c.locked ? "locked" : "leaning" };
    if (key === "tickets")
      return { line: "From the resort — no prices here", state: "open" };
    return { line: "Nothing yet", state: "open" };
  }

  const STATE_WORD = {
    locked: "✓",
    leaning: "Leading",
    open: "Open",
    info: "",
  } as const;

  function panel(key: CardKey): ReactNode {
    const topic = (t: Topic) => <TopicCard topic={t} {...p} />;
    const resortList = (kind: "dining") =>
      facts?.listsOnSite && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">
            {mountain?.name}&apos;s own list ({facts.listsOnSite.dining.length})
            — not in Atlas yet
          </summary>
          <p className="mt-1 text-xs text-[var(--sn-frost)]">
            Names from{" "}
            <a
              className="underline"
              href={facts.listsOnSite.source[kind]}
              target="_blank"
              rel="noreferrer"
            >
              the resort&apos;s dining page
            </a>{" "}
            ({facts.listsOnSite.checked}). Hours and menus are theirs to say.
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {facts.listsOnSite.dining.map((n) => (
              <li
                key={n}
                className="rounded-full border border-[var(--sn-line)] px-2.5 py-0.5 text-xs"
              >
                {n}
              </li>
            ))}
          </ul>
        </details>
      );
    switch (key) {
      case "mountain":
        return (
          <>
            <ResortFactsCard
              mountain={mountain}
              facts={facts}
              today={p.today}
            />
            {topic("mountain")}
          </>
        );
      case "date":
        return (
          <>
            <DatePicker {...p} facts={facts} mountain={mountain} />
            {topic("date")}
          </>
        );
      case "crew":
        return (
          <div className="space-y-2">
            <ul className="grid gap-1 sm:grid-cols-2">
              {people.map((x) => (
                <li key={x.id} className="text-sm">
                  <strong>{x.name}</strong> · {DISCIPLINE_LABEL[x.discipline]}
                  {x.note ? ` · ${x.note}` : ""}
                </li>
              ))}
            </ul>
            <p className="text-sm text-[var(--sn-frost)]">
              {groupLine(people)}
            </p>
            <button type="button" className={btn} onClick={() => p.go("crew")}>
              Invite, add or change people
            </button>
          </div>
        );
      case "transport":
        return (
          <>
            <a
              className="text-sm underline"
              href="https://www.drivebc.ca"
              target="_blank"
              rel="noreferrer"
            >
              DriveBC road conditions ↗
            </a>
            {topic("transport")}
            {topic("meeting")}
          </>
        );
      case "tickets":
        return (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Source kind="missing">ticket prices</Source>
              Prices are the resort&apos;s to state.
              {facts?.links.tickets && (
                <a
                  className="underline"
                  href={facts.links.tickets}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buy from {mountain?.name} ↗
                </a>
              )}
            </p>
            {topic("tickets")}
          </>
        );
      case "activity":
        return (
          <>
            <AroundMountain
              {...p}
              nearby={nearby}
              mountainName={mountain?.name ?? "the mountain"}
              only={[...NOT_SKIING]}
            />
            {topic("activity")}
          </>
        );
      case "meals":
        return (
          <>
            <AroundMountain
              {...p}
              nearby={nearby}
              mountainName={mountain?.name ?? "the mountain"}
              only={["lunch"]}
            />
            {resortList("dining")}
            {topic("meals")}
          </>
        );
      case "apres":
        return (
          <>
            <AroundMountain
              {...p}
              nearby={nearby}
              mountainName={mountain?.name ?? "the mountain"}
              only={["apres"]}
            />
            {resortList("dining")}
            {topic("apres")}
          </>
        );
      case "gear":
        return (
          <div className="space-y-2 text-sm">
            <ul className="space-y-1">
              {people.map((x) => {
                const c = packedCount(p.day, x);
                return (
                  <li key={x.id}>
                    <strong>{x.name}</strong>: {c.done}/{c.total} packed
                    {x.discipline !== "apres" && !x.ownGear
                      ? " · needs rentals"
                      : ""}
                  </li>
                );
              })}
            </ul>
            <button type="button" className={btn} onClick={() => p.go("hype")}>
              Open the packing lists
            </button>
          </div>
        );
    }
  }

  return (
    <div className="space-y-5">
      <section
        className="relative isolate overflow-hidden rounded-3xl border border-[var(--sn-line)]"
        aria-label="The mountain"
        data-testid="adventure-hero"
      >
        <MountainScene className="absolute inset-0 -z-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#07121f] via-[#07121f]/40 to-transparent" />
        <div className="flex min-h-56 flex-col justify-end gap-2 p-5 sm:min-h-64">
          <p className="text-xs font-bold tracking-[0.2em] text-[var(--sn-aurora)] uppercase">
            {facts?.season
              ? `${facts.season.label} · opens ${dayWords(facts.season.opens.value)} (published)`
              : "Snow day"}
          </p>
          <p
            className="text-3xl leading-none font-black sm:text-5xl"
            data-testid="hero-mountain"
          >
            {mountainLabel ?? "Pick your mountain"}
          </p>
          <p className="text-[var(--sn-frost)]">
            {[p.day.date && dayWords(p.day.date), `${people.length} going`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {photos.length > 0 && (
            <ul
              className="mt-2 flex gap-2"
              aria-label={`On ${mountain?.name}, from Atlas`}
            >
              {photos.map((x) => (
                <li key={x.id} className="w-28 sm:w-36">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-served, relationship "exact" */}
                  <img
                    src={x.image}
                    alt={x.title}
                    title={x.attribution}
                    className="h-16 w-full rounded-xl object-cover sm:h-20"
                  />
                  <p className="mt-0.5 truncate text-[10px] text-[var(--sn-frost)]">
                    {x.title}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-label="Your adventure"
        className="grid grid-flow-dense grid-cols-2 gap-3 lg:grid-cols-3"
      >
        {CARDS.map(([key, title, icon]) => {
          const st = status(key);
          const isOpen = opened === key;
          return [
            <button
              key={key}
              type="button"
              aria-expanded={isOpen}
              aria-controls={`card-panel-${key}`}
              data-testid={`card-${key}`}
              onClick={() => setOpen(isOpen ? null : key)}
              className={`${styles.card} flex min-h-24 flex-col items-start gap-1 p-3 text-left transition hover:bg-[var(--sn-ice)]/10 ${isOpen ? "ring-2 ring-[var(--sn-aurora)]" : ""}`}
            >
              <span className="flex w-full items-center justify-between gap-2 text-xs font-bold tracking-wide text-[var(--sn-frost)] uppercase">
                <span>
                  <span aria-hidden="true">{icon}</span> {title}
                </span>
                {STATE_WORD[st.state] && (
                  <span
                    className={
                      st.state === "locked"
                        ? "text-[var(--sn-aurora)]"
                        : st.state === "leaning"
                          ? "text-[var(--sn-glow)]"
                          : ""
                    }
                  >
                    {STATE_WORD[st.state]}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 font-bold">{st.line}</span>
            </button>,
            isOpen && (
              <div
                key={`${key}-panel`}
                id={`card-panel-${key}`}
                role="region"
                aria-label={title}
                className={`${styles.card} col-span-full space-y-3 p-4`}
              >
                {panel(key)}
              </div>
            ),
          ];
        })}
      </section>
      {left.length > 0 && (
        <p className="text-sm text-[var(--sn-glow)]" data-testid="open-count">
          {left.length} {left.length === 1 ? "thing" : "things"} still to lock
          in: {left.map((t) => TOPIC_LABEL[t].toLowerCase()).join(", ")}.
        </p>
      )}

      {mountainLabel && (
        <DayPlan
          {...p}
          nearby={nearby}
          facts={facts}
          mountainName={mountain?.name ?? mountainLabel}
          tweaks={tw.tweaks}
          save={tw.save}
          undo={tw.undo}
          canUndo={tw.canUndo}
        />
      )}

      {mountain && (
        <section className="space-y-3" aria-labelledby="around-h">
          <h2 id="around-h" className="text-2xl font-black">
            Around {mountain.name}
          </h2>
          <AroundMountain {...p} nearby={nearby} mountainName={mountain.name} />
          <AtlasGaps nearby={nearby} mountainName={mountain.name} />
        </section>
      )}

      <ConditionsCard
        mountainName={mountainLabel}
        date={p.day.date}
        today={p.today}
        now={p.now}
      />
    </div>
  );
}

export function TopicCard({
  topic,
  day,
  me,
  act,
}: TabProps & { topic: Topic }) {
  const [text, setText] = useState("");
  const options = proposalsFor(day, topic);
  const chosen = chosenFor(day, topic);
  const lead = leading(day, topic);

  function add(label: string, source: "crew" | "passport-list" = "crew") {
    if (
      act({
        type: "propose",
        proposal: { id: newId(), topic, label, by: me.id, source },
      })
    )
      setText("");
  }

  return (
    <Card className="space-y-3" data-testid={`topic-${topic}`}>
      <div>
        <h2 className="text-xl font-extrabold">{TOPIC_LABEL[topic]}</h2>
        <p className="text-sm text-[var(--sn-frost)]">{TOPIC_PROMPT[topic]}</p>
      </div>
      {options.length > 0 && (
        <ul className="space-y-2">
          {options.map((o) => {
            const n = votesFor(day, o.id);
            const mine = (day.votes[o.id] ?? []).includes(me.id);
            const locked = chosen?.id === o.id;
            return (
              <li
                key={o.id}
                className={`rounded-xl border p-3 ${locked ? "border-[var(--sn-aurora)]" : "border-[var(--sn-line)]"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {o.label}
                      {locked && (
                        <span className="ml-2 text-xs font-bold text-[var(--sn-aurora)]">
                          LOCKED IN
                        </span>
                      )}
                      {!locked && lead?.id === o.id && (
                        <span className="ml-2 text-xs font-bold text-[var(--sn-glow)]">
                          LEADING
                        </span>
                      )}
                    </p>
                    {o.detail && (
                      <p className="text-xs text-[var(--sn-frost)]">
                        {o.detail}
                      </p>
                    )}
                    <p className="text-xs text-[var(--sn-frost)]">
                      {n} {n === 1 ? "vote" : "votes"}
                      {n > 0 &&
                        ` · ${(day.votes[o.id] ?? []).map((id) => personName(day, id)).join(", ")}`}
                      {` · suggested by ${personName(day, o.by)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={`${btn} ${mine ? btnOn : ""}`}
                      aria-pressed={mine}
                      onClick={() =>
                        act({
                          type: "vote",
                          proposalId: o.id,
                          personId: me.id,
                          on: !mine,
                        })
                      }
                    >
                      {mine ? "Voted" : "Vote"}
                    </button>
                    {!locked && (
                      <button
                        className={btn}
                        onClick={() =>
                          act({
                            type: "choose",
                            topic,
                            proposalId: o.id,
                            by: me.id,
                            changeId: newId(),
                          })
                        }
                      >
                        Lock it in
                      </button>
                    )}
                    {locked && (
                      <button
                        className={btn}
                        onClick={() =>
                          act({
                            type: "choose",
                            topic,
                            proposalId: null,
                            by: me.id,
                            changeId: newId(),
                          })
                        }
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      className={btn}
                      aria-label={`Remove ${o.label}`}
                      onClick={() => act({ type: "withdraw", id: o.id })}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
      >
        {topic === "mountain" && (
          <select
            className={`${field} sm:!w-56`}
            value=""
            aria-label="Add a mountain from Passport's list"
            onChange={(e) => {
              const m = MOUNTAINS.find((x) => x.id === e.target.value);
              if (m) add(m.name, "passport-list");
            }}
          >
            <option value="">Add from the list…</option>
            {MOUNTAINS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <input
          className={`${field} flex-1`}
          type={topic === "date" ? "date" : "text"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER[topic]}
          aria-label={`Suggest ${TOPIC_LABEL[topic].toLowerCase()}`}
          maxLength={80}
        />
        <button
          type="submit"
          className={`${styles.btn} min-h-11 px-4 text-sm font-semibold`}
        >
          Suggest
        </button>
      </form>
    </Card>
  );
}

const PLACEHOLDER: Record<Topic, string> = {
  date: "",
  mountain: "or type another mountain",
  transport: "Ana's car, leave 6:45 from Burnaby",
  meeting: "Base lodge deck, by the big fireplace",
  tickets: "Day tickets bought online",
  activity: "Tubing at 2, then skating",
  meals: "Packed lunch at the lodge tables",
  apres: "Hot tubs, then pizza in town",
};
