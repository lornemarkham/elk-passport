-- ============================================================================
-- PROPOSED MIGRATION — Hockey Night: Declare your team + the Chirp Room
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_chirp.sql
--
-- Lives in the Hockey lane because `supabase/migrations/` is a shared
-- contract this lane proposes to and does not change. REQUIRES migration.sql
-- (the occasions tables and their policy helpers). Applied and attacked only
-- against the local stack (verification/stack.mjs), never against a real
-- Supabase project. On the shared project, run chirp-preflight.sql, then
-- paste this into the SQL editor; do not `supabase db push`.
--
-- ## What it changes — no new table, no second chat
--
-- 1. passport_occasion_members.nhl_team — who the person bleeds for: one of
--    the league's 32 codes, or null. Written only by the person themself
--    (the existing self-update policy; a new column-level UPDATE grant).
--    Read by members of the same night, like their name and emoji.
-- 2. passport_occasion_moments — the night's existing chat — gains one kind,
--    'chirp' (Chirp Bot's lines), and three columns those lines carry:
--      bot_key   what the line is about, unique per night, so two phones
--                doing the same thing at once produce one line
--      bot_line  a library line id, or 'ai' for a model's line
--      bot_sig   the server's HMAC over a model's line (the page shows a
--                model's line only if it verifies — see src/domain/hockey/chirp.ts)
--    Ordinary messages must leave all three empty; a 'chirp' row must name
--    its key and line, and a line about a person (team:<id>:…, arrive:<id>)
--    must be written by that person's own session. The insert policy is otherwise unchanged: a member,
--    as themselves, in their own night. The host may delete any line,
--    Chirp Bot's included, exactly as before.
--
-- Hockey Night keeps working without this: the page treats the missing
-- columns as "teams and Chirp Bot aren't switched on yet".
--
-- Guarded (IF NOT EXISTS / do-blocks), so applying it twice changes nothing.
-- ============================================================================

ALTER TABLE public.passport_occasion_members
  ADD COLUMN IF NOT EXISTS nhl_team text;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conname = 'passport_occasion_members_nhl_team_check') then
    alter table public.passport_occasion_members
      add constraint passport_occasion_members_nhl_team_check
      check (nhl_team is null or nhl_team in ('ANA','BOS','BUF','CGY','CAR','CHI','COL','CBJ','DAL','DET','EDM','FLA','LAK','MIN','MTL','NSH','NJD','NYI','NYR','OTT','PHI','PIT','SJS','SEA','STL','TBL','TOR','UTA','VAN','VGK','WSH','WPG'));
  end if;
end $$;

-- The person changes their own team; nobody else's (RLS: user_id = auth.uid()).
GRANT UPDATE (nhl_team) ON public.passport_occasion_members TO authenticated;

ALTER TABLE public.passport_occasion_moments
  ADD COLUMN IF NOT EXISTS bot_key text,
  ADD COLUMN IF NOT EXISTS bot_line text,
  ADD COLUMN IF NOT EXISTS bot_sig text;

do $$ begin
  -- The original inline check allowed note / join / photo.
  alter table public.passport_occasion_moments
    drop constraint if exists passport_occasion_moments_kind_check;
  alter table public.passport_occasion_moments
    add constraint passport_occasion_moments_kind_check
    check (kind in ('note', 'join', 'photo', 'chirp'));

  if not exists (select 1 from pg_constraint
                 where conname = 'passport_occasion_moments_bot_check') then
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_bot_check check (
        (kind = 'chirp'
          and bot_key is not null and char_length(bot_key) between 1 and 160
          and bot_line is not null and char_length(bot_line) between 1 and 40
          and (bot_sig is null or char_length(bot_sig) between 1 and 100))
        or (kind <> 'chirp' and bot_key is null and bot_line is null and bot_sig is null));
  end if;

  -- A line about a person (their team, their arrival) can only be written
  -- by that person's own action. Without this, a member could write
  -- "team:<somebody else>:TOR" first and, through the unique index below,
  -- stop the real line about that person from ever being posted.
  if not exists (select 1 from pg_constraint
                 where conname = 'passport_occasion_moments_bot_self_check') then
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_bot_self_check check (
        bot_key is null
        or split_part(bot_key, ':', 1) not in ('team', 'arrive')
        or split_part(bot_key, ':', 2) = actor_id::text) not valid;
    -- NOT VALID only spares rows written before this check existed (there are
    -- none on a first apply); every new row is checked.
  end if;
end $$;

CREATE UNIQUE INDEX IF NOT EXISTS passport_occasion_moments_bot_once
  ON public.passport_occasion_moments (occasion_id, bot_key)
  WHERE bot_key IS NOT NULL;

do $$ begin
  -- Same rule as before (a member, as themselves), plus the new kind.
  drop policy if exists passport_occasion_moments_say on public.passport_occasion_moments;
  create policy passport_occasion_moments_say on public.passport_occasion_moments
    for insert to authenticated with check (
      actor_id = auth.uid() and kind in ('note', 'photo', 'chirp')
      and passport_is_occasion_member(occasion_id, auth.uid()));
end $$;
