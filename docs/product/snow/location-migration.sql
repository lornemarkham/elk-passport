-- ============================================================================
-- PROPOSED MIGRATION — passport_snow_locations (Find your crew on the hill)
-- Written on lane snow (feature/snow), 2026-11-07, Mission "Snow Day P0".
-- PROPOSAL: lives in docs/product/snow/ because supabase/migrations/ is a
-- shared contract (CLAUDE.local.md). The integration step is
--   git mv docs/product/snow/location-migration.sql \
--          supabase/migrations/20261107000000_passport_snow_location.sql
-- Requires 20261103000000_passport_snow.sql (passport_is_snow_member). The
-- Snow migration does NOT depend on this one: shared snow days work without
-- it, and the app says "Location sharing isn't switched on yet" until it is
-- applied. Preflight and rollback: location-preflight.sql, location-rollback.sql.
--
-- WHAT THIS IS
--
-- A person in a shared snow day may choose to show the rest of the crew where
-- they are, for a while. This follows ADR 011 (Find my people): opt-in,
-- time-limited, immediately revocable. It overturns "Passport stores no
-- position" for ONE case only, members of one snow day who asked to.
--
-- THE RULES, AND WHAT ENFORCES EACH
--
--   * Nothing exists until the person taps Share (the app asks the phone's
--     own permission first). One row per person per day.
--   * Every share ends by itself: expires_at is at most 4 hours after it
--     began (CHECK), and an expired row is unreadable to everyone, including
--     its owner (read policy), and deleted whenever anyone in the day next
--     asks (passport_snow_locations_purge).
--   * Updates move the dot, never the clock: UPDATE is granted on lat, lng
--     and accuracy only, not expires_at, so a share cannot be extended
--     quietly. Extending means stopping and sharing again, on purpose.
--   * Stop deletes the row. Leaving or being removed deletes it too (trigger),
--     and so does deleting the adventure (foreign key).
--   * Reciprocity: you see the crew's positions only while you are sharing
--     your own (passport_snow_is_sharing). Nobody watches without being seen.
--   * Rounded to 4 decimal places, about 11 m: enough to find a person on a
--     mountain, not enough to find their table. Rounding is done here, not
--     trusted to the phone.
--   * At most one update every 10 seconds per person (trigger), so a script
--     cannot turn this into a high-rate tracker.
--   * Only members of a snow-day adventure read or write. A stranger, a
--     member of someone else's day and a Hockey Night member get nothing.
--     anon holds nothing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_snow_locations (
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m integer CHECK (accuracy_m IS NULL OR accuracy_m BETWEEN 0 AND 5000),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, user_id),
  CONSTRAINT passport_snow_locations_window
    CHECK (expires_at > started_at AND expires_at <= started_at + interval '4 hours')
);

-- Does the caller have a live share in this day? SECURITY DEFINER so the read
-- policy can ask without recursing into itself. Answers only for auth.uid().
CREATE OR REPLACE FUNCTION public.passport_snow_is_sharing(p_adventure text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from passport_snow_locations l
    where l.adventure_id = p_adventure and l.user_id = auth.uid()
      and l.expires_at > now());
$$;

-- Round to ~11 m, and refuse an update faster than one every 10 seconds.
CREATE OR REPLACE FUNCTION public.passport_snow_locations_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  new.lat := round(new.lat::numeric, 4)::double precision;
  new.lng := round(new.lng::numeric, 4)::double precision;
  if TG_OP = 'UPDATE' then
    if old.updated_at > now() - interval '10 seconds' then
      raise exception 'slow down' using errcode = 'P0001', hint = 'rate';
    end if;
    -- the clock and the owner never move on update
    new.expires_at := old.expires_at;
    new.started_at := old.started_at;
    new.user_id := old.user_id;
    new.adventure_id := old.adventure_id;
  end if;
  new.updated_at := now();
  return new;
end $$;

DROP TRIGGER IF EXISTS passport_snow_locations_guard ON public.passport_snow_locations;
CREATE TRIGGER passport_snow_locations_guard
  BEFORE INSERT OR UPDATE ON public.passport_snow_locations
  FOR EACH ROW EXECUTE FUNCTION public.passport_snow_locations_guard();

-- Delete this day's finished shares. Members of the day may call it; it can
-- only remove rows that are already unreadable.
CREATE OR REPLACE FUNCTION public.passport_snow_locations_purge(p_adventure text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n integer;
begin
  if not passport_is_snow_member(p_adventure) then
    return 0;
  end if;
  delete from passport_snow_locations
   where adventure_id = p_adventure and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Leaving or being removed takes the person's position with them.
CREATE OR REPLACE FUNCTION public.passport_snow_locations_gone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  delete from passport_snow_locations
   where adventure_id = old.adventure_id and user_id = old.user_id;
  return old;
end $$;

DROP TRIGGER IF EXISTS passport_snow_locations_gone ON public.passport_adventure_members;
CREATE TRIGGER passport_snow_locations_gone
  AFTER DELETE ON public.passport_adventure_members
  FOR EACH ROW EXECUTE FUNCTION public.passport_snow_locations_gone();

ALTER TABLE public.passport_snow_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_snow_locations FROM anon, authenticated, public;
GRANT SELECT, INSERT, DELETE ON public.passport_snow_locations TO authenticated;
GRANT UPDATE (lat, lng, accuracy_m) ON public.passport_snow_locations TO authenticated;

-- Read: a live row, in your own snow day, and only while you are sharing too
-- (your own row is always yours to see while it is live).
DROP POLICY IF EXISTS passport_snow_locations_read ON public.passport_snow_locations;
CREATE POLICY passport_snow_locations_read ON public.passport_snow_locations
  FOR SELECT TO authenticated USING (
    passport_is_snow_member(adventure_id)
    AND expires_at > now()
    AND (user_id = auth.uid() OR passport_snow_is_sharing(adventure_id)));

-- Share: only as yourself, in a day you are in, starting now, for at most 4 h.
DROP POLICY IF EXISTS passport_snow_locations_share ON public.passport_snow_locations;
CREATE POLICY passport_snow_locations_share ON public.passport_snow_locations
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND passport_is_snow_member(adventure_id)
    AND started_at > now() - interval '1 minute'
    AND expires_at > now()
    AND expires_at <= now() + interval '4 hours');

-- Move: your own live row, nobody else's.
DROP POLICY IF EXISTS passport_snow_locations_move ON public.passport_snow_locations;
CREATE POLICY passport_snow_locations_move ON public.passport_snow_locations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND passport_is_snow_member(adventure_id) AND expires_at > now())
  WITH CHECK (user_id = auth.uid() AND passport_is_snow_member(adventure_id));

-- Stop: your own row, expired or not. (No one can stop someone else's: the
-- host cannot see it, so cannot delete it. Removing a member erases theirs.)
DROP POLICY IF EXISTS passport_snow_locations_stop ON public.passport_snow_locations;
CREATE POLICY passport_snow_locations_stop ON public.passport_snow_locations
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() AND passport_is_snow_member(adventure_id));

REVOKE ALL ON FUNCTION public.passport_snow_is_sharing(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_snow_locations_guard() FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.passport_snow_locations_purge(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_snow_locations_gone() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_snow_is_sharing(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_snow_locations_purge(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
