"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AGENDA_FILE_FORMAT,
  planImport,
  readAgendaFile,
  type AgendaFile,
} from "@/domain/conference/agendaImport";
import type { ConferenceDetails } from "@/domain/conference/types";
import { call } from "./api";
import { field, primary, Problem, secondary } from "./ui";

const FIELD_WORDS: Record<string, string> = {
  startsOn: "First day",
  endsOn: "Last day",
  timeZone: "Time zone",
  venue: "Venue",
  tagline: "Tagline",
  welcome: "Welcome",
  objectives: "Objectives",
};

/**
 * **Import the agenda from the organiser's file — as often as it changes.**
 *
 * Paste the file or choose it; the preview says exactly what will happen
 * (new lines, changed lines, unchanged, lines already here that the file
 * doesn't mention, and any change to the dates, time zone or venue) before
 * anything is saved. Lines are matched by their id, so importing the same
 * file again changes nothing, and a corrected room changes one line. It
 * saves through the same endpoint and schema as every other edit.
 */
export function AgendaImport({
  conferenceId,
  details,
}: {
  conferenceId: string;
  details: ConferenceDetails;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<AgendaFile | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const read = (t: string) => {
    setText(t);
    setDone(null);
    if (!t.trim()) return (setFile(null), setProblem(null));
    const r = readAgendaFile(t);
    if (r.ok) {
      setFile(r.file);
      setProblem(null);
    } else {
      setFile(null);
      setProblem(r.problem);
    }
  };

  const plan = file ? planImport(details, file, { replace }) : null;

  const apply = async () => {
    if (!plan?.ok) return;
    setBusy(true);
    setProblem(null);
    const r = await call<{ conference: ConferenceDetails }>(
      "PATCH",
      `/api/conferences/${conferenceId}`,
      plan.details,
    );
    setBusy(false);
    if (!r.ok) return setProblem(r.issues?.[0]?.message ?? r.message);
    setDone(
      `Imported: ${plan.added.length} added, ${plan.updated.length} updated, ${plan.unchanged} unchanged.`,
    );
    setText("");
    setFile(null);
    router.refresh();
  };

  return (
    <details
      className="cf-details border-cf-line group rounded-2xl border bg-white"
      data-testid="agenda-import"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span>
          <span className="text-cf-ink block text-[15px] font-semibold">
            Import an agenda file
          </span>
          <span className="text-cf-slate block text-[13px]">
            Safe to repeat: lines are matched by id, never doubled.
          </span>
        </span>
        <span className="text-cf-slate text-[13px] font-semibold group-open:hidden">
          Open
        </span>
      </summary>
      <div className="border-cf-line border-t p-4">
        <label className="text-cf-slate block text-[13px] font-semibold">
          Choose the file
          <input
            type="file"
            accept="application/json,.json"
            className="mt-1 block w-full text-[14px]"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) read(await f.text());
            }}
            data-testid="agenda-import-file"
          />
        </label>
        <label className="text-cf-slate mt-3 block text-[13px] font-semibold">
          …or paste it
          <textarea
            className={`${field} mt-1 h-32 font-mono text-[12px]`}
            value={text}
            onChange={(e) => read(e.target.value)}
            placeholder={`{ "format": "${AGENDA_FILE_FORMAT}", "agenda": [ … ] }`}
            spellCheck={false}
            data-testid="agenda-import-text"
          />
        </label>
        <Problem>{problem}</Problem>

        {plan && !plan.ok ? (
          <Problem>
            {plan.issues
              .slice(0, 3)
              .map((i) => `${i.path ? `${i.path}: ` : ""}${i.message}`)
              .join(" · ")}
          </Problem>
        ) : null}

        {plan?.ok ? (
          <div
            className="bg-cf-paper mt-4 rounded-xl p-4 text-[14px]"
            data-testid="agenda-import-preview"
          >
            <p className="text-cf-ink font-semibold">
              {plan.nothingToDo
                ? "Already up to date — importing this file changes nothing."
                : "What importing will do"}
            </p>
            <ul className="text-cf-slate mt-2 space-y-1">
              <li data-testid="import-added">{plan.added.length} new lines</li>
              <li data-testid="import-updated">
                {plan.updated.length} changed
                {plan.updated.length
                  ? `: ${plan.updated
                      .slice(0, 4)
                      .map((u) => u.title)
                      .join(", ")}${plan.updated.length > 4 ? "…" : ""}`
                  : ""}
              </li>
              <li data-testid="import-unchanged">{plan.unchanged} unchanged</li>
              {plan.notInFile.length ? (
                <li>
                  {plan.notInFile.length} already here and not in the file
                  {replace ? " — will be removed" : " — kept"}:{" "}
                  {plan.notInFile
                    .slice(0, 4)
                    .map((x) => x.title)
                    .join(", ")}
                </li>
              ) : null}
              {plan.conference.map((c) => (
                <li key={c.field} className="text-cf-ink">
                  {FIELD_WORDS[c.field]}: {c.from ?? "not set"} →{" "}
                  <strong>
                    {c.field === "welcome" ? "the file's welcome" : c.to}
                  </strong>
                </li>
              ))}
              {plan.dayTitlesChanged ? <li>Day headings updated</li> : null}
              {plan.turnsOnAgenda ? (
                <li className="text-cf-ink">
                  The Agenda tab is switched on for everyone
                </li>
              ) : null}
            </ul>
            {plan.notInFile.length ? (
              <label className="text-cf-ink mt-3 flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#17181b]"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                />
                Make the file the whole agenda (remove lines not in it)
              </label>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={primary}
                disabled={busy || plan.nothingToDo}
                onClick={() => void apply()}
                data-testid="agenda-import-apply"
              >
                {busy ? "Importing…" : "Import and publish"}
              </button>
              <button
                type="button"
                className={secondary}
                onClick={() => read("")}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {done ? (
          <p
            className="text-cf-sage mt-3 text-[14px]"
            data-testid="agenda-import-done"
          >
            {done}
          </p>
        ) : null}
      </div>
    </details>
  );
}
