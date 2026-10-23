"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Accessibility,
  ChevronDown,
  Footprints,
  MapPin,
  Navigation,
  Pencil,
  Send,
  Ticket,
  Users,
} from "lucide-react";
import {
  ACCESSIBILITY,
  ARENA_CHECKED,
  ENTRY_GUIDANCE,
  ROGERS_ARENA_GATES,
  SOURCES,
  gateById,
  gatesDrawnOn,
  readSection,
} from "@/domain/hockey/arena";
import {
  destinationFor,
  preferredOrder,
  walkingLinks,
  type MapLink,
} from "@/domain/hockey/directions";
import { walkLabel, type NearbyPlace } from "@/domain/hockey/nearby";
import {
  clockLabel,
  seatFacts,
  seatLine,
  seatingPicture,
  type Meetup,
  type Seat,
  type SeatPerson,
} from "@/domain/hockey/seats";
import { attributionFor } from "@/lib/routing/attribution";
import { cautionOf, isCautioned } from "@/lib/routing/journey";
import type { Leg } from "@/lib/routing/legs";
import { useTravelLegs } from "@/lib/routing/useTravelLegs";
import { distanceKm } from "@/lib/environment/geo";
import { walkMinutesFor } from "@/domain/collections/places";

/** What `GET /seats` answers (`_server/seats.ts`, `SeatsView`). */
export interface SeatsView {
  readonly available: boolean;
  readonly role: "host" | "guest";
  readonly me: string;
  readonly people: readonly (SeatPerson & { role: "host" | "guest" })[];
  readonly seats: readonly Seat[];
  readonly meetup?: Meetup;
  readonly venue: { readonly name: string; readonly at: [number, number] };
}

export interface ArenaNearby {
  readonly places: readonly NearbyPlace[];
  readonly arena?: { readonly atlasId: string; readonly at: [number, number] };
}

const tap =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-bold transition";

/** Everything `useSeats` gives the Plan tab's two seat-backed decisions. */
export type SeatsState = ReturnType<typeof useSeats>;

/**
 * **Our seats.** Plan's "Our seats" decision opened: the host's block for
 * everybody, then every member's own seat, then who's sitting together.
 * Every seat is what somebody typed; every gate is from the arena's own map,
 * chosen by the person, never guessed from a section.
 */
export function SeatsEditor({
  seats,
  say,
}: {
  seats: SeatsState;
  /** Post a line to the night's chat. */
  say: (text: string) => void;
}) {
  const { view, error, save, clear } = seats;
  const [editing, setEditing] = useState<string | null>(null);

  if (!view) {
    return (
      <p className="px-5 pb-4 text-[15px] text-[#0b1220]/60">
        {error ?? "Finding everybody's seats…"}
      </p>
    );
  }
  if (!view.available) {
    return (
      <p className="px-5 pb-4 text-[15px] text-[#0b1220]/70">
        Seats aren&apos;t switched on for this night yet. Everything else works.
      </p>
    );
  }

  const host = view.role === "host";
  const people = view.people;
  const nameOf = (id?: string) => people.find((p) => p.id === id)?.name;
  const mySeat = view.seats.find((s) => s.userId === view.me);
  const block = view.seats.find((s) => s.userId === null);
  const picture = seatingPicture(view.seats, people);

  return (
    <div id="our-seats">
      {error && (
        <p
          role="alert"
          className="mx-5 mb-2 rounded-xl bg-[#c2410c]/10 px-3 py-2 text-[14px] font-semibold text-[#9a3412]"
        >
          {error}
        </p>
      )}

      {/* The group block: the host's seats for everybody. */}
      {(block || host) && (
        <div className="px-5">
          {editing === "group" ? (
            <SeatForm
              title="The group's seats"
              initial={block}
              onCancel={() => setEditing(null)}
              onClear={
                block
                  ? () => void clear("group").then(() => setEditing(null))
                  : undefined
              }
              onSave={async (seat) => {
                if (await save({ ...seat, for: "group" })) setEditing(null);
              }}
              showShare={false}
            />
          ) : block ? (
            <div className="rounded-2xl bg-[#0b1220] p-4 text-white">
              <p className="text-[12px] font-bold tracking-[0.12em] text-[#ffd84d] uppercase">
                The group&apos;s block
              </p>
              <p className="mt-1 text-[19px] leading-snug font-bold">
                {seatLine(block)}
              </p>
              <SeatTags seat={block} dark />
              {block.note && (
                <p className="mt-1.5 text-[14px] text-white/75">{block.note}</p>
              )}
              {host && (
                <button
                  type="button"
                  onClick={() => setEditing("group")}
                  className={`${tap} mt-3 bg-white/10 text-white hover:bg-white/20`}
                >
                  <Pencil className="h-4 w-4" /> Edit the block
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing("group")}
              className={`${tap} w-full bg-[#0b1220] text-white`}
            >
              <Ticket className="h-4 w-4" /> Add the group&apos;s seats
            </button>
          )}
        </div>
      )}

      {/* Me first: the one row everybody can fill in. */}
      {!mySeat && editing !== view.me && (
        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={() => setEditing(view.me)}
            className={`${tap} w-full bg-[#ffd84d] text-[#0b1220]`}
          >
            <Ticket className="h-4 w-4" /> Add my seat
          </button>
        </div>
      )}

      <ul
        aria-label="Who's sitting where"
        className="mt-3 divide-y divide-[#0b1220]/10 border-t border-[#0b1220]/10"
      >
        {people.map((person) => {
          const seat = view.seats.find((s) => s.userId === person.id);
          const mine = person.id === view.me;
          const canEdit = mine || host;
          if (editing === person.id) {
            return (
              <li key={person.id} className="px-5 py-4">
                <SeatForm
                  title={mine ? "My seat" : `${person.name}'s seat`}
                  initial={seat}
                  sectionHint={block?.section}
                  onCancel={() => setEditing(null)}
                  onClear={
                    seat
                      ? () => void clear(person.id).then(() => setEditing(null))
                      : undefined
                  }
                  onSave={async (s) => {
                    if (await save({ ...s, for: person.id })) setEditing(null);
                  }}
                  showShare
                />
              </li>
            );
          }
          return (
            <li
              key={person.id}
              aria-label={`${person.name}${mine ? " (you)" : ""}`}
              className="flex items-start gap-3 px-5 py-3"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b1220]/[0.07] text-[20px]"
              >
                {person.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold tracking-[0.06em] text-[#0b1220]/60 uppercase">
                  {person.name}
                  {mine && " · you"}
                  {person.role === "host" && " · host"}
                </span>
                {seat ? (
                  <>
                    <span className="block text-[17px] leading-snug font-bold [overflow-wrap:anywhere]">
                      {seatLine(seat)}
                    </span>
                    <SeatTags seat={seat} />
                    {seat.note && (
                      <span className="mt-1 block text-[14px] text-[#0b1220]/70">
                        {seat.note}
                      </span>
                    )}
                    {!seat.shared && (
                      <span className="mt-1 block text-[13px] font-semibold text-[#0b1220]/55">
                        Only {mine ? "you" : person.name} and the host can see
                        this.
                      </span>
                    )}
                    {seat.updatedBy &&
                      seat.updatedBy !== person.id &&
                      nameOf(seat.updatedBy) && (
                        <span className="mt-1 block text-[13px] text-[#0b1220]/55">
                          Entered by {nameOf(seat.updatedBy)}
                        </span>
                      )}
                  </>
                ) : (
                  <span className="block text-[16px] font-semibold text-[#0b1220]/45">
                    No seat yet
                  </span>
                )}
                {canEdit && (
                  <span className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(person.id)}
                      aria-label={
                        mine
                          ? seat
                            ? "Edit my seat"
                            : "Add my seat"
                          : `${seat ? "Edit" : "Add"} ${person.name}'s seat`
                      }
                      className={`${tap} bg-[#0b1220]/[0.07] px-3 text-[#0b1220] hover:bg-[#0b1220]/[0.12]`}
                    >
                      <Pencil className="h-4 w-4" />
                      {seat ? "Edit" : "Add"}
                    </button>
                    {mine && seat && (
                      <button
                        type="button"
                        onClick={() =>
                          say(
                            `🎟️ I'm in ${seatLine(seat)}${seat.gate ? `, coming in at Gate ${seat.gate}` : ""}.`,
                          )
                        }
                        className={`${tap} bg-[#0b1220]/[0.07] px-3 text-[#0b1220] hover:bg-[#0b1220]/[0.12]`}
                      >
                        <Send className="h-4 w-4" /> Chat it
                      </button>
                    )}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <Together picture={picture} />
    </div>
  );
}

/**
 * **Getting there.** Plan's "Getting there" decision opened: the host's time
 * and place at the arena, the walk from dinner to the right door handed to the
 * map app the phone already has, and the arena's own guide to getting in.
 */
export function GettingThereEditor({
  seats,
  nearby,
  dinner,
}: {
  seats: SeatsState;
  nearby: ArenaNearby | null;
  /** The dinner vote's single leader, if there is one. */
  dinner?: string;
}) {
  const { view, error, saveMeetup, clearMeetup } = seats;
  if (!view) {
    return (
      <p className="px-5 pb-4 text-[15px] text-[#0b1220]/60">
        {error ?? "Working out the walk…"}
      </p>
    );
  }
  const mySeat = view.seats.find((s) => s.userId === view.me);
  const block = view.seats.find((s) => s.userId === null);
  return (
    <div>
      <MeetAtTheArena
        meetup={view.meetup}
        host={view.role === "host"}
        setBy={view.people.find((p) => p.id === view.meetup?.setBy)?.name}
        venue={view.venue}
        onSave={saveMeetup}
        onClear={clearMeetup}
      />
      <GettingThere
        venue={view.venue}
        nearby={nearby}
        dinner={dinner}
        mySeat={mySeat ?? block}
      />
      <ArenaGuide />
    </div>
  );
}

/** "Our seats" in one line, and whether this person still has to add theirs. */
export function seatsSummary(view: SeatsView | null): {
  value: string;
  needsMe: boolean;
} {
  if (!view) return { value: "Finding everybody's seats…", needsMe: false };
  if (!view.available)
    return { value: "Not switched on for this night", needsMe: false };
  const mine = view.seats.find((s) => s.userId === view.me);
  const block = view.seats.find((s) => s.userId === null);
  const seat = mine ?? block;
  return {
    value: seat ? seatLine(seat) : "No seats yet",
    needsMe: !mine,
  };
}

/**
 * "Getting there" in one line: the host's time and gate if there is one, and
 * whether this person is the host who still has to set it.
 */
export function gettingThereSummary(view: SeatsView | null): {
  value: string;
  needsMe: boolean;
} {
  if (!view) return { value: "Working out the walk…", needsMe: false };
  const m = view.meetup;
  if (m) {
    const where = gateById(m.gate)?.name ?? m.spot;
    return {
      value: [m.time && `${clockLabel(m.time)} at the arena`, where]
        .filter(Boolean)
        .join(" · "),
      needsMe: false,
    };
  }
  return view.role === "host"
    ? { value: "Set a time and gate", needsMe: true }
    : { value: "Walking directions", needsMe: false };
}

// ------------------------------------------------------------- the seats

function SeatTags({ seat, dark = false }: { seat: Seat; dark?: boolean }) {
  const facts = seatFacts(seat);
  const pill = `inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-bold ${
    dark ? "bg-white/12 text-white" : "bg-[#0b1220]/[0.07] text-[#0b1220]"
  }`;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {facts.level && <span className={pill}>{facts.level}</span>}
      {!facts.sectionKnown && (
        <span className={pill}>Not a section on the arena&apos;s map</span>
      )}
      {facts.gate ? (
        <span className={pill}>{facts.gate}</span>
      ) : (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-bold ${
            dark
              ? "bg-[#ffd84d]/20 text-[#ffd84d]"
              : "bg-[#c2410c]/10 text-[#9a3412]"
          }`}
        >
          Entrance not known
        </span>
      )}
    </span>
  );
}

interface SeatDraft {
  section: string;
  row: string;
  seats: string;
  gate: string;
  note: string;
  shared: boolean;
}

function SeatForm({
  title,
  initial,
  sectionHint,
  onSave,
  onCancel,
  onClear,
  showShare,
}: {
  title: string;
  initial?: Seat;
  sectionHint?: string;
  onSave: (seat: SeatDraft) => Promise<void>;
  onCancel: () => void;
  onClear?: () => void;
  showShare: boolean;
}) {
  const [draft, setDraft] = useState<SeatDraft>({
    section: initial?.section ?? sectionHint ?? "",
    row: initial?.row ?? "",
    seats: initial?.seats ?? "",
    gate: initial?.gate ?? "",
    note: initial?.note ?? "",
    shared: initial?.shared ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<SeatDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const level = readSection(draft.section).level;
  const drawn = level === "100" || level === "300" ? gatesDrawnOn(level) : [];
  const field =
    "mt-1 block min-h-11 w-full rounded-xl border border-[#0b1220]/15 bg-white px-3 text-[16px] text-[#0b1220] focus:border-[#0b1220] focus:outline-none";
  const label = "block text-[13px] font-bold text-[#0b1220]/70";

  return (
    <form
      aria-label={title}
      className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.5)]"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onSave(draft).finally(() => setBusy(false));
      }}
    >
      <p className="text-[16px] font-bold">{title}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className={label}>
          Section
          <input
            className={field}
            value={draft.section}
            onChange={(e) => set({ section: e.target.value })}
            required
            maxLength={12}
            autoComplete="off"
            placeholder="309"
          />
        </label>
        <label className={label}>
          Row
          <input
            className={field}
            value={draft.row}
            onChange={(e) => set({ row: e.target.value })}
            maxLength={8}
            autoComplete="off"
            placeholder="12"
          />
        </label>
        <label className={label}>
          Seat(s)
          <input
            className={field}
            value={draft.seats}
            onChange={(e) => set({ seats: e.target.value })}
            maxLength={24}
            autoComplete="off"
            placeholder="3-4"
          />
        </label>
      </div>
      <label className={`${label} mt-3`}>
        Entrance
        <select
          className={field}
          value={draft.gate}
          onChange={(e) => set({ gate: e.target.value })}
        >
          <option value="">Not sure yet</option>
          {ROGERS_ARENA_GATES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} — {g.where}
              {g.accessible ? "" : " (not accessible)"}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-[13px] leading-snug text-[#0b1220]/60">
        {drawn.length > 0
          ? `The arena's map draws ${list(drawn.map((g) => g.name))} on the ${level === "100" ? "Plaza Level 100" : "Level 300"} plan. It doesn't say which gate is best for a seat — your ticket might.`
          : "The arena doesn't publish which gate goes with which section. Your ticket might say."}
      </p>
      <label className={`${label} mt-3`}>
        Note
        <input
          className={field}
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          maxLength={140}
          placeholder="Aisle seat, arriving late, bringing the foam finger…"
        />
      </label>
      {showShare && (
        <label className="mt-3 flex min-h-11 items-center gap-2.5 text-[15px] font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={draft.shared}
            onChange={(e) => set({ shared: e.target.checked })}
          />
          Share with everyone on this night
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !draft.section.trim()}
          className={`${tap} bg-[#0b1220] text-white disabled:opacity-40`}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${tap} bg-[#0b1220]/[0.07] text-[#0b1220]`}
        >
          Cancel
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className={`${tap} text-[#9a3412] hover:bg-[#c2410c]/10`}
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

const list = (items: readonly string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

function Together({ picture }: { picture: ReturnType<typeof seatingPicture> }) {
  if (picture.together.length === 0 && picture.apart.length === 0) return null;
  return (
    <div className="border-t border-[#0b1220]/10 px-5 py-4">
      <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
        <Users className="h-4 w-4" /> Who&apos;s sitting together
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {picture.together.map((c) => (
          <li key={c.where} className="text-[15px] leading-snug">
            <span className="font-bold">
              {c.people.map((p) => `${p.emoji} ${p.name}`).join(", ")}
            </span>
            <span className="text-[#0b1220]/70">
              {" "}
              — {c.where}
              {c.sideBySide ? ", side by side" : ""}
            </span>
          </li>
        ))}
        {picture.apart.map((p) => (
          <li key={p.id} className="text-[15px] leading-snug text-[#0b1220]/70">
            <span className="font-bold text-[#0b1220]">
              {p.emoji} {p.name}
            </span>{" "}
            — on their own in Section {p.seat.section}
          </li>
        ))}
      </ul>
      {picture.unknown.length > 0 && (
        <p className="mt-2 text-[13.5px] text-[#0b1220]/55">
          Not known yet: {picture.unknown.map((p) => p.name).join(", ")}.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------- meeting point

function MeetAtTheArena({
  meetup,
  host,
  setBy,
  venue,
  onSave,
  onClear,
}: {
  meetup?: Meetup;
  host: boolean;
  setBy?: string;
  venue: SeatsView["venue"];
  onSave: (m: { gate: string; spot: string; time: string }) => Promise<boolean>;
  onClear: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ gate: "", spot: "", time: "" });
  const edit = () => {
    setDraft({
      gate: meetup?.gate ?? "",
      spot: meetup?.spot ?? "",
      time: meetup?.time ?? "",
    });
    setEditing(true);
  };
  const gate = gateById(meetup?.gate);
  const destination = destinationFor(venue, gate);
  const links = usePreferred(walkingLinks(destination));
  const field =
    "mt-1 block min-h-11 w-full rounded-xl border border-[#0b1220]/15 bg-white px-3 text-[16px] text-[#0b1220] focus:border-[#0b1220] focus:outline-none";

  if (!meetup && !host) return null;
  return (
    <div
      id="meet-at-the-arena"
      className="border-t border-[#0b1220]/10 px-5 py-4"
    >
      <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
        <MapPin className="h-4 w-4" /> Meet at the arena
      </p>
      {editing ? (
        <form
          aria-label="Meeting point"
          className="mt-2 rounded-2xl bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(draft).then((ok) => ok && setEditing(false));
          }}
        >
          <label className="block text-[13px] font-bold text-[#0b1220]/70">
            Gate
            <select
              className={field}
              value={draft.gate}
              onChange={(e) => setDraft({ ...draft, gate: e.target.value })}
            >
              <option value="">No gate</option>
              {ROGERS_ARENA_GATES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.where}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-[13px] font-bold text-[#0b1220]/70">
            Where exactly
            <input
              className={field}
              value={draft.spot}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, spot: e.target.value })}
              placeholder="Outside, by the Gate 10 doors"
            />
          </label>
          <label className="mt-3 block text-[13px] font-bold text-[#0b1220]/70">
            Time
            <input
              type="time"
              className={field}
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!draft.gate && !draft.spot.trim()}
              className={`${tap} bg-[#0b1220] text-white disabled:opacity-40`}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={`${tap} bg-[#0b1220]/[0.07] text-[#0b1220]`}
            >
              Cancel
            </button>
            {meetup && (
              <button
                type="button"
                onClick={() =>
                  void onClear().then((ok) => ok && setEditing(false))
                }
                className={`${tap} text-[#9a3412] hover:bg-[#c2410c]/10`}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      ) : meetup ? (
        <>
          <p className="mt-1.5 text-[19px] leading-snug font-bold">
            {[gate?.name, meetup.spot].filter(Boolean).join(" · ")}
            {meetup.time && (
              <span className="text-[#c2410c]">
                {" "}
                · {clockLabel(meetup.time)}
              </span>
            )}
          </p>
          {gate && (
            <p className="mt-0.5 text-[14px] text-[#0b1220]/65">{gate.where}</p>
          )}
          {setBy && (
            <p className="mt-0.5 text-[13px] text-[#0b1220]/55">
              Set by {setBy}
            </p>
          )}
          <MapButtons
            links={links}
            label={`Walking directions to ${destination.name}`}
          />
          {destination.because && (
            <p className="mt-2 text-[13.5px] leading-snug text-[#0b1220]/65">
              {destination.because}
            </p>
          )}
          {host && (
            <button
              type="button"
              onClick={edit}
              className={`${tap} mt-2 bg-[#0b1220]/[0.07] text-[#0b1220]`}
            >
              <Pencil className="h-4 w-4" /> Change it
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={edit}
          className={`${tap} mt-2 w-full bg-[#0b1220]/[0.07] text-[#0b1220]`}
        >
          <MapPin className="h-4 w-4" /> Set a meeting point
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------- the walk

const HERE = "here";

function GettingThere({
  venue,
  nearby,
  dinner,
  mySeat,
}: {
  venue: SeatsView["venue"];
  nearby: ArenaNearby | null;
  dinner?: string;
  mySeat?: Seat;
}) {
  const places = useMemo(
    () => (nearby?.places ?? []).filter((p) => p.at),
    [nearby],
  );
  const dinnerPlace = dinner
    ? places.find((p) => p.name === dinner)
    : undefined;
  const [fromId, setFromId] = useState<string>();
  const chosenFrom = fromId ?? dinnerPlace?.atlasId ?? HERE;
  const from = places.find((p) => p.atlasId === chosenFrom);
  const [gateId, setGateId] = useState<string>();
  const gate = gateById(gateId ?? mySeat?.gate);
  const destination = destinationFor(venue, gate);
  const links = usePreferred(
    walkingLinks(
      destination,
      from?.at
        ? {
            name: from.name,
            at: { latitude: from.at[0], longitude: from.at[1] },
          }
        : undefined,
    ),
  );

  // Atlas routes between places it holds, by id: a walk from an Atlas
  // restaurant to the arena as Atlas holds it. Anything else is not asked.
  const arena = nearby?.arena;
  const legs = useMemo<Leg[]>(
    () =>
      from?.at && from.source !== "curated" && arena
        ? [
            {
              from: {
                id: from.atlasId,
                name: from.name,
                at: { latitude: from.at[0], longitude: from.at[1] },
              },
              to: {
                id: arena.atlasId,
                name: venue.name,
                at: { latitude: arena.at[0], longitude: arena.at[1] },
              },
            },
          ]
        : [],
    [from, arena, venue.name],
  );
  const travel = useTravelLegs(legs, "walking");
  const journey = travel.journeys[0];
  const straight = from?.at
    ? distanceKm(
        { latitude: from.at[0], longitude: from.at[1] },
        { latitude: venue.at[0], longitude: venue.at[1] },
      )
    : undefined;

  let estimate: string | undefined;
  let basis: string | undefined;
  if (journey?.kind === "routed" && !isCautioned(journey)) {
    estimate = `${journey.minutes} min walk`;
    basis = `${journey.roadKm.toFixed(1)} km on foot, routed by Atlas. To ${venue.name}, not to a particular door.`;
  } else if (straight !== undefined) {
    estimate = walkLabel({
      km: straight,
      walkMinutes: walkMinutesFor(straight),
    });
    basis =
      journey?.kind === "routed"
        ? `Atlas's route came with a caution (${cautionOf(journey)}), so it isn't used.`
        : travel.status === "loading"
          ? "Asking Atlas for a walking route…"
          : "A straight line at walking pace — a real walk can only be longer.";
  }
  const credits = attributionFor(
    journey?.kind === "routed" && !isCautioned(journey) ? [journey] : [],
  );
  const field =
    "mt-1 block min-h-11 w-full rounded-xl border border-[#0b1220]/15 bg-white px-3 text-[16px] text-[#0b1220] focus:border-[#0b1220] focus:outline-none";

  return (
    <div
      id="getting-there"
      className="border-t border-[#0b1220]/10 bg-[#e8eff7] px-5 py-4"
    >
      <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
        <Footprints className="h-4 w-4" /> Getting there
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-[13px] font-bold text-[#0b1220]/70">
          From
          <select
            className={field}
            value={chosenFrom}
            onChange={(e) => setFromId(e.target.value)}
          >
            <option value={HERE}>Where I am now</option>
            {dinnerPlace && (
              <option value={dinnerPlace.atlasId}>
                {dinnerPlace.name} (dinner pick)
              </option>
            )}
            {places
              .filter((p) => p.atlasId !== dinnerPlace?.atlasId)
              .map((p) => (
                <option key={p.atlasId} value={p.atlasId}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-[13px] font-bold text-[#0b1220]/70">
          To
          <select
            className={field}
            value={gate?.id ?? ""}
            onChange={(e) => setGateId(e.target.value)}
          >
            <option value="">{venue.name} — entrance not chosen</option>
            {ROGERS_ARENA_GATES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.where}
              </option>
            ))}
          </select>
        </label>
      </div>

      {estimate && (
        <p
          className="mt-3 text-[19px] leading-snug font-bold"
          aria-live="polite"
        >
          {estimate}
        </p>
      )}
      {basis && (
        <p className="mt-0.5 text-[13.5px] leading-snug text-[#0b1220]/65">
          {basis}
        </p>
      )}
      {!from && (
        <p className="mt-3 text-[14px] text-[#0b1220]/65">
          Your map app starts from wherever your phone is.
        </p>
      )}

      <MapButtons
        links={links}
        label={`Walking directions${from ? ` from ${from.name}` : ""} to ${destination.name}`}
      />
      {destination.because && (
        <p className="mt-2 text-[13.5px] leading-snug text-[#0b1220]/65">
          {destination.because}
        </p>
      )}
      {!gate && (
        <p className="mt-2 text-[13.5px] leading-snug font-semibold text-[#9a3412]">
          Entrance not chosen — directions end at {venue.name}. Pick a gate from
          your ticket to see where it is.
        </p>
      )}
      <InsideNote seat={mySeat} />
      {credits.map((line) => (
        <p key={line} className="mt-2 text-[12px] text-[#0b1220]/50">
          {line}
        </p>
      ))}
    </div>
  );
}

function InsideNote({ seat }: { seat?: Seat }) {
  const level = seat ? readSection(seat.section).levelName : undefined;
  return (
    <>
      <p className="mt-2 text-[13.5px] leading-snug text-[#0b1220]/65">
        <span className="font-bold text-[#0b1220]">Inside: </span>
        {seat && level
          ? `Section ${seat.section} is on ${level}, by the arena's map. `
          : ""}
        Passport has no indoor directions — the arena&apos;s map and the ushers
        do.
      </p>
      <a
        href={SOURCES.map.url}
        target="_blank"
        rel="noreferrer"
        className={`${tap} mt-2 bg-white text-[#0b1220]`}
      >
        <MapPin className="h-4 w-4" /> The arena&apos;s map
      </a>
    </>
  );
}

function MapButtons({
  links,
  label,
}: {
  links: readonly MapLink[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="mt-3 flex flex-wrap gap-2">
      {links.map((link, i) => (
        <a
          key={link.app}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={`${tap} ${
            i === 0
              ? "bg-[#0b1220] text-white"
              : "bg-[#0b1220]/[0.07] text-[#0b1220]"
          }`}
        >
          <Navigation className="h-4 w-4" /> {link.label}
        </a>
      ))}
    </div>
  );
}

const noSubscription = () => () => {};

function usePreferred(links: MapLink[]): MapLink[] {
  const agent = useSyncExternalStore(
    noSubscription,
    () => navigator.userAgent,
    () => "",
  );
  return preferredOrder(links, agent);
}

// --------------------------------------------------------- arena guide

function ArenaGuide() {
  return (
    <details className="group border-t border-[#0b1220]/10 px-5 py-1">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-bold">
        <span className="flex items-center gap-2">
          <Accessibility className="h-4 w-4" /> Gates, getting in, accessibility
        </span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="pb-4 text-[14px] leading-snug text-[#0b1220]/80">
        <p className="text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
          Gates, as the arena&apos;s map draws them
        </p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {ROGERS_ARENA_GATES.map((g) => (
            <li key={g.id}>
              <span className="font-bold">{g.name}</span> — {g.where}.{" "}
              {g.note ?? ""}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
          Getting in
        </p>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
          {ENTRY_GUIDANCE.map((g) => (
            <li key={g.text}>{g.text}</li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
          Accessibility
        </p>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
          {ACCESSIBILITY.map((g) => (
            <li key={g.text}>{g.text}</li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-[#0b1220]/60">
          The arena doesn&apos;t publish which gate serves which section, so
          Passport never picks one for you. From the arena&apos;s own pages,
          checked {ARENA_CHECKED}:
        </p>
        <ul className="mt-1 flex flex-col">
          {Object.values(SOURCES).map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-10 items-center text-[14px] font-semibold underline"
              >
                {s.label.replace(/ \(.*\)$/, "")}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

// ------------------------------------------------------------- the data

/** The night's seats and meeting point, kept fresh while the page is looked at. */
export function useSeats(slug: string, enabled = true) {
  const [view, setView] = useState<SeatsView | null>(null);
  const [error, setError] = useState<string>();
  const url = `/hockey/api/occasions/${slug}/seats`;

  const load = useCallback(
    () =>
      fetch(url, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then((body: SeatsView) => setView(body))
        .catch(() => setError((e) => e ?? "Couldn't load seats just now.")),
    [url],
  );

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: SeatsView) => current && setView(body))
      .catch(() => current && setError("Couldn't load seats just now."));
    // Same rhythm as the rest of the night: only while the page is looked at.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [url, load, enabled]);

  const send = async (
    method: "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<boolean> => {
    try {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as
        SeatsView | { error?: string };
      if (!res.ok) {
        setError(("error" in json && json.error) || "That didn't save.");
        return false;
      }
      setError(undefined);
      setView(json as SeatsView);
      return true;
    } catch {
      setError("That didn't save. Check your connection.");
      return false;
    }
  };

  return {
    view,
    error,
    save: (seat: SeatDraft & { for: string }) => send("PUT", url, seat),
    clear: (forWho: string) =>
      send("DELETE", `${url}?for=${encodeURIComponent(forWho)}`),
    saveMeetup: (m: { gate: string; spot: string; time: string }) =>
      send("PUT", `/hockey/api/occasions/${slug}/meetup`, m),
    clearMeetup: () => send("DELETE", `/hockey/api/occasions/${slug}/meetup`),
  };
}
