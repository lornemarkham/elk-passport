"use client";

import { useState } from "react";
import type { ArrivalsView } from "@/lib/conference-arrivals/service";
import { field, primary, Problem, secondary } from "@/components/conference/ui";

type Issue = { path: string; message: string };

/** Your flight: enter it, choose whether to share it, change or remove it. */
export function MyFlight({
  conferenceId,
  conferenceName,
  place,
  airport,
  you,
  mine,
  onSaved,
}: {
  conferenceId: string;
  conferenceName: string;
  place: string;
  /** `YVR`: the airport the board is for. */
  airport: string;
  you: ArrivalsView["you"];
  mine: ArrivalsView["mine"];
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(!mine);
  const [flight, setFlight] = useState(mine?.flight ?? "");
  const [date, setDate] = useState(mine?.date ?? "");
  const [from, setFrom] = useState(mine?.from ?? "");
  const [lands, setLands] = useState(mine?.lands ?? "");
  const [shared, setShared] = useState(mine?.shared ?? false);
  const [displayName, setDisplayName] = useState(you.displayName ?? "");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const url = `/api/conferences/${conferenceId}/arrivals/me`;
  const issue = (path: string) =>
    issues.find((i) => i.path === path)?.message ?? "";

  async function send(method: "PUT" | "DELETE", body?: object) {
    setBusy(true);
    setProblem("");
    setIssues([]);
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await r.json().catch(() => ({}))) as { issues?: Issue[] };
      if (!r.ok) {
        setIssues(data.issues ?? []);
        if (!data.issues?.length) setProblem("That didn't work. Try again?");
        return false;
      }
      await onSaved();
      return true;
    } catch {
      setProblem("Couldn't reach Passport. Are you online?");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (mine && !editing)
    return (
      <div className="bg-cf-sand rounded-2xl p-4">
        <p className="text-[17px] font-bold">
          {mine.flight}
          {mine.from ? ` from ${mine.from}` : ""} · {mine.date}
        </p>
        <p className="text-cf-slate text-[15px]">
          {mine.lands
            ? `Lands ${mine.lands.slice(0, 10)} at ${mine.lands.slice(11, 16)}, scheduled.`
            : `No landing time given.`}
        </p>
        <p className="text-cf-slate mt-1 text-[15px]">
          {mine.shared
            ? `Shared with ${conferenceName} as ${you.displayName}.`
            : "Only you can see it."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={secondary}
            onClick={() => setEditing(true)}
          >
            Change
          </button>
          <button
            type="button"
            className={secondary}
            disabled={busy}
            onClick={() =>
              void send("PUT", { ...mine, shared: !mine.shared, displayName })
            }
          >
            {mine.shared ? "Stop sharing" : "Share it"}
          </button>
          <button
            type="button"
            className={secondary}
            disabled={busy}
            onClick={() => void send("DELETE")}
          >
            Remove my flight
          </button>
        </div>
        <Problem>{problem || issue("displayName")}</Problem>
      </div>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await send("PUT", {
            flight,
            date,
            from,
            lands,
            shared,
            displayName,
          })
        )
          setEditing(false);
      }}
    >
      <label className="block">
        <span className="text-[15px] font-semibold">Flight</span>
        <input
          className={`${field} mt-1 uppercase`}
          aria-describedby="flight-hint"
          value={flight}
          onChange={(e) => setFlight(e.target.value)}
          placeholder="AC123"
          autoCapitalize="characters"
          autoComplete="off"
          name="flight"
          required
        />
      </label>
      <p id="flight-hint" className="text-cf-mist -mt-3 text-[13px]">
        The flight that lands in {place}. Ticket says &ldquo;operated by&rdquo;
        another airline? Use their number: it&apos;s what the aircraft calls
        itself.
      </p>
      <Problem>{issue("flight")}</Problem>
      <label className="block">
        <span className="text-[15px] font-semibold">Date it leaves</span>
        <input
          className={`${field} mt-1`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          name="date"
          required
        />
      </label>
      <Problem>{issue("date")}</Problem>
      <label className="block">
        <span className="text-[15px] font-semibold">
          Lands in {place}{" "}
          <span className="text-cf-mist font-normal">(optional)</span>
        </span>
        <input
          className={`${field} mt-1`}
          type="datetime-local"
          value={lands}
          onChange={(e) => setLands(e.target.value)}
          aria-describedby="lands-hint"
          name="lands"
        />
      </label>
      <p id="lands-hint" className="text-cf-mist -mt-3 text-[13px]">
        From your booking, {airport} local time. Everyone sees it marked
        &ldquo;scheduled&rdquo;: it&apos;s your word, not the airline&apos;s.
      </p>
      <Problem>{issue("lands")}</Problem>
      <label className="block">
        <span className="text-[15px] font-semibold">
          Flying from{" "}
          <span className="text-cf-mist font-normal">
            (airport code, optional)
          </span>
        </span>
        <input
          className={`${field} mt-1 uppercase`}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="YYZ"
          maxLength={4}
          aria-describedby="from-hint"
          autoCapitalize="characters"
          autoComplete="off"
          name="from"
        />
      </label>
      <p id="from-hint" className="text-cf-mist -mt-3 text-[13px]">
        Helps Passport be sure it&apos;s your plane.
      </p>
      <Problem>{issue("from")}</Problem>

      <label className="border-cf-line flex items-start gap-3 rounded-2xl border p-4">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={shared}
          onChange={(e) => setShared(e.target.checked)}
          name="shared"
        />
        <span>
          <span className="block text-[16px] font-bold">
            Share my flight with {conferenceName}
          </span>
          <span className="text-cf-slate block text-[14px]">
            Everyone in it will see your name, flight number, route and your
            aircraft&apos;s live position. It also shows your name on the{" "}
            {conferenceName} home page. Nobody outside it sees anything.
          </span>
        </span>
      </label>
      {shared ? (
        <label className="block">
          <span className="text-[15px] font-semibold">Name on the map</span>
          <input
            className={`${field} mt-1`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Dave, or Dave from Finance"
            maxLength={40}
            name="displayName"
          />
          <Problem>{issue("displayName")}</Problem>
        </label>
      ) : null}

      <div className="flex gap-2">
        <button className={primary} disabled={busy}>
          {busy ? "Saving…" : "Save my flight"}
        </button>
        {mine ? (
          <button
            type="button"
            className={secondary}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <Problem>{problem}</Problem>
    </form>
  );
}
