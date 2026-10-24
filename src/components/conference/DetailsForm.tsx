"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DISCOVERY_TOWNS } from "@/domain/discovery/towns";
import { KIND_WORDS } from "@/domain/conference/details";
import { MODULES } from "@/domain/conference/modules";
import {
  CONFERENCE_KINDS,
  type ConferenceDetails,
  type ModuleId,
} from "@/domain/conference/types";
import { call } from "./api";
import { field, primary, Problem } from "./ui";

/**
 * **Everything an organiser says about their conference.** Used to create
 * one and to edit it, against the same schema on the server, so the two can't
 * disagree about what a valid conference is.
 */
export function DetailsForm({
  conferenceId,
  initial,
}: {
  /** Absent: create. Present: edit this one. */
  conferenceId?: string;
  initial?: ConferenceDetails;
}) {
  const router = useRouter();
  const [d, setD] = useState({
    name: initial?.name ?? "",
    kind: initial?.kind ?? "conference",
    tagline: initial?.tagline ?? "",
    welcome: initial?.welcome ?? "",
    placeLabel: initial?.place.label ?? "",
    townId: initial?.place.townId ?? "",
    venueName: initial?.venue?.name ?? "",
    venueAddress: initial?.venue?.address ?? "",
    timeZone: initial?.timeZone ?? "America/Vancouver",
    startsOn: initial?.startsOn ?? "",
    endsOn: initial?.endsOn ?? "",
    accent: initial?.branding.accent ?? "#1f6feb",
    modules: new Set<ModuleId>(
      initial?.modules ??
        // Every built module, except chat (VISION §7 leans "optional and off
        // by default") and the Bingo game: one tick turns either on.
        MODULES.filter(
          (m) =>
            m.status === "built" && m.id !== "community" && m.id !== "bingo",
        ).map((m) => m.id),
    ),
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => {
    setSaved(false);
    setD((prev) => ({ ...prev, [k]: v }));
  };
  const issue = (path: string) =>
    issues[path] ? (
      <span className="mt-1 block text-[13px] text-[#b42318]">
        {issues[path]}
      </span>
    ) : null;
  const label = "block text-[13px] font-semibold text-cf-slate";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setProblem(null);
        setIssues({});
        const body = {
          name: d.name,
          kind: d.kind,
          tagline: d.tagline,
          welcome: d.welcome,
          place: { label: d.placeLabel, townId: d.townId },
          venue: { name: d.venueName, address: d.venueAddress },
          timeZone: d.timeZone,
          startsOn: d.startsOn,
          endsOn: d.endsOn,
          branding: { accent: d.accent },
          // In the registry's order, so the home page reads the same way.
          modules: MODULES.map((m) => m.id).filter((id) => d.modules.has(id)),
        };
        const r = conferenceId
          ? await call<{ conference: { id: string } }>(
              "PATCH",
              `/api/conferences/${conferenceId}`,
              body,
            )
          : await call<{ conference: { id: string } }>(
              "POST",
              "/api/conferences",
              body,
            );
        setBusy(false);
        if (!r.ok) {
          setProblem(r.message);
          setIssues(
            Object.fromEntries(
              (r.issues ?? []).map((i) => [i.path, i.message]),
            ),
          );
          return;
        }
        if (conferenceId) {
          setSaved(true);
          router.refresh();
        } else router.push(`/conferences/${r.conference.id}/admin`);
      }}
    >
      <label className={label}>
        What&apos;s it called?
        <input
          className={`${field} mt-1`}
          value={d.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Sycle Vancouver 2026"
          maxLength={80}
        />
        {issue("name")}
      </label>

      <label className={label}>
        What kind of gathering?
        <select
          className={`${field} mt-1`}
          value={d.kind}
          onChange={(e) => set("kind", e.target.value as typeof d.kind)}
        >
          {CONFERENCE_KINDS.map((k) => (
            <option key={k} value={k}>
              A {KIND_WORDS[k].noun}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={label}>
          Where?
          <input
            className={`${field} mt-1`}
            value={d.placeLabel}
            onChange={(e) => set("placeLabel", e.target.value)}
            placeholder="Vancouver"
            maxLength={80}
          />
          {issue("place.label")}
        </label>
        <label className={label}>
          Free-time ideas start from
          <select
            className={`${field} mt-1`}
            value={d.townId}
            onChange={(e) => {
              const town = DISCOVERY_TOWNS.find((t) => t.id === e.target.value);
              set("townId", e.target.value);
              if (town && !d.placeLabel)
                set("placeLabel", town.name.replace(/, BC$/, ""));
            }}
          >
            <option value="">Somewhere Passport doesn&apos;t know yet</option>
            {DISCOVERY_TOWNS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={label}>
          Venue <span className="text-cf-mist font-normal">(if you know)</span>
          <input
            className={`${field} mt-1`}
            value={d.venueName}
            onChange={(e) => set("venueName", e.target.value)}
            placeholder="Vancouver Convention Centre West"
            maxLength={80}
          />
          {issue("venue.name")}
        </label>
        <label className={label}>
          Venue address{" "}
          <span className="text-cf-mist font-normal">(optional)</span>
          <input
            className={`${field} mt-1`}
            value={d.venueAddress}
            onChange={(e) => set("venueAddress", e.target.value)}
            placeholder="1055 Canada Place"
            maxLength={120}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <label className={label}>
          Starts
          <input
            type="date"
            className={`${field} mt-1`}
            value={d.startsOn}
            onChange={(e) => set("startsOn", e.target.value)}
          />
          {issue("startsOn")}
        </label>
        <label className={label}>
          Ends <span className="text-cf-mist font-normal">(if you know)</span>
          <input
            type="date"
            className={`${field} mt-1`}
            value={d.endsOn}
            min={d.startsOn || undefined}
            onChange={(e) => set("endsOn", e.target.value)}
          />
          {issue("endsOn")}
        </label>
        <label className={label}>
          Time zone
          <input
            className={`${field} mt-1`}
            value={d.timeZone}
            list="conference-zones"
            onChange={(e) => set("timeZone", e.target.value)}
          />
          <datalist id="conference-zones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          {issue("timeZone")}
        </label>
      </div>

      <label className={label}>
        One line about it{" "}
        <span className="text-cf-mist font-normal">(optional)</span>
        <input
          className={`${field} mt-1`}
          value={d.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          placeholder="Everyone's coming to Vancouver."
          maxLength={120}
        />
      </label>

      <label className={label}>
        A welcome, in your words{" "}
        <span className="text-cf-mist font-normal">(optional)</span>
        <textarea
          className={`${field} mt-1 min-h-[96px]`}
          value={d.welcome}
          onChange={(e) => set("welcome", e.target.value)}
          maxLength={600}
        />
      </label>

      <label className={`${label} flex items-center gap-3`}>
        Your colour
        <input
          type="color"
          className="border-cf-line h-11 w-16 cursor-pointer rounded-lg border"
          value={d.accent}
          onChange={(e) => set("accent", e.target.value)}
        />
      </label>

      <fieldset>
        <legend className={label}>What people will find inside</legend>
        <div className="mt-2 flex flex-col gap-2">
          {MODULES.map((m) => (
            <label
              key={m.id}
              className="border-cf-line flex items-start gap-3 rounded-xl border bg-white p-3"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#17181b]"
                checked={d.modules.has(m.id)}
                onChange={(e) => {
                  const next = new Set(d.modules);
                  if (e.target.checked) next.add(m.id);
                  else next.delete(m.id);
                  set("modules", next);
                }}
              />
              <span>
                <span className="font-semibold">{m.label}</span>
                {m.status === "proposed" ? (
                  <span className="bg-cf-sand text-cf-slate ml-2 rounded-full px-2 py-0.5 text-[12px]">
                    not built yet
                  </span>
                ) : null}
                <span className="text-cf-slate block text-[14px]">
                  {m.promise}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <button disabled={busy} className={primary}>
          {conferenceId ? "Save" : "Create it"}
        </button>
        {saved ? (
          <span className="text-cf-slate ml-3 text-[14px]">Saved.</span>
        ) : null}
        <Problem>{problem}</Problem>
      </div>
    </form>
  );
}
