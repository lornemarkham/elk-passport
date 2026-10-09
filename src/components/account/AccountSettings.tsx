"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { PassportProfile } from "@/lib/profile/profileService";
import { OCTOBER_PLACES, placeFrom } from "@/domain/environment/places";
import {
  CONTENT_COMFORT_OPTIONS,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  PREFERENCES,
  type Preferences,
} from "@/lib/preferences/vocabulary";

/**
 * **The one page where Passport asks anything.**
 *
 * Everything here is optional and everything has a working default, so a person
 * who never opens this page loses nothing. That is the contract — Passport
 * gives before it asks — and this page exists for the traveller who *wants* to
 * tell it something, not as a toll gate somebody passes on the way in.
 *
 * Saves happen per control, immediately. There is no Save button because there
 * is nothing to lose by leaving: a settings form that discards your answer
 * because you navigated away is a settings form that trains people not to use
 * it.
 *
 * Two sections, and the split is the architecture showing through: **You** is
 * account fact, **What you like** is explicit preference. They are different
 * tables with different rules, and a future learned-signals layer may write to
 * neither.
 */
interface AccountSettingsProps {
  readonly profile: PassportProfile;
  readonly preferences: Preferences;
}

export function AccountSettings({
  profile: initialProfile,
  preferences: initialPreferences,
}: AccountSettingsProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [busy, setBusy] = useState<string | null>(null);

  async function saveProfileField(
    field: "displayName" | "homeArea" | "timezone",
    value: string,
  ) {
    setBusy(field);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setProfile(await response.json());
      toast.success("Saved.");
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function savePreference(name: string, value: unknown) {
    const previous = preferences;
    // Optimistic: a checkbox that waits for a round trip before moving feels
    // broken on a phone. Rolled back below if the write actually failed.
    setPreferences({ ...preferences, [name]: value } as Preferences);
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [name]: value }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json();
      setPreferences(body.preferences);
    } catch {
      setPreferences(previous);
      toast.error("Couldn't save that. Please try again.");
    }
  }

  const toggleInterest = (interest: string) => {
    const next = preferences.interests.includes(interest)
      ? preferences.interests.filter((i) => i !== interest)
      : [...preferences.interests, interest];
    savePreference("interests", next);
  };

  return (
    <div className="flex flex-col gap-10">
      <Section
        title="You"
        blurb="Account details. Only what actually changes something."
      >
        <TextField
          label="Display name"
          help="What other people on a shared board see."
          value={profile.displayName}
          busy={busy === "displayName"}
          onCommit={(v) => saveProfileField("displayName", v)}
        />
        <AreaField
          value={profile.homeArea ?? ""}
          busy={busy === "homeArea"}
          onCommit={(v) => saveProfileField("homeArea", v)}
        />
        <div>
          <p className="text-foreground text-sm font-medium">Email</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {profile.email ?? "—"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Changing this is handled by your sign-in provider.
          </p>
        </div>
      </Section>

      <Section
        title="What you like"
        blurb="Things you have said about yourself. Nothing here is guessed, and nothing is required."
      >
        <fieldset>
          <legend className="text-foreground text-sm font-medium">
            {PREFERENCES.interests.label}
          </legend>
          <p className="text-muted-foreground mt-0.5 mb-2 text-xs">
            {PREFERENCES.interests.help}
          </p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => {
              const on = preferences.interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleInterest(interest)}
                  className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
                    on
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-primary/20 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </fieldset>

        <ChoiceField
          label={PREFERENCES.contentComfort.label}
          help={PREFERENCES.contentComfort.help}
          options={CONTENT_COMFORT_OPTIONS}
          value={preferences.contentComfort}
          onChange={(v) => savePreference("contentComfort", v)}
        />

        <ChoiceField
          label={PREFERENCES.pace.label}
          help={PREFERENCES.pace.help}
          options={PACE_OPTIONS}
          value={preferences.pace}
          onChange={(v) => savePreference("pace", v)}
        />

        <ToggleField
          label={PREFERENCES.reduceMotion.label}
          help={PREFERENCES.reduceMotion.help}
          value={preferences.reduceMotion}
          onChange={(v) => savePreference("reduceMotion", v)}
        />

        <ToggleField
          label={PREFERENCES.shareBoardsByDefault.label}
          help={PREFERENCES.shareBoardsByDefault.help}
          value={preferences.shareBoardsByDefault}
          onChange={(v) => savePreference("shareBoardsByDefault", v)}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-foreground font-serif text-2xl">{title}</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Commits on blur rather than on every keystroke — one write per thought, not
 * one per letter — and on Enter, because on a phone that is the only obvious
 * way to say "done".
 */
function TextField({
  label,
  help,
  value,
  placeholder,
  busy,
  onCommit,
}: {
  label: string;
  help: string;
  value: string;
  placeholder?: string;
  busy: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <label className="block">
      <span className="text-foreground text-sm font-medium">{label}</span>
      <span className="text-muted-foreground mt-0.5 block text-xs">{help}</span>
      <input
        value={draft}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="border-primary/25 text-foreground mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base disabled:opacity-60"
      />
    </label>
  );
}

/**
 * **My October area** — the one thing weather needs and Passport cannot work
 * out on its own.
 *
 * It writes to `home_area`, the field that has existed on `passport_profiles`
 * since the profile did and that nothing has ever read. No migration, no new
 * table, no preference vocabulary: the column was already the right shape and
 * was only ever missing a reader.
 *
 * ## Why a list rather than the text box it replaces
 *
 * October resolves an area to coordinates through a hand-verified list of the
 * twenty places this product serves, and an area outside that list gets no
 * weather at all. A text box invites "vernon" and then silently fails to
 * match, which is a worse experience than not offering the feature. A list
 * cannot be typed wrong.
 *
 * Anything already stored that is not on the list is kept and offered as its
 * own option, because quietly overwriting what somebody typed is not an
 * upgrade. It simply gets no forecast until they pick a listed area.
 */
function AreaField({
  value,
  busy,
  onCommit,
}: {
  value: string;
  busy: boolean;
  onCommit: (value: string) => void;
}) {
  const known = OCTOBER_PLACES.some((a) => a.name === value);
  const resolves = Boolean(placeFrom(value));

  return (
    <label className="block">
      <span className="text-foreground text-sm font-medium">
        My October area
      </span>
      <span className="text-muted-foreground mt-0.5 block text-xs">
        Where your October mostly happens. Used for sunset and weather. Your
        device location is never read.
      </span>
      <select
        data-testid="october-area"
        value={value}
        disabled={busy}
        onChange={(e) => onCommit(e.target.value)}
        className="border-primary/25 text-foreground mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base disabled:opacity-60"
      >
        <option value="">Not set</option>
        {/* Kept rather than overwritten, and honestly labelled. */}
        {value && !known ? (
          <option value={value}>{value} — not a listed area</option>
        ) : null}
        {OCTOBER_PLACES.map((area) => (
          <option key={area.id} value={area.name}>
            {area.name}
          </option>
        ))}
      </select>
      {value && !resolves ? (
        <span
          data-testid="october-area-unresolved"
          className="text-muted-foreground mt-1 block text-xs"
        >
          October has no forecast for that one. Pick a listed area to see sunset
          and weather.
        </span>
      ) : null}
    </label>
  );
}

function ChoiceField<T extends string>({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string;
  help: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-foreground text-sm font-medium">{label}</legend>
      <p className="text-muted-foreground mt-0.5 mb-2 text-xs">{help}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
              option === value
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-primary/20 text-muted-foreground hover:border-primary/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ToggleField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary mt-1 h-5 w-5 shrink-0"
      />
      <span>
        <span className="text-foreground block text-sm font-medium">
          {label}
        </span>
        <span className="text-muted-foreground block text-xs">{help}</span>
      </span>
    </label>
  );
}
