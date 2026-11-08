"use client";

import { useState } from "react";
import {
  TOPICS,
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
import { groupLine } from "@/domain/snow/ability";
import type { TabProps } from "./tabs";
import { newId } from "./store";
import { Card, btn, btnOn, field, styles } from "./kit";
import { ConditionsCard } from "./ConditionsCard";

/**
 * **Plan: every decision a snow day turns on, voted rather than argued.**
 *
 * Each topic is a short list of options anyone can add. A vote is one per
 * person per topic; "Lock it in" makes the choice, and changing a locked
 * choice later tells the whole crew once (the last-minute-change rule).
 */
export function PlanTab(p: TabProps) {
  const open = undecided(p.day);
  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h2 className="text-xl font-extrabold">The plan so far</h2>
        <ul
          className="grid gap-1 text-sm sm:grid-cols-2"
          data-testid="plan-summary"
        >
          {TOPICS.map((t) => {
            const c = chosenFor(p.day, t);
            return (
              <li
                key={t}
                className="flex justify-between gap-3 border-b border-[var(--sn-line)] py-1"
              >
                <span className="text-[var(--sn-frost)]">{TOPIC_LABEL[t]}</span>
                <span className="font-semibold">{c ? c.label : "open"}</span>
              </li>
            );
          })}
        </ul>
        {open.length > 0 && (
          <p className="text-sm text-[var(--sn-glow)]" data-testid="open-count">
            {open.length} {open.length === 1 ? "thing" : "things"} still to lock
            in: {open.map((t) => TOPIC_LABEL[t].toLowerCase()).join(", ")}.
          </p>
        )}
        <p className="text-sm text-[var(--sn-frost)]">
          {groupLine(p.day.people)}
        </p>
      </Card>

      <ConditionsCard
        mountainName={chosenFor(p.day, "mountain")?.label}
        date={p.day.date}
        today={p.today}
        now={p.now}
      />
      <WhenCard {...p} />
      {TOPICS.map((t) => (
        <TopicCard key={t} topic={t} {...p} />
      ))}

      <Card className="space-y-1">
        <h2 className="text-xl font-extrabold">Equipment</h2>
        <p className="text-sm text-[var(--sn-frost)]">
          {p.day.people.filter((x) => x.discipline !== "apres" && !x.ownGear)
            .length > 0
            ? `Rentals needed for ${p.day.people
                .filter((x) => x.discipline !== "apres" && !x.ownGear)
                .map((x) => x.name)
                .join(", ")}. `
            : "Everyone has their own gear. "}
          Everyone&apos;s packing list is under <strong>Get ready</strong>.
        </p>
      </Card>
    </div>
  );
}

function WhenCard({ day, act }: TabProps) {
  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-extrabold">When</h2>
      <p className="text-sm text-[var(--sn-frost)]">
        Fix a date directly, or let the crew vote under Date below.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Date</span>
          <input
            type="date"
            className={field}
            value={day.date ?? ""}
            onChange={(e) =>
              act({
                type: "when",
                date: e.target.value,
                meetTime: day.meetTime,
              })
            }
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Meet at</span>
          <input
            type="time"
            className={field}
            value={day.meetTime ?? ""}
            onChange={(e) =>
              act({ type: "when", date: day.date, meetTime: e.target.value })
            }
          />
        </label>
      </div>
    </Card>
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
  meals: "Packed lunch at the lodge tables",
  apres: "Hot tubs, then pizza in town",
};
