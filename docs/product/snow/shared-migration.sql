-- ============================================================================
-- MIGRATION — passport_snow_* (Powder Day, shared across phones)
-- Written on lane snow (feature/snow), 2026-11-01, for Powder Day mission
-- "enable real multi-phone experiences". PROPOSED for the contracts lane:
-- copy to supabase/migrations/<stamp>_passport_snow.sql unchanged below this
-- header. NOT applied to any real project. Requires
-- 20261021000000_passport_adventures.sql (applied in production) and nothing
-- else: it does not touch the Hockey, Date Night or Christmas tables.
--
-- WHAT THIS IS
--
-- A snow day is an ordinary adventure of kind `snow-day` (no change to the
-- core: `kind` is an open vocabulary). The core already does membership,
-- hashed single-use-or-many invitations, the owner/participant split, the
-- title and the date. This file adds only what a snow day has that the core
-- does not: each person's level and gear, the crew's options and their
-- votes, the owner's decisions, chat and announcements, challenges and
-- completions (which is where points come from — they are derived, never
-- stored), predictions and guesses, check-ins, packing, ideas for the next
-- one, a playlist, and shared moments and photos.
--
-- Every table is keyed by adventure_id and cascades with it. People are
-- never addressed by user id outside the database: the server maps user_id
-- to the core's random member_id (src/app/snow/_server/shared.ts).
--
-- SECURITY MODEL (the core's, extended)
--
--   * RLS on every table; anon holds nothing; the app reads and writes as the
--     signed-in person (anon key + their JWT). No service-role key.
--   * Only members of a `snow-day` adventure read or write any of it
--     (`passport_is_snow_member`). A stranger, a member of someone else's
--     snow day, and a member of a Hockey Night all get nothing.
--   * You write only rows that are yours (user_id = auth.uid()). The owner
--     alone writes the day's facts and decisions, and posts "change" notices.
--     You delete what you added; the owner may delete anything in their day.
--   * One vote per person per topic, one completion per person per
--     challenge, one guess per person per prediction: primary keys, not
--     application promises. A vote can only point at an option of the same
--     day and topic, a decision likewise (composite foreign keys).
--   * A prediction can be settled only by its author or the owner, and
--     nobody may guess once it is settled.
--   * Flood limits per table (see passport_snow_cap) so a caller skipping the
--     app cannot store a novel or a thousand photos.
--   * When a membership goes (left, or removed by the owner) everything that
--     person contributed as THEIR OWN DATA goes with it: level and gear,
--     votes, completions, guesses, check-in, packing, idea votes, moments and
--     photos. What they added to the shared plan (options, chat, challenges,
--     predictions, ideas, songs) stays, shown as "Someone".
--   * Photos are base64 JPEG text capped at 700,000 characters (Hockey's
--     ceiling), at most 16 a day, shrunk in the browser first. They are
--     served to members only, by a route that asks Postgres as the caller.
--
-- HOW TO APPLY
--
-- Paste into the Supabase SQL editor of the Passport project (do NOT
-- `supabase db push`; the project's migration history belongs to Atlas —
-- supabase/README.md). Every statement is guarded: applying it twice changes
-- nothing. Production grants nothing by default, so every grant is explicit.
-- Undo: shared-rollback.sql. Check: shared-preflight.sql.
-- ============================================================================

-- ------------------------------------------------------------------ tables

-- The day's own facts. One row per snow day, written by the owner.
CREATE TABLE IF NOT EXISTS public.passport_snow_days (
  adventure_id text PRIMARY KEY REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  meet_time text CHECK (meet_time IS NULL OR meet_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  challenges_on boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Who is riding, and how much mountain that is. One row per member, theirs.
CREATE TABLE IF NOT EXISTS public.passport_snow_people (
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline text NOT NULL CHECK (discipline IN ('ski', 'snowboard', 'apres')),
  ability text NOT NULL CHECK (ability IN ('first-timer', 'beginner', 'intermediate', 'advanced')),
  own_gear boolean NOT NULL DEFAULT true,
  note text CHECK (note IS NULL OR char_length(note) <= 80),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, user_id)
);

-- The crew's options for each thing to decide.
CREATE TABLE IF NOT EXISTS public.passport_snow_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  topic text NOT NULL CHECK (topic IN ('date', 'mountain', 'transport', 'meeting', 'tickets', 'meals', 'apres')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 140),
  source text CHECK (source IS NULL OR source IN ('atlas', 'passport-list', 'crew')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, adventure_id, topic)
);
CREATE INDEX IF NOT EXISTS passport_snow_proposals_by_adventure
  ON public.passport_snow_proposals (adventure_id, created_at);

-- One vote per person per topic: backing another option moves your vote.
CREATE TABLE IF NOT EXISTS public.passport_snow_votes (
  adventure_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  proposal_id uuid NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, user_id, topic),
  FOREIGN KEY (proposal_id, adventure_id, topic)
    REFERENCES public.passport_snow_proposals (id, adventure_id, topic) ON DELETE CASCADE
);

-- What the owner locked in. Removing an option removes its decision.
CREATE TABLE IF NOT EXISTS public.passport_snow_decisions (
  adventure_id text NOT NULL,
  topic text NOT NULL,
  proposal_id uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, topic),
  FOREIGN KEY (proposal_id, adventure_id, topic)
    REFERENCES public.passport_snow_proposals (id, adventure_id, topic) ON DELETE CASCADE
);

-- Chat and announcements, one stream. 'change' is the notice that a settled
-- plan moved; only the owner posts one.
CREATE TABLE IF NOT EXISTS public.passport_snow_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('chat', 'announcement', 'change')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_snow_posts_by_adventure
  ON public.passport_snow_posts (adventure_id, created_at DESC);

-- Challenges the crew wrote (the vetted ones live in code).
CREATE TABLE IF NOT EXISTS public.passport_snow_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 90),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Points come from these (and from guesses), derived on read. `challenge_id`
-- is a code id for a vetted challenge or the uuid of a crew one, so no FK.
CREATE TABLE IF NOT EXISTS public.passport_snow_completions (
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id text NOT NULL CHECK (challenge_id ~ '^[A-Za-z0-9_:.-]{1,64}$'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, user_id, challenge_id)
);

-- A moment (words) or a photo (words + a small JPEG), shared with the crew.
CREATE TABLE IF NOT EXISTS public.passport_snow_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('moment', 'photo')),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 200),
  photo text CHECK (photo IS NULL OR (photo LIKE 'data:image/%' AND char_length(photo) <= 700000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'photo') = (photo IS NOT NULL)),
  CHECK (kind = 'photo' OR char_length(btrim(body)) >= 1)
);
CREATE INDEX IF NOT EXISTS passport_snow_moments_by_adventure
  ON public.passport_snow_moments (adventure_id, created_at);

CREATE TABLE IF NOT EXISTS public.passport_snow_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 90),
  -- NULL while open. Set by the author or the owner once it has happened.
  outcome boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, adventure_id)
);

CREATE TABLE IF NOT EXISTS public.passport_snow_guesses (
  prediction_id uuid NOT NULL,
  adventure_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  says boolean NOT NULL,
  PRIMARY KEY (prediction_id, user_id),
  FOREIGN KEY (prediction_id, adventure_id)
    REFERENCES public.passport_snow_predictions (id, adventure_id) ON DELETE CASCADE
);

-- Where each person says they are. One row each, replaced on each check-in.
CREATE TABLE IF NOT EXISTS public.passport_snow_checkins (
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  spot text NOT NULL CHECK (char_length(btrim(spot)) BETWEEN 1 AND 60),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.passport_snow_packed (
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL CHECK (item_id ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  PRIMARY KEY (adventure_id, user_id, item_id)
);

-- "Go have another": what the next snow day should be, and who backs it.
CREATE TABLE IF NOT EXISTS public.passport_snow_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, adventure_id)
);

CREATE TABLE IF NOT EXISTS public.passport_snow_idea_votes (
  idea_id uuid NOT NULL,
  adventure_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, user_id),
  FOREIGN KEY (idea_id, adventure_id)
    REFERENCES public.passport_snow_ideas (id, adventure_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.passport_snow_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so policies can ask about membership without recursing
-- into the policies of the table they ask about. They answer only for the
-- caller (auth.uid()), so they cannot be used to probe other people.

CREATE OR REPLACE FUNCTION public.passport_is_snow_member(p_adventure text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1
    from passport_adventure_members m
    join passport_adventures a on a.id = m.adventure_id
    where m.adventure_id = p_adventure and m.user_id = auth.uid()
      and a.kind = 'snow-day');
$$;

CREATE OR REPLACE FUNCTION public.passport_is_snow_owner(p_adventure text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select passport_is_snow_member(p_adventure) and passport_is_adventure_owner(p_adventure);
$$;

CREATE OR REPLACE FUNCTION public.passport_snow_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  new.updated_at := now();
  return new;
end $$;

/**
 * Flood limits, set per table by the trigger's arguments:
 *   TG_ARGV[0] — most rows a day may hold (0 = no limit)
 *   TG_ARGV[1] — most rows one person may add in a minute (0 = no limit)
 * Serialised per adventure so two phones cannot both slip under the line.
 */
CREATE OR REPLACE FUNCTION public.passport_snow_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_total integer := TG_ARGV[0]::integer;
  v_rate integer := TG_ARGV[1]::integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('snow:' || new.adventure_id));
  if v_total > 0 then
    execute format('select count(*) from %I.%I where adventure_id = $1',
                   TG_TABLE_SCHEMA, TG_TABLE_NAME) into v_count using new.adventure_id;
    if v_count >= v_total then
      raise exception 'snow day full' using errcode = 'P0001', hint = 'full';
    end if;
  end if;
  if v_rate > 0 and auth.uid() is not null then
    execute format('select count(*) from %I.%I where adventure_id = $1 and user_id = $2 and created_at > now() - interval ''1 minute''',
                   TG_TABLE_SCHEMA, TG_TABLE_NAME) into v_count using new.adventure_id, auth.uid();
    if v_count >= v_rate then
      raise exception 'slow down' using errcode = 'P0001', hint = 'rate';
    end if;
  end if;
  return new;
end $$;

/** Photos: sixteen a day, and a person adds at most six a minute. */
CREATE OR REPLACE FUNCTION public.passport_snow_moment_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_count integer;
  v_max integer := case when new.kind = 'photo' then 16 else 300 end;
begin
  perform pg_advisory_xact_lock(hashtext('snow:' || new.adventure_id));
  select count(*) into v_count from passport_snow_moments
    where adventure_id = new.adventure_id and kind = new.kind;
  if v_count >= v_max then
    raise exception 'snow day full' using errcode = 'P0001', hint = 'full';
  end if;
  select count(*) into v_count from passport_snow_moments
    where adventure_id = new.adventure_id and user_id = new.user_id
      and created_at > now() - interval '1 minute';
  if v_count >= 6 then
    raise exception 'slow down' using errcode = 'P0001', hint = 'rate';
  end if;
  return new;
end $$;

/**
 * When a membership goes, the person's own data goes with it. What they
 * added to the shared plan stays (as "Someone": the app finds no member).
 */
CREATE OR REPLACE FUNCTION public.passport_snow_member_gone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  delete from passport_snow_people      where adventure_id = old.adventure_id and user_id = old.user_id;
  delete from passport_snow_votes       where adventure_id = old.adventure_id and user_id = old.user_id;
  delete from passport_snow_completions where adventure_id = old.adventure_id and user_id = old.user_id;
  delete from passport_snow_guesses     where adventure_id = old.adventure_id and user_id = old.user_id;
  delete from passport_snow_checkins    where adventure_id = old.adventure_id and user_id = old.user_id;
  delete from passport_snow_packed      where adventure_id = old.adventure_id and user_id = old.user_id;
  delete from passport_snow_idea_votes  where adventure_id = old.adventure_id and user_id = old.user_id;
  delete from passport_snow_moments     where adventure_id = old.adventure_id and user_id = old.user_id;
  return old;
end $$;

-- --------------------------------------------------------------- triggers

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_days_touch') THEN
    CREATE TRIGGER passport_snow_days_touch BEFORE UPDATE ON public.passport_snow_days
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_touch();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_people_touch') THEN
    CREATE TRIGGER passport_snow_people_touch BEFORE UPDATE ON public.passport_snow_people
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_touch();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_proposals_cap') THEN
    CREATE TRIGGER passport_snow_proposals_cap BEFORE INSERT ON public.passport_snow_proposals
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_cap(80, 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_posts_cap') THEN
    CREATE TRIGGER passport_snow_posts_cap BEFORE INSERT ON public.passport_snow_posts
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_cap(2000, 20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_challenges_cap') THEN
    CREATE TRIGGER passport_snow_challenges_cap BEFORE INSERT ON public.passport_snow_challenges
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_cap(6, 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_predictions_cap') THEN
    CREATE TRIGGER passport_snow_predictions_cap BEFORE INSERT ON public.passport_snow_predictions
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_cap(12, 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_ideas_cap') THEN
    CREATE TRIGGER passport_snow_ideas_cap BEFORE INSERT ON public.passport_snow_ideas
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_cap(12, 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_songs_cap') THEN
    CREATE TRIGGER passport_snow_songs_cap BEFORE INSERT ON public.passport_snow_songs
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_cap(30, 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_moments_cap') THEN
    CREATE TRIGGER passport_snow_moments_cap BEFORE INSERT ON public.passport_snow_moments
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_moment_cap();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_members_gone') THEN
    CREATE TRIGGER passport_snow_members_gone AFTER DELETE ON public.passport_adventure_members
      FOR EACH ROW EXECUTE FUNCTION public.passport_snow_member_gone();
  END IF;
END $$;

-- ------------------------------------------------------- grants and RLS
-- Signed-out visitors get nothing, by grant as well as by policy. Signed-in
-- people get exactly what the policies below can allow. UPDATE is column by
-- column: nothing is ever re-homed to another day or re-attributed.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'days', 'people', 'proposals', 'votes', 'decisions', 'posts', 'challenges',
    'completions', 'moments', 'predictions', 'guesses', 'checkins', 'packed',
    'ideas', 'idea_votes', 'songs']
  LOOP
    EXECUTE format('ALTER TABLE public.passport_snow_%s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.passport_snow_%s FROM anon, authenticated, public', t);
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON public.passport_snow_%s TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS passport_snow_%s_member_read ON public.passport_snow_%s', t, t);
    EXECUTE format('CREATE POLICY passport_snow_%s_member_read ON public.passport_snow_%s FOR SELECT TO authenticated USING (passport_is_snow_member(adventure_id))', t, t);
  END LOOP;
END $$;

GRANT UPDATE (meet_time, challenges_on) ON public.passport_snow_days TO authenticated;
GRANT UPDATE (discipline, ability, own_gear, note) ON public.passport_snow_people TO authenticated;
GRANT UPDATE (proposal_id, voted_at) ON public.passport_snow_votes TO authenticated;
GRANT UPDATE (proposal_id, decided_at) ON public.passport_snow_decisions TO authenticated;
GRANT UPDATE (outcome) ON public.passport_snow_predictions TO authenticated;
GRANT UPDATE (says) ON public.passport_snow_guesses TO authenticated;
GRANT UPDATE (spot, checked_in_at) ON public.passport_snow_checkins TO authenticated;

REVOKE ALL ON FUNCTION public.passport_is_snow_member(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_is_snow_owner(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_snow_touch() FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.passport_snow_cap() FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.passport_snow_moment_cap() FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.passport_snow_member_gone() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_is_snow_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_is_snow_owner(text) TO authenticated;

-- Owner-only facts: the day, and what is locked in.
DROP POLICY IF EXISTS passport_snow_days_owner_write ON public.passport_snow_days;
CREATE POLICY passport_snow_days_owner_write ON public.passport_snow_days
  FOR INSERT TO authenticated WITH CHECK (passport_is_snow_owner(adventure_id));
DROP POLICY IF EXISTS passport_snow_days_owner_change ON public.passport_snow_days;
CREATE POLICY passport_snow_days_owner_change ON public.passport_snow_days
  FOR UPDATE TO authenticated
  USING (passport_is_snow_owner(adventure_id)) WITH CHECK (passport_is_snow_owner(adventure_id));
DROP POLICY IF EXISTS passport_snow_days_owner_delete ON public.passport_snow_days;
CREATE POLICY passport_snow_days_owner_delete ON public.passport_snow_days
  FOR DELETE TO authenticated USING (passport_is_snow_owner(adventure_id));

DROP POLICY IF EXISTS passport_snow_decisions_owner_write ON public.passport_snow_decisions;
CREATE POLICY passport_snow_decisions_owner_write ON public.passport_snow_decisions
  FOR INSERT TO authenticated WITH CHECK (passport_is_snow_owner(adventure_id));
DROP POLICY IF EXISTS passport_snow_decisions_owner_change ON public.passport_snow_decisions;
CREATE POLICY passport_snow_decisions_owner_change ON public.passport_snow_decisions
  FOR UPDATE TO authenticated
  USING (passport_is_snow_owner(adventure_id)) WITH CHECK (passport_is_snow_owner(adventure_id));
DROP POLICY IF EXISTS passport_snow_decisions_owner_delete ON public.passport_snow_decisions;
CREATE POLICY passport_snow_decisions_owner_delete ON public.passport_snow_decisions
  FOR DELETE TO authenticated USING (passport_is_snow_owner(adventure_id));

-- Your own rows: insert, change and delete as yourself, in a day you are in.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['people', 'votes', 'completions', 'guesses', 'checkins', 'packed', 'idea_votes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS passport_snow_%s_own_insert ON public.passport_snow_%s', t, t);
    EXECUTE format('CREATE POLICY passport_snow_%s_own_insert ON public.passport_snow_%s FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND passport_is_snow_member(adventure_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS passport_snow_%s_own_delete ON public.passport_snow_%s', t, t);
    EXECUTE format('CREATE POLICY passport_snow_%s_own_delete ON public.passport_snow_%s FOR DELETE TO authenticated USING (user_id = auth.uid())', t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['people', 'votes', 'guesses', 'checkins']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS passport_snow_%s_own_change ON public.passport_snow_%s', t, t);
    EXECUTE format('CREATE POLICY passport_snow_%s_own_change ON public.passport_snow_%s FOR UPDATE TO authenticated USING (user_id = auth.uid() AND passport_is_snow_member(adventure_id)) WITH CHECK (user_id = auth.uid() AND passport_is_snow_member(adventure_id))', t, t);
  END LOOP;
END $$;

-- Things you add to the shared plan: add as yourself; remove your own; the
-- owner removes anything in their day.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proposals', 'challenges', 'predictions', 'ideas', 'songs', 'moments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS passport_snow_%s_member_add ON public.passport_snow_%s', t, t);
    EXECUTE format('CREATE POLICY passport_snow_%s_member_add ON public.passport_snow_%s FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND passport_is_snow_member(adventure_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS passport_snow_%s_remove ON public.passport_snow_%s', t, t);
    EXECUTE format('CREATE POLICY passport_snow_%s_remove ON public.passport_snow_%s FOR DELETE TO authenticated USING (passport_is_snow_member(adventure_id) AND (user_id = auth.uid() OR passport_is_snow_owner(adventure_id)))', t, t);
  END LOOP;
END $$;

-- Chat and announcements: any member posts as themselves; 'change' is the
-- owner's. You delete yours; the owner deletes any.
DROP POLICY IF EXISTS passport_snow_posts_member_add ON public.passport_snow_posts;
CREATE POLICY passport_snow_posts_member_add ON public.passport_snow_posts
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND passport_is_snow_member(adventure_id)
    AND (kind IN ('chat', 'announcement') OR passport_is_snow_owner(adventure_id)));
DROP POLICY IF EXISTS passport_snow_posts_remove ON public.passport_snow_posts;
CREATE POLICY passport_snow_posts_remove ON public.passport_snow_posts
  FOR DELETE TO authenticated USING (
    passport_is_snow_member(adventure_id)
    AND (user_id = auth.uid() OR passport_is_snow_owner(adventure_id)));

-- Predictions: only the author or the owner settles one.
DROP POLICY IF EXISTS passport_snow_predictions_settle ON public.passport_snow_predictions;
CREATE POLICY passport_snow_predictions_settle ON public.passport_snow_predictions
  FOR UPDATE TO authenticated
  USING (passport_is_snow_member(adventure_id) AND (user_id = auth.uid() OR passport_is_snow_owner(adventure_id)))
  WITH CHECK (passport_is_snow_member(adventure_id) AND (user_id = auth.uid() OR passport_is_snow_owner(adventure_id)));

-- No guessing after the fact: an own-insert guess needs an open prediction.
DROP POLICY IF EXISTS passport_snow_guesses_own_insert ON public.passport_snow_guesses;
CREATE POLICY passport_snow_guesses_own_insert ON public.passport_snow_guesses
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND passport_is_snow_member(adventure_id)
    AND EXISTS (SELECT 1 FROM public.passport_snow_predictions p
                WHERE p.id = prediction_id AND p.outcome IS NULL));
DROP POLICY IF EXISTS passport_snow_guesses_own_change ON public.passport_snow_guesses;
CREATE POLICY passport_snow_guesses_own_change ON public.passport_snow_guesses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND passport_is_snow_member(adventure_id)
         AND EXISTS (SELECT 1 FROM public.passport_snow_predictions p
                     WHERE p.id = prediction_id AND p.outcome IS NULL))
  WITH CHECK (user_id = auth.uid() AND passport_is_snow_member(adventure_id));

-- New functions and tables: tell PostgREST, or every call is a 404 until it
-- next reloads on its own.
NOTIFY pgrst, 'reload schema';
