-- ============================================================================
-- PROPOSED MIGRATION — Hockey Night: Arena Mode
--   passport_occasion_checkins, passport_occasion_pings,
--   passport_occasion_quests, passport_occasion_quest_crew
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_arena.sql
--
-- Lives in the Hockey lane, like migration.sql and seats-migration.sql:
-- `supabase/migrations/` is a shared contract this lane proposes to and does
-- not change. REQUIRES migration.sql (occasions, members and the helpers
-- passport_is_occasion_member / passport_occasion_role). Does not need the
-- seats migration. Applied and attacked only against the local stack
-- (verification/stack.mjs, verification/arena-attack.mjs). Paste it into the
-- SQL editor; never `supabase db push` (supabase/README.md hazard 1).
--
-- ## What it holds
--
-- Where people on a night *said* they are inside the arena — a place id from
-- Passport's reading of the arena map, never coordinates — plus pings between
-- them ("where are you?", "meet me here") and side quests. Nothing about a
-- person beyond what they typed or tapped.
--
-- ## The privacy rules, enforced here
--
--   opt-in    nobody has a check-in until they make one.
--   members   every read needs the reader AND the subject to be members of
--             that night. A removed member vanishes from everyone's map.
--   window    every row is readable only while the night's arena window is
--             open — 3 h before starts_at to 5 h after — and only if it was
--             written inside the current window. Timestamps are stamped by
--             the database, not the client, so nothing can be backdated in.
--   revocable a person deletes their own check-in at any time ("Vanish").
--   expiry    passport_arena_purge() deletes every row whose window has
--             ended. Callable by any signed-in user (it only ever deletes
--             expired rows) and by pg_cron if the project has it.
--   pings     addressed pings are read only by sender and addressee;
--             broadcast pings (to_user NULL) by every member.
--   anon      nothing, by grant as well as by policy.
--
-- Guarded (IF NOT EXISTS / do-blocks / CREATE OR REPLACE): applying it twice
-- changes nothing. Production applies no default grants: everything a role
-- needs is granted below.
-- ============================================================================

-- ----------------------------------------------------------------- helpers

-- Is the night's arena window open at p_at? SECURITY INVOKER on purpose: it
-- reads passport_occasions under the caller's own RLS, so for a night the
-- caller is not a member of it answers false and leaks nothing.
CREATE OR REPLACE FUNCTION public.passport_arena_open(
  p_occasion uuid, p_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.passport_occasions o
    WHERE o.id = p_occasion
      AND p_at >= o.starts_at - interval '3 hours'
      AND p_at <  o.starts_at + interval '5 hours');
$$;

REVOKE ALL ON FUNCTION public.passport_arena_open(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passport_arena_open(uuid, timestamptz) TO authenticated;

-- Stamp the row with the database's clock, whatever the client sent.
CREATE OR REPLACE FUNCTION public.passport_arena_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME IN ('passport_occasion_checkins', 'passport_occasion_quest_crew') THEN
    NEW.updated_at := now();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS public.passport_occasion_checkins (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- A place id from Passport's arena catalogue (validated by the app); never coordinates.
  place text NOT NULL CHECK (place ~ '^[A-Za-z0-9:~._-]{1,48}$'),
  status text NOT NULL DEFAULT '' CHECK (char_length(status) <= 80),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL: everyone on the night.
  to_user uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('where', 'here', 'herd', 'meet', 'coming', 'cant')),
  place text CHECK (place IS NULL OR place ~ '^[A-Za-z0-9:~._-]{1,48}$'),
  reply_to uuid,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_occasion_pings_night
  ON public.passport_occasion_pings (occasion_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.passport_occasion_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind ~ '^[a-z-]{1,24}$'),
  started_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  place text CHECK (place IS NULL OR place ~ '^[A-Za-z0-9:~._-]{1,48}$'),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 80),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dropped')),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_note text NOT NULL DEFAULT '' CHECK (char_length(closed_note) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_occasion_quests_night
  ON public.passport_occasion_quests (occasion_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.passport_occasion_quest_crew (
  quest_id uuid NOT NULL REFERENCES public.passport_occasion_quests(id) ON DELETE CASCADE,
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 80),
  place text CHECK (place IS NULL OR place ~ '^[A-Za-z0-9:~._-]{1,48}$'),
  -- A price somebody saw with their own eyes, in cents. Reported, not verified.
  price_cents integer CHECK (price_cents IS NULL OR price_cents BETWEEN 1 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quest_id, user_id)
);

-- ----------------------------------------------------------------- stamps

do $$
declare t text;
begin
  foreach t in array array['passport_occasion_checkins', 'passport_occasion_pings',
                           'passport_occasion_quests', 'passport_occasion_quest_crew'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_stamp') then
      execute format(
        'create trigger %I before insert or update on public.%I
           for each row execute function public.passport_arena_stamp()',
        t || '_stamp', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------- grants

ALTER TABLE public.passport_occasion_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_quest_crew ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.passport_occasion_checkins FROM anon, authenticated;
REVOKE ALL ON public.passport_occasion_pings FROM anon, authenticated;
REVOKE ALL ON public.passport_occasion_quests FROM anon, authenticated;
REVOKE ALL ON public.passport_occasion_quest_crew FROM anon, authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_checkins TO authenticated;
GRANT INSERT (occasion_id, user_id, place, status) ON public.passport_occasion_checkins TO authenticated;
GRANT UPDATE (place, status) ON public.passport_occasion_checkins TO authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_pings TO authenticated;
GRANT INSERT (occasion_id, from_user, to_user, kind, place, reply_to, note)
  ON public.passport_occasion_pings TO authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_quests TO authenticated;
GRANT INSERT (occasion_id, kind, started_by, subject_user, place, note)
  ON public.passport_occasion_quests TO authenticated;
GRANT UPDATE (status, closed_by, closed_note) ON public.passport_occasion_quests TO authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_quest_crew TO authenticated;
GRANT INSERT (quest_id, occasion_id, user_id, note, place, price_cents)
  ON public.passport_occasion_quest_crew TO authenticated;
GRANT UPDATE (note, place, price_cents) ON public.passport_occasion_quest_crew TO authenticated;

-- ----------------------------------------------------------------- policies

do $$ begin
  -- Check-ins ---------------------------------------------------------------
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_checkins_read') then
    create policy passport_occasion_checkins_read on public.passport_occasion_checkins
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, user_id)
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, updated_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_checkins_make') then
    create policy passport_occasion_checkins_make on public.passport_occasion_checkins
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_checkins_move') then
    create policy passport_occasion_checkins_move on public.passport_occasion_checkins
      for update to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  -- Vanish works any time, in the window or not.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_checkins_vanish') then
    create policy passport_occasion_checkins_vanish on public.passport_occasion_checkins
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- Pings -------------------------------------------------------------------
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_pings_read') then
    create policy passport_occasion_pings_read on public.passport_occasion_pings
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, from_user)
        and (to_user is null or to_user = auth.uid() or from_user = auth.uid())
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, created_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_pings_send') then
    create policy passport_occasion_pings_send on public.passport_occasion_pings
      for insert to authenticated with check (
        from_user = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and (to_user is null or passport_is_occasion_member(occasion_id, to_user))
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_pings_unsend') then
    create policy passport_occasion_pings_unsend on public.passport_occasion_pings
      for delete to authenticated using (from_user = auth.uid());
  end if;

  -- Quests ------------------------------------------------------------------
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quests_read') then
    create policy passport_occasion_quests_read on public.passport_occasion_quests
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, created_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quests_start') then
    create policy passport_occasion_quests_start on public.passport_occasion_quests
      for insert to authenticated with check (
        started_by = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and (subject_user is null or passport_is_occasion_member(occasion_id, subject_user))
        and passport_arena_open(occasion_id));
  end if;
  -- The starter or anyone on the crew closes an open quest, as themselves.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quests_close') then
    create policy passport_occasion_quests_close on public.passport_occasion_quests
      for update to authenticated
      using (
        status = 'open'
        and passport_is_occasion_member(occasion_id, auth.uid())
        and (started_by = auth.uid()
          or exists (select 1 from public.passport_occasion_quest_crew c
                     where c.quest_id = passport_occasion_quests.id
                       and c.user_id = auth.uid())))
      with check (
        closed_by = auth.uid()
        and status in ('done', 'dropped')
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quests_remove') then
    create policy passport_occasion_quests_remove on public.passport_occasion_quests
      for delete to authenticated using (
        started_by = auth.uid()
        or passport_occasion_role(occasion_id, auth.uid()) = 'host');
  end if;

  -- Crew --------------------------------------------------------------------
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quest_crew_read') then
    create policy passport_occasion_quest_crew_read on public.passport_occasion_quest_crew
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, user_id)
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, updated_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quest_crew_join') then
    create policy passport_occasion_quest_crew_join on public.passport_occasion_quest_crew
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id)
        and exists (select 1 from public.passport_occasion_quests q
                    where q.id = passport_occasion_quest_crew.quest_id
                      and q.occasion_id = passport_occasion_quest_crew.occasion_id
                      and q.status = 'open'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quest_crew_report') then
    create policy passport_occasion_quest_crew_report on public.passport_occasion_quest_crew
      for update to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_quest_crew_leave') then
    create policy passport_occasion_quest_crew_leave on public.passport_occasion_quest_crew
      for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ----------------------------------------------------------------- expiry

-- Deletes every Arena Mode row whose night's window has closed, or that was
-- written in an earlier window of a night that has since moved. Touches
-- nothing else. SECURITY DEFINER so it can delete other people's expired
-- rows; it takes no arguments, so a caller cannot aim it.
CREATE OR REPLACE FUNCTION public.passport_arena_purge()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; k integer;
BEGIN
  DELETE FROM public.passport_occasion_checkins c USING public.passport_occasions o
   WHERE o.id = c.occasion_id
     AND (now() >= o.starts_at + interval '5 hours'
       OR c.updated_at < o.starts_at - interval '3 hours'
       OR c.updated_at >= o.starts_at + interval '5 hours');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  DELETE FROM public.passport_occasion_pings p USING public.passport_occasions o
   WHERE o.id = p.occasion_id
     AND (now() >= o.starts_at + interval '5 hours'
       OR p.created_at < o.starts_at - interval '3 hours'
       OR p.created_at >= o.starts_at + interval '5 hours');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  DELETE FROM public.passport_occasion_quests q USING public.passport_occasions o
   WHERE o.id = q.occasion_id
     AND (now() >= o.starts_at + interval '5 hours'
       OR q.created_at < o.starts_at - interval '3 hours'
       OR q.created_at >= o.starts_at + interval '5 hours');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.passport_arena_purge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passport_arena_purge() TO authenticated;
