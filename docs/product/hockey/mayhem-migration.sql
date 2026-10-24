-- ============================================================================
-- PROPOSED MIGRATION — Hockey Night "Operation Mayhem": challenges, juries,
-- team reactions, and one Sycle Cup for everybody (2026-10-23)
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_mayhem.sql
-- Apply AFTER night-migration.sql (it widens that file's Chirp Bot rule).
-- Run mayhem-preflight.sql first; mayhem-rollback.sql undoes it.
--
-- Like every Hockey file here it lives in the lane (docs/product/hockey/)
-- because supabase/migrations/ is a shared contract. It has been applied and
-- attacked against a real local PostgreSQL + GoTrue + PostgREST
-- (verification/mayhem-attack.mjs), never against a real Supabase project.
-- Paste it into the SQL editor; do not `supabase db push`.
--
-- ## What it adds
--
-- 1. passport_occasion_challenges — one member calling out another: a bet on
--    one of the night's own questions, a performance the jury judges
--    (defend your team / commentary / hot take), or a prophecy of your own.
-- 2. passport_occasion_challenge_votes — the jury: everybody but the person
--    being judged.
-- 3. passport_occasion_team_reactions — 🫡 🤡 🧂 🔥 🪦 at somebody's team.
-- 4. passport_occasion_mission_ledger() — completed secret missions and
--    dares, readable by every member, so every member's Sycle Cup counts the
--    same points (before this, a mission's points were seen only by the two
--    people who could read the mission).
-- 5. Chirp Bot: three more self-keyed line prefixes (chal / took / oracle).
--
-- ## The security model, in one paragraph
--
-- Members READ challenges and votes through RLS and never WRITE them
-- directly: no INSERT/UPDATE/DELETE is granted. Every change goes through a
-- SECURITY DEFINER function that takes the caller from auth.uid() and checks
-- the rule — you issue only your own challenge, only its target answers it,
-- only its challenger withdraws it, nobody votes on their own, a bet closes
-- at puck drop, one challenge per pair per kind (a declined one stays
-- declined), at most 8 issued per person per night. A declined or withdrawn
-- challenge is readable only by its two people: declining costs nothing and
-- nobody else is told. Points are never stored; the app derives them from
-- these rows, which every member reads alike.
--
-- Guarded (IF NOT EXISTS / CREATE OR REPLACE / do-blocks): applying it twice
-- changes nothing.
-- ============================================================================

-- ------------------------------------------------------------------ tables

CREATE TABLE IF NOT EXISTS public.passport_occasion_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bet', 'defend', 'commentary', 'hottake', 'prophecy')),
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- A bet: which of the night's questions it rides on, and the challenger's side.
  market text CHECK (market IS NULL OR market IN ('winner', 'first-goal', 'overtime', 'goals')),
  side text CHECK (side IS NULL OR side IN ('home', 'away', 'yes', 'no', 'over', 'under')),
  taunt text CHECK (taunt IS NULL OR char_length(taunt) BETWEEN 1 AND 140),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn')),
  -- The performance, or the prophecy, in the target's own words.
  entry text CHECK (entry IS NULL OR char_length(entry) BETWEEN 1 AND 280),
  entry_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'bet') = (market IS NOT NULL AND side IS NOT NULL)),
  CHECK (kind IN ('bet') OR (market IS NULL AND side IS NULL)),
  CHECK ((kind = 'bet') <= (challenger_id <> target_id)),
  CHECK ((kind = 'prophecy') <= (challenger_id = target_id))
);
CREATE INDEX IF NOT EXISTS passport_occasion_challenges_by_occasion
  ON public.passport_occasion_challenges (occasion_id, created_at);
-- One per pair per kind (and per market, for bets). Declined stays declined.
CREATE UNIQUE INDEX IF NOT EXISTS passport_occasion_challenges_once
  ON public.passport_occasion_challenges
  (occasion_id, challenger_id, target_id, kind, coalesce(market, ''));

CREATE TABLE IF NOT EXISTS public.passport_occasion_challenge_votes (
  challenge_id uuid NOT NULL REFERENCES public.passport_occasion_challenges(id) ON DELETE CASCADE,
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verdict boolean NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, voter_id)
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_team_reactions (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  from_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('🫡', '🤡', '🧂', '🔥', '🪦')),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, from_id, to_id),
  CHECK (from_id <> to_id)
);

ALTER TABLE public.passport_occasion_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_challenge_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_team_reactions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------- helpers

-- When a challenge stops taking votes: the final horn for a performance,
-- the morning after for a prophecy — or as soon as every juror has voted.
CREATE OR REPLACE FUNCTION public.passport_challenge_closed(p_challenge uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare
  v passport_occasion_challenges%rowtype;
  v_start timestamptz;
  v_jurors integer;
  v_votes integer;
begin
  select * into v from passport_occasion_challenges where id = p_challenge;
  if not found then return true; end if;
  select starts_at into v_start from passport_occasions where id = v.occasion_id;
  if now() >= v_start + make_interval(mins => case when v.kind = 'prophecy' then 900 else 165 end) then
    return true;
  end if;
  select count(*) into v_jurors from passport_occasion_members
   where occasion_id = v.occasion_id and user_id <> v.target_id;
  select count(*) into v_votes from passport_occasion_challenge_votes cv
    join passport_occasion_members m on m.occasion_id = cv.occasion_id and m.user_id = cv.voter_id
   where cv.challenge_id = p_challenge and cv.voter_id <> v.target_id;
  return v_jurors > 0 and v_votes >= v_jurors;
end;
$$;

-- ------------------------------------------------------------ functions

/**
 * Issue a challenge. Returns its id. A challenge to yourself (volunteering a
 * performance, or a prophecy) starts accepted, with your entry.
 */
CREATE OR REPLACE FUNCTION public.passport_issue_challenge(
  p_occasion uuid, p_kind text, p_target uuid, p_market text, p_side text,
  p_taunt text, p_entry text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_me uuid := auth.uid();
  v_start timestamptz;
  v_details jsonb;
  v_self boolean := p_target = v_me;
  v_entry text := nullif(btrim(coalesce(p_entry, '')), '');
  v_taunt text := nullif(btrim(coalesce(p_taunt, '')), '');
  v_id uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not passport_is_occasion_member(p_occasion, v_me)
     or not passport_is_occasion_member(p_occasion, p_target) then
    raise exception 'not on this night' using errcode = '42501';
  end if;
  select starts_at, details into v_start, v_details from passport_occasions where id = p_occasion;
  -- The host's "games" module (absent list = everything on).
  if jsonb_typeof(v_details->'modules') = 'array'
     and not (v_details->'modules') ? 'games' then
    raise exception 'the host left the games out' using errcode = '22023';
  end if;
  if p_kind = 'bet' then
    if v_self then raise exception 'not against yourself' using errcode = '22023'; end if;
    if not ((p_market in ('winner', 'first-goal') and p_side in ('home', 'away'))
         or (p_market = 'overtime' and p_side in ('yes', 'no'))
         or (p_market = 'goals' and p_side in ('over', 'under'))) then
      raise exception 'not a side of that bet' using errcode = '22023';
    end if;
    if not exists (select 1 from passport_occasion_prompts
                   where occasion_id = p_occasion and content is null
                     and prompt_id = case p_market when 'winner' then 'final-score'
                       when 'first-goal' then 'first-team' when 'overtime' then 'overtime'
                       else 'total-goals' end) then
      raise exception 'that question is not on tonight' using errcode = '22023';
    end if;
    if now() >= v_start then raise exception 'bets close at puck drop' using errcode = '22023'; end if;
    v_entry := null;
  elsif p_kind = 'prophecy' then
    if not v_self then raise exception 'a prophecy is your own' using errcode = '22023'; end if;
    if v_entry is null then raise exception 'say what happens' using errcode = '22023'; end if;
    if now() >= v_start then raise exception 'prophecies close at puck drop' using errcode = '22023'; end if;
  elsif p_kind in ('defend', 'commentary', 'hottake') then
    if now() >= v_start + interval '165 minutes' then
      raise exception 'the night is over' using errcode = '22023';
    end if;
    if v_self and v_entry is null then raise exception 'volunteering means going first' using errcode = '22023'; end if;
    if not v_self then v_entry := null; end if;
  else
    raise exception 'no such challenge' using errcode = '22023';
  end if;
  if (select count(*) from passport_occasion_challenges
      where occasion_id = p_occasion and challenger_id = v_me) >= 8 then
    raise exception 'that is 8 challenges from you tonight' using errcode = '22023';
  end if;

  insert into passport_occasion_challenges
    (occasion_id, kind, challenger_id, target_id, market, side, taunt, status,
     entry, entry_at, answered_at)
  values
    (p_occasion, p_kind, v_me, p_target,
     case when p_kind = 'bet' then p_market end,
     case when p_kind = 'bet' then p_side end,
     left(v_taunt, 140),
     case when v_self then 'accepted' else 'open' end,
     left(v_entry, 280),
     case when v_entry is not null then now() end,
     case when v_self then now() end)
  returning id into v_id;
  return v_id;
end;
$$;

/** The target accepts or declines; the challenger withdraws. Only while open. */
CREATE OR REPLACE FUNCTION public.passport_answer_challenge(p_challenge uuid, p_answer text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_me uuid := auth.uid();
  v passport_occasion_challenges%rowtype;
  v_start timestamptz;
begin
  select * into v from passport_occasion_challenges where id = p_challenge for update;
  if not found or v_me is null or not passport_is_occasion_member(v.occasion_id, v_me) then
    raise exception 'not found' using errcode = '42501';
  end if;
  if v.status <> 'open' then raise exception 'already answered' using errcode = '22023'; end if;
  select starts_at into v_start from passport_occasions where id = v.occasion_id;
  if p_answer = 'withdraw' then
    if v.challenger_id <> v_me then raise exception 'not yours' using errcode = '42501'; end if;
    update passport_occasion_challenges set status = 'withdrawn', answered_at = now() where id = v.id;
    return 'withdrawn';
  end if;
  if v.target_id <> v_me then raise exception 'not yours to answer' using errcode = '42501'; end if;
  if p_answer = 'decline' then
    update passport_occasion_challenges set status = 'declined', answered_at = now() where id = v.id;
    return 'declined';
  end if;
  if p_answer <> 'accept' then raise exception 'accept, decline or withdraw' using errcode = '22023'; end if;
  if v.kind = 'bet' and now() >= v_start then
    raise exception 'bets close at puck drop' using errcode = '22023';
  end if;
  if now() >= v_start + interval '165 minutes' then
    raise exception 'the night is over' using errcode = '22023';
  end if;
  update passport_occasion_challenges set status = 'accepted', answered_at = now() where id = v.id;
  return 'accepted';
end;
$$;

/** The target delivers their performance. Once, after accepting, before the horn. */
CREATE OR REPLACE FUNCTION public.passport_perform_challenge(p_challenge uuid, p_entry text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_me uuid := auth.uid();
  v passport_occasion_challenges%rowtype;
  v_start timestamptz;
  v_entry text := nullif(btrim(coalesce(p_entry, '')), '');
begin
  select * into v from passport_occasion_challenges where id = p_challenge for update;
  if not found or v_me is null or v.target_id <> v_me
     or not passport_is_occasion_member(v.occasion_id, v_me) then
    raise exception 'not yours' using errcode = '42501';
  end if;
  if v.kind not in ('defend', 'commentary', 'hottake') or v.status <> 'accepted' then
    raise exception 'nothing to perform' using errcode = '22023';
  end if;
  if v.entry is not null then raise exception 'already on the record' using errcode = '22023'; end if;
  if v_entry is null or char_length(v_entry) > 280 then
    raise exception 'between 1 and 280 characters' using errcode = '22023';
  end if;
  select starts_at into v_start from passport_occasions where id = v.occasion_id;
  if now() >= v_start + interval '165 minutes' then
    raise exception 'the night is over' using errcode = '22023';
  end if;
  update passport_occasion_challenges set entry = v_entry, entry_at = now() where id = v.id;
end;
$$;

/** A juror rules. Everybody but the person judged; changeable until it closes. */
CREATE OR REPLACE FUNCTION public.passport_vote_challenge(p_challenge uuid, p_verdict boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_me uuid := auth.uid();
  v passport_occasion_challenges%rowtype;
  v_start timestamptz;
begin
  select * into v from passport_occasion_challenges where id = p_challenge;
  if not found or v_me is null or not passport_is_occasion_member(v.occasion_id, v_me) then
    raise exception 'not found' using errcode = '42501';
  end if;
  if v.target_id = v_me then raise exception 'you cannot judge yourself' using errcode = '42501'; end if;
  if v.kind = 'bet' or v.status <> 'accepted' or v.entry is null or p_verdict is null then
    raise exception 'nothing to judge yet' using errcode = '22023';
  end if;
  select starts_at into v_start from passport_occasions where id = v.occasion_id;
  if v.kind = 'prophecy' and now() < v_start then
    raise exception 'judged once the game has started' using errcode = '22023';
  end if;
  if passport_challenge_closed(v.id) then
    raise exception 'the jury has ruled' using errcode = '22023';
  end if;
  insert into passport_occasion_challenge_votes (challenge_id, occasion_id, voter_id, verdict)
  values (v.id, v.occasion_id, v_me, p_verdict)
  on conflict (challenge_id, voter_id) do update set verdict = excluded.verdict, at = now();
end;
$$;

/**
 * Completed secret missions and dares, for every member to count alike:
 * the target said yes, the mastermind confirmed (resolution true), the
 * target had opted in, the two are different people, both still members.
 * Says that it happened — never what the mission was.
 */
CREATE OR REPLACE FUNCTION public.passport_occasion_mission_ledger(p_occasion uuid)
RETURNS TABLE (prompt_id text, earner uuid, family text, asked_by uuid, points integer, done_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select p.prompt_id, p.audience_only, p.content->>'family', p.asked_by,
         case when (p.content->'scoring'->>'points') ~ '^[0-9]{1,3}$'
              then (p.content->'scoring'->>'points')::integer end,
         r.answered_at
  from passport_occasion_prompts p
  join passport_occasion_responses r
    on r.occasion_id = p.occasion_id and r.prompt_id = p.prompt_id and r.user_id = p.audience_only
  join passport_occasion_consents c
    on c.occasion_id = p.occasion_id and c.prompt_id = p.prompt_id
   and c.user_id = p.audience_only and c.agreed
  where p.occasion_id = p_occasion
    and passport_is_occasion_member(p_occasion, auth.uid())
    and p.audience_only is not null and p.asked_by is not null
    and p.asked_by <> p.audience_only
    and p.content->>'family' in ('mission', 'dare')
    and p.resolution = 'true'::jsonb
    and r.value = 'true'::jsonb
    and passport_is_occasion_member(p_occasion, p.audience_only)
    and passport_is_occasion_member(p_occasion, p.asked_by);
$$;

-- ------------------------------------------------------------- privileges

-- Production applies no default grants to new tables (see migration.sql).
-- Challenges and votes: read only; every write is a function above.
GRANT SELECT ON public.passport_occasion_challenges,
  public.passport_occasion_challenge_votes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_occasion_team_reactions TO authenticated;
GRANT UPDATE (emoji, at) ON public.passport_occasion_team_reactions TO authenticated;
REVOKE ALL ON public.passport_occasion_challenges,
  public.passport_occasion_challenge_votes,
  public.passport_occasion_team_reactions FROM anon;

REVOKE ALL ON FUNCTION public.passport_challenge_closed(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_issue_challenge(uuid, text, uuid, text, text, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_answer_challenge(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_perform_challenge(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_vote_challenge(uuid, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_occasion_mission_ledger(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_challenge_closed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_issue_challenge(uuid, text, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_answer_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_perform_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_vote_challenge(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_occasion_mission_ledger(uuid) TO authenticated;

-- ---------------------------------------------------------------- policies

do $$ begin
  -- A declined or withdrawn challenge is the two people's business only.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_challenges_read') then
    create policy passport_occasion_challenges_read on public.passport_occasion_challenges
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and (status in ('open', 'accepted')
             or auth.uid() in (challenger_id, target_id)));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_challenge_votes_read') then
    create policy passport_occasion_challenge_votes_read on public.passport_occasion_challenge_votes
      for select to authenticated using (passport_is_occasion_member(occasion_id, auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_team_reactions_read') then
    create policy passport_occasion_team_reactions_read on public.passport_occasion_team_reactions
      for select to authenticated using (passport_is_occasion_member(occasion_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_team_reactions_own') then
    create policy passport_occasion_team_reactions_own on public.passport_occasion_team_reactions
      for insert to authenticated with check (
        from_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and passport_is_occasion_member(occasion_id, to_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_team_reactions_change') then
    create policy passport_occasion_team_reactions_change on public.passport_occasion_team_reactions
      for update to authenticated
      using (from_id = auth.uid()) with check (from_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_team_reactions_unreact') then
    create policy passport_occasion_team_reactions_unreact on public.passport_occasion_team_reactions
      for delete to authenticated using (from_id = auth.uid());
  end if;
end $$;

-- ------------------------------------------------------------- Chirp Bot

do $$ begin
  -- Chirp Bot's lines about a challenge being issued, taken, or a prophecy
  -- made are keyed by the person whose action they are about. Widen the
  -- self-keyed rule only if it is still night-migration.sql's.
  if exists (select 1 from pg_constraint
             where conname = 'passport_occasion_moments_bot_self_check'
               and pg_get_constraintdef(oid) like '%mission%')
     and not exists (select 1 from pg_constraint
             where conname = 'passport_occasion_moments_bot_self_check'
               and pg_get_constraintdef(oid) like '%oracle%') then
    alter table public.passport_occasion_moments
      drop constraint passport_occasion_moments_bot_self_check;
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_bot_self_check check (
        bot_key is null
        or split_part(bot_key, ':', 1) not in
          ('team', 'arrive', 'couch', 'switch', 'mission', 'done', 'chal', 'took', 'oracle')
        or split_part(bot_key, ':', 2) = actor_id::text) not valid;
  end if;
end $$;
