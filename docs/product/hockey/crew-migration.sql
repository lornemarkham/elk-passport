-- ============================================================================
-- PROPOSED MIGRATION — Hockey Night: The Crew
--   passport_occasion_gps_hints, passport_occasion_summons,
--   passport_occasion_summon_replies, passport_occasion_snack_runs,
--   passport_occasion_snack_items
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_crew.sql
--
-- Lives in the Hockey lane, like arena-migration.sql: `supabase/migrations/`
-- is a shared contract this lane proposes to and does not change. REQUIRES
-- migration.sql (occasions, members, helpers) AND arena-migration.sql (it
-- reuses passport_arena_open). It owns its own stamp and purge functions
-- (passport_crew_stamp, passport_crew_purge) and replaces nothing of Arena
-- Mode's, so re-running arena-migration.sql later cannot break it.
-- Applied and attacked only against the local stack
-- (verification/stack.mjs, verification/crew-attack.mjs). Paste it into the
-- SQL editor; never `supabase db push` (supabase/README.md hazard 1).
--
-- ## What it holds
--
-- A GPS *hint* per person (a zone around the arena, a rounded distance, the
-- phone's own accuracy — NEVER coordinates; the app turns one reading into
-- that row and discards the reading), squad summons and their replies, snack
-- runs and the items friends asked for. No money, no history.
--
-- ## The privacy rules, enforced here
--
--   opt-in    nobody has a hint until they send one. A hint row is the consent
--             record; deleting it is revoking.
--   no trail  one row per person per night (primary key). An update overwrites;
--             nothing is appended, so there is no location history to read.
--   coarse    the table cannot hold coordinates; zone is one of three words,
--             distance is a multiple of 50, accuracy a multiple of 10.
--   members   every read needs the reader AND the subject to be members of the
--             night. A removed member vanishes from everyone's view.
--   window    every row is readable only while the night's arena window is
--             open, and only if written inside it. Timestamps are stamped by
--             the database. passport_crew_purge() deletes the rest.
--   revocable a person deletes their own hint at any moment it is readable; once
--             the window has closed it is unreadable to everyone and is purged.
--   anon      nothing, by grant as well as by policy.
--
-- Guarded (IF NOT EXISTS / do-blocks / CREATE OR REPLACE): applying it twice
-- changes nothing. Production applies no default grants: everything a role
-- needs is granted below.
-- ============================================================================

-- ----------------------------------------------------------------- stamps

-- Stamp rows with the database's clock, whatever the client sent.
CREATE OR REPLACE FUNCTION public.passport_crew_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME IN ('passport_occasion_gps_hints', 'passport_occasion_summon_replies',
                       'passport_occasion_snack_items') THEN
    NEW.updated_at := now();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS public.passport_occasion_gps_hints (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone text NOT NULL CHECK (zone IN ('around', 'near', 'away')),
  distance_m integer NOT NULL CHECK (distance_m BETWEEN 0 AND 50000 AND distance_m % 50 = 0),
  accuracy_m integer NOT NULL CHECK (accuracy_m BETWEEN 10 AND 1500 AND accuracy_m % 10 = 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_summons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place text NOT NULL CHECK (place ~ '^[A-Za-z0-9:~._-]{1,48}$'),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_occasion_summons_night
  ON public.passport_occasion_summons (occasion_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.passport_occasion_summon_replies (
  summon_id uuid NOT NULL REFERENCES public.passport_occasion_summons(id) ON DELETE CASCADE,
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('coming', 'busy', 'where')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (summon_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_snack_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  runner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- A concession's place id from the arena's map (validated by the app).
  stand text CHECK (stand IS NULL OR stand ~ '^[A-Za-z0-9:~._-]{1,48}$'),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 80),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_occasion_snack_runs_night
  ON public.passport_occasion_snack_runs (occasion_id, created_at DESC);

-- No price, no payment, no card: a line of text a friend wants.
CREATE TABLE IF NOT EXISTS public.passport_occasion_snack_items (
  run_id uuid NOT NULL REFERENCES public.passport_occasion_snack_runs(id) ON DELETE CASCADE,
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item text NOT NULL CHECK (char_length(item) BETWEEN 1 AND 60),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['passport_occasion_gps_hints', 'passport_occasion_summons',
                           'passport_occasion_summon_replies', 'passport_occasion_snack_runs',
                           'passport_occasion_snack_items'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_stamp') then
      execute format(
        'create trigger %I before insert or update on public.%I
           for each row execute function public.passport_crew_stamp()',
        t || '_stamp', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------- grants

ALTER TABLE public.passport_occasion_gps_hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_summons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_summon_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_snack_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_snack_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.passport_occasion_gps_hints FROM anon, authenticated;
REVOKE ALL ON public.passport_occasion_summons FROM anon, authenticated;
REVOKE ALL ON public.passport_occasion_summon_replies FROM anon, authenticated;
REVOKE ALL ON public.passport_occasion_snack_runs FROM anon, authenticated;
REVOKE ALL ON public.passport_occasion_snack_items FROM anon, authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_gps_hints TO authenticated;
GRANT INSERT (occasion_id, user_id, zone, distance_m, accuracy_m)
  ON public.passport_occasion_gps_hints TO authenticated;
GRANT UPDATE (zone, distance_m, accuracy_m) ON public.passport_occasion_gps_hints TO authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_summons TO authenticated;
GRANT INSERT (occasion_id, from_user, place, note) ON public.passport_occasion_summons TO authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_summon_replies TO authenticated;
GRANT INSERT (summon_id, occasion_id, user_id, response)
  ON public.passport_occasion_summon_replies TO authenticated;
GRANT UPDATE (response) ON public.passport_occasion_summon_replies TO authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_snack_runs TO authenticated;
GRANT INSERT (occasion_id, runner, stand, note) ON public.passport_occasion_snack_runs TO authenticated;
GRANT UPDATE (status) ON public.passport_occasion_snack_runs TO authenticated;

GRANT SELECT, DELETE ON public.passport_occasion_snack_items TO authenticated;
GRANT INSERT (run_id, occasion_id, user_id, item) ON public.passport_occasion_snack_items TO authenticated;
GRANT UPDATE (item) ON public.passport_occasion_snack_items TO authenticated;

-- ----------------------------------------------------------------- policies

do $$ begin
  -- GPS hints ---------------------------------------------------------------
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_gps_hints_read') then
    create policy passport_occasion_gps_hints_read on public.passport_occasion_gps_hints
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, user_id)
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, updated_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_gps_hints_share') then
    create policy passport_occasion_gps_hints_share on public.passport_occasion_gps_hints
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_gps_hints_refresh') then
    create policy passport_occasion_gps_hints_refresh on public.passport_occasion_gps_hints
      for update to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  -- Stop sharing: delete your own row. (Postgres also applies the read policy to a
  -- DELETE's WHERE, so after the window closes this matches nothing — by then the
  -- row is unreadable to everyone and the purge removes it.)
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_gps_hints_stop') then
    create policy passport_occasion_gps_hints_stop on public.passport_occasion_gps_hints
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- Summons -----------------------------------------------------------------
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_summons_read') then
    create policy passport_occasion_summons_read on public.passport_occasion_summons
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, from_user)
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, created_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_summons_send') then
    create policy passport_occasion_summons_send on public.passport_occasion_summons
      for insert to authenticated with check (
        from_user = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_summons_cancel') then
    create policy passport_occasion_summons_cancel on public.passport_occasion_summons
      for delete to authenticated using (from_user = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_summon_replies_read') then
    create policy passport_occasion_summon_replies_read on public.passport_occasion_summon_replies
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, user_id)
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, updated_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_summon_replies_answer') then
    create policy passport_occasion_summon_replies_answer on public.passport_occasion_summon_replies
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id)
        and exists (select 1 from public.passport_occasion_summons s
                    where s.id = passport_occasion_summon_replies.summon_id
                      and s.occasion_id = passport_occasion_summon_replies.occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_summon_replies_change') then
    create policy passport_occasion_summon_replies_change on public.passport_occasion_summon_replies
      for update to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_summon_replies_retract') then
    create policy passport_occasion_summon_replies_retract on public.passport_occasion_summon_replies
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- Snack runs --------------------------------------------------------------
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_runs_read') then
    create policy passport_occasion_snack_runs_read on public.passport_occasion_snack_runs
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, created_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_runs_announce') then
    create policy passport_occasion_snack_runs_announce on public.passport_occasion_snack_runs
      for insert to authenticated with check (
        runner = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id));
  end if;
  -- Only the runner closes it (done or cancelled), as themselves.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_runs_close') then
    create policy passport_occasion_snack_runs_close on public.passport_occasion_snack_runs
      for update to authenticated
      using (runner = auth.uid() and status = 'open')
      with check (
        runner = auth.uid()
        and status in ('done', 'cancelled')
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_runs_remove') then
    create policy passport_occasion_snack_runs_remove on public.passport_occasion_snack_runs
      for delete to authenticated using (
        runner = auth.uid()
        or passport_occasion_role(occasion_id, auth.uid()) = 'host');
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_items_read') then
    create policy passport_occasion_snack_items_read on public.passport_occasion_snack_items
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, user_id)
        and passport_arena_open(occasion_id)
        and passport_arena_open(occasion_id, updated_at));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_items_ask') then
    create policy passport_occasion_snack_items_ask on public.passport_occasion_snack_items
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_arena_open(occasion_id)
        and exists (select 1 from public.passport_occasion_snack_runs r
                    where r.id = passport_occasion_snack_items.run_id
                      and r.occasion_id = passport_occasion_snack_items.occasion_id
                      and r.status = 'open'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_items_change') then
    create policy passport_occasion_snack_items_change on public.passport_occasion_snack_items
      for update to authenticated
      using (
        user_id = auth.uid()
        and exists (select 1 from public.passport_occasion_snack_runs r
                    where r.id = passport_occasion_snack_items.run_id and r.status = 'open'))
      with check (
        user_id = auth.uid()
        and passport_arena_open(occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_snack_items_withdraw') then
    create policy passport_occasion_snack_items_withdraw on public.passport_occasion_snack_items
      for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ----------------------------------------------------------------- expiry

-- Deletes every Crew row whose night's window has closed, or that was written
-- in an earlier window of a night that has since moved. Touches nothing else
-- (Arena Mode's own rows have passport_arena_purge). SECURITY DEFINER so it can
-- delete other people's expired rows; it takes no arguments, so a caller
-- cannot aim it. Replies and requests go with their summons and runs (cascade).
CREATE OR REPLACE FUNCTION public.passport_crew_purge()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; k integer; t text; col text;
BEGIN
  FOR t, col IN
    SELECT * FROM (VALUES
      ('passport_occasion_gps_hints', 'updated_at'),
      ('passport_occasion_summons', 'created_at'),
      ('passport_occasion_snack_runs', 'created_at')) AS v(t, col)
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I x USING public.passport_occasions o
        WHERE o.id = x.occasion_id
          AND (now() >= o.starts_at + interval ''5 hours''
            OR x.%I < o.starts_at - interval ''3 hours''
            OR x.%I >= o.starts_at + interval ''5 hours'')', t, col, col);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.passport_crew_purge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passport_crew_purge() TO authenticated;
