"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { agendaDays } from "@/domain/conference/agenda";
import { AGENDA_MAX } from "@/domain/conference/details";
import {
  AGENDA_KINDS,
  type AgendaItem,
  type AgendaKind,
  type ConferenceDetails,
} from "@/domain/conference/types";
import { call } from "./api";
import { field, primary, Problem, secondary } from "./ui";

type Draft = Omit<AgendaItem, "id" | "topics"> & {
  id?: string;
  /** One topic per line, as typed. */
  topicsText?: string;
};

const KIND_WORDS: Record<AgendaKind, string> = {
  session: "Session",
  skills: "Skills session",
  break: "Break",
  meal: "Meal",
  social: "Social",
  celebration: "Celebration",
  travel: "Travel",
};

const blank = (day: string): Draft => ({
  day,
  start: "09:00",
  end: "",
  title: "",
  where: "",
  note: "",
  featured: false,
  kind: "session",
  topicsText: "",
  aside: "",
});

const dayWords = (ymd: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));

const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/**
 * **The organiser publishes the agenda.** A line is a time, a title and a
 * place; an end time, a note and "featured" are optional. Every change is
 * saved as it's made, through the same details endpoint and schema as the
 * rest of the conference, so the overview and the Agenda tab change at once.
 */
export function AgendaEditor({
  conferenceId,
  details,
}: {
  conferenceId: string;
  details: ConferenceDetails;
}) {
  const router = useRouter();
  const [items, setItems] = useState<readonly AgendaItem[]>(
    details.agenda ?? [],
  );
  const days = agendaDays({ ...details, agenda: items });
  const [draft, setDraft] = useState<Draft>(() =>
    blank(days[0] ?? details.startsOn),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (next: readonly AgendaItem[]) => {
    setBusy(true);
    setProblem(null);
    setSaved(false);
    // The rest of the details exactly as the server last gave them; only
    // the agenda changes.
    const r = await call<{ conference: ConferenceDetails }>(
      "PATCH",
      `/api/conferences/${conferenceId}`,
      { ...details, agenda: next },
    );
    setBusy(false);
    if (!r.ok) {
      setProblem(r.issues?.[0]?.message ?? r.message);
      return false;
    }
    setItems(r.conference.agenda ?? []);
    setSaved(true);
    router.refresh();
    return true;
  };

  const clean = (x: Draft, id: string): AgendaItem => {
    const topics = (x.topicsText ?? "")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      id,
      day: x.day,
      start: x.start,
      ...(x.end ? { end: x.end } : {}),
      title: x.title.trim(),
      ...(x.where?.trim() ? { where: x.where.trim() } : {}),
      ...(x.note?.trim() ? { note: x.note.trim() } : {}),
      ...(x.featured ? { featured: true } : {}),
      ...(x.kind && x.kind !== "session" ? { kind: x.kind } : {}),
      ...(topics.length ? { topics } : {}),
      ...(x.aside?.trim() ? { aside: x.aside.trim() } : {}),
    };
  };

  const submit = async () => {
    if (!draft.title.trim()) return setProblem("Say what it is.");
    const id = editing ?? newId();
    const next = editing
      ? items.map((i) => (i.id === editing ? clean(draft, id) : i))
      : [...items, clean(draft, id)];
    if (await save(next)) {
      setEditing(null);
      setDraft({ ...blank(draft.day), start: draft.end || draft.start });
    }
  };

  const byDay = days
    .map((d) => ({ day: d, items: items.filter((i) => i.day === d) }))
    .filter((g) => g.items.length);

  return (
    <div data-testid="agenda-editor">
      {byDay.length ? (
        <div className="space-y-6">
          {byDay.map((g) => (
            <div key={g.day}>
              <p className="cf-eyebrow text-cf-mist">{dayWords(g.day)}</p>
              <ul className="divide-cf-line border-cf-line mt-2 divide-y rounded-xl border bg-white">
                {g.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-start gap-4 px-4 py-3"
                    data-agenda-line={i.title}
                  >
                    <span className="text-cf-ink w-[92px] shrink-0 text-[14px] font-semibold tabular-nums">
                      {i.start}
                      {i.end ? `–${i.end}` : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-cf-ink block text-[15px] font-semibold">
                        {i.title}
                        {i.featured ? (
                          <span className="bg-cf-brass/15 ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-[#7a5a28]">
                            Featured
                          </span>
                        ) : null}
                      </span>
                      <span className="text-cf-slate block text-[13px]">
                        {[
                          i.kind && i.kind !== "session"
                            ? KIND_WORDS[i.kind]
                            : null,
                          i.where,
                          i.topics?.length ? `${i.topics.length} topics` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-3 text-[13px]">
                      <button
                        type="button"
                        className="text-cf-slate font-semibold underline underline-offset-4"
                        onClick={() => {
                          setEditing(i.id);
                          setDraft({
                            ...i,
                            end: i.end ?? "",
                            where: i.where ?? "",
                            note: i.note ?? "",
                            kind: i.kind ?? "session",
                            topicsText: (i.topics ?? []).join("\n"),
                            aside: i.aside ?? "",
                          });
                        }}
                        aria-label={`Edit ${i.title}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-cf-mist underline underline-offset-4 hover:text-[#b42318]"
                        disabled={busy}
                        onClick={() =>
                          void save(items.filter((x) => x.id !== i.id))
                        }
                        aria-label={`Remove ${i.title}`}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-cf-slate text-[14px]">
          Nothing published yet. Add the first line below.
        </p>
      )}

      <form
        className="border-cf-line bg-cf-paper/60 mt-6 rounded-2xl border p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-cf-ink text-[15px] font-semibold">
          {editing ? "Change this line" : "Add to the agenda"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <label className="text-cf-slate text-[13px] font-semibold">
            Day
            <select
              className={`${field} mt-1`}
              value={draft.day}
              onChange={(e) => setDraft({ ...draft, day: e.target.value })}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {dayWords(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-cf-slate text-[13px] font-semibold">
            Starts
            <input
              type="time"
              className={`${field} mt-1`}
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              required
            />
          </label>
          <label className="text-cf-slate text-[13px] font-semibold">
            Ends <span className="text-cf-mist font-normal">(optional)</span>
            <input
              type="time"
              className={`${field} mt-1`}
              value={draft.end ?? ""}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-cf-slate text-[13px] font-semibold">
            What
            <input
              className={`${field} mt-1`}
              value={draft.title}
              maxLength={80}
              placeholder="Opening keynote"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="text-cf-slate text-[13px] font-semibold">
            Where <span className="text-cf-mist font-normal">(optional)</span>
            <input
              className={`${field} mt-1`}
              value={draft.where ?? ""}
              maxLength={80}
              placeholder="Ballroom A, Level 2"
              onChange={(e) => setDraft({ ...draft, where: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="text-cf-slate text-[13px] font-semibold">
            Kind
            <select
              className={`${field} mt-1`}
              value={draft.kind ?? "session"}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as AgendaKind })
              }
              data-testid="agenda-kind"
            >
              {AGENDA_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_WORDS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-cf-slate text-[13px] font-semibold">
            Topics{" "}
            <span className="text-cf-mist font-normal">
              (optional, one per line)
            </span>
            <textarea
              className={`${field} mt-1 h-[52px] min-h-[52px]`}
              value={draft.topicsText ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, topicsText: e.target.value })
              }
            />
          </label>
        </div>
        <label className="text-cf-slate mt-3 block text-[13px] font-semibold">
          A line of personality{" "}
          <span className="text-cf-mist font-normal">(optional)</span>
          <input
            className={`${field} mt-1`}
            value={draft.aside ?? ""}
            maxLength={120}
            placeholder="History is being made."
            onChange={(e) => setDraft({ ...draft, aside: e.target.value })}
          />
        </label>
        <label className="text-cf-slate mt-3 block text-[13px] font-semibold">
          A note <span className="text-cf-mist font-normal">(optional)</span>
          <input
            className={`${field} mt-1`}
            value={draft.note ?? ""}
            maxLength={200}
            placeholder="Doors open 15 minutes early."
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        <label className="text-cf-ink mt-3 flex items-center gap-3 text-[14px]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#17181b]"
            checked={!!draft.featured}
            onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
          />
          Featured — the one thing everybody is talking about
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className={primary}
            disabled={busy || (!editing && items.length >= AGENDA_MAX)}
          >
            {editing ? "Save the change" : "Add to the agenda"}
          </button>
          {editing ? (
            <button
              type="button"
              className={secondary}
              onClick={() => {
                setEditing(null);
                setDraft(blank(draft.day));
              }}
            >
              Cancel
            </button>
          ) : null}
          {saved ? (
            <span className="text-cf-sage text-[14px]">Published.</span>
          ) : null}
        </div>
        <Problem>{problem}</Problem>
      </form>
    </div>
  );
}
