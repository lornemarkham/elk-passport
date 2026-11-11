-- ============================================================================
-- MIGRATION (PROPOSED) — passport_sesh (Sesh Wars, inside Snow: /snow/sesh-wars)
-- Written 2026-11-10 for the owner brief "SESH WARS — BRING THE MOUNTAIN TO
-- LIFE". Lives in docs/ because supabase/migrations is a shared contract: the
-- contracts lane moves it (suggested name 20261112000000_passport_sesh.sql).
-- Additive and independent: it touches no existing table or function.
--
-- WHAT THIS IS
--
--   riders      one Sesh Wars profile per signed-in person (nickname, home
--               mountain, ski/snowboard, division, age group 13–17 / 18+)
--   features    the parks a resort publishes (seeded below, each with its
--               source) and riders' proposals, which wait for a moderator
--   clips       a rider's video on a feature (the file is in Storage)
--   challenges  two clips on one feature, 24 hours of voting
--   votes       one per person per challenge, final
--   chirps      words on a feature, clip or challenge
--   reactions   the five reactions, one of each per person per clip
--   reports     one per person per thing; three hide it until a moderator looks
--   blocks      a rider's own blocks
--   moderators  who may restore, remove, approve and close
--
-- SECURITY MODEL
--
--   * Reads go through row-level security as the caller, from Passport's
--     ordinary server client (anon key + session cookie). No service key.
--   * Nobody may insert, update or delete a row directly. Every write is a
--     SECURITY DEFINER function below that reads auth.uid() and re-checks
--     the rules the app checks first (src/domain/snow/sesh/rules.ts): one
--     vote, final, not in your own challenge, inside the 24 hours; answers on
--     the same feature, same division, same age group, nobody blocked; the
--     rights and open-terrain confirmations; adults post no words on a
--     younger rider's clip or challenge.
--   * A visitor who isn't signed in sees adults' published clips, chirps and
--     profiles only. A younger rider is visible to signed-in people only.
--   * The word rules (no escalation, injury, insults or contact details,
--     src/domain/snow/sesh/safety.ts) run in the app; here only lengths are
--     enforced. Reports and moderators are the backstop for a hand-made call.
--   * Video files: a private Storage bucket, `sesh-wars-clips`. A person may
--     upload only into a folder named after their own user id; a file can be
--     read (a short-lived signed link) only while a clip the reader can see
--     points at it. Applied only where Supabase Storage exists.
--
-- HOW TO APPLY
--
-- Through the release runner, or paste into the SQL editor of the Passport
-- project. No BEGIN/COMMIT: the runner applies each file in one transaction.
-- Every statement is guarded, so applying it twice changes nothing.
-- Production grants nothing by default, so every grant is explicit.
-- Rollback: docs/product/snow/sesh-wars-rollback.sql (kept separate so the
-- runner's line scan sees no destructive SQL here).
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_sesh_riders (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 24),
  home_mountain text NOT NULL CHECK (home_mountain IN ('silverstar', 'big-white', 'whistler-blackcomb')),
  sport text NOT NULL CHECK (sport IN ('ski', 'snowboard')),
  division text CHECK (division IN ('beginner', 'intermediate', 'advanced')),
  age_group text NOT NULL CHECK (age_group IN ('youth', 'adult')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS passport_sesh_riders_name
  ON public.passport_sesh_riders (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.passport_sesh_features (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{3,60}$'),
  mountain_id text NOT NULL CHECK (mountain_id IN ('silverstar', 'big-white', 'whistler-blackcomb')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  kind text NOT NULL CHECK (kind IN ('park-lane', 'jump', 'rail', 'box', 'roller', 'halfpipe', 'side-hit', 'jib')),
  sizes text[] NOT NULL DEFAULT '{}',
  where_words text NOT NULL CHECK (char_length(where_words) <= 120),
  description text NOT NULL CHECK (char_length(description) <= 400),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('approved', 'proposed', 'closed', 'removed')),
  opens date,
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https://'),
  source_quote text CHECK (char_length(source_quote) <= 200),
  source_checked date,
  note text CHECK (char_length(note) <= 300),
  proposed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- An approved feature names where the resort says it exists.
  CHECK (status <> 'approved' OR (source_url IS NOT NULL AND source_checked IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.passport_sesh_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id text NOT NULL REFERENCES public.passport_sesh_features (id),
  rider_id uuid NOT NULL REFERENCES public.passport_sesh_riders (user_id) ON DELETE CASCADE,
  sport text NOT NULL CHECK (sport IN ('ski', 'snowboard')),
  division text NOT NULL CHECK (division IN ('beginner', 'intermediate', 'advanced')),
  category text NOT NULL CHECK (category IN ('king-queen', 'best-trick', 'best-style', 'cleanest-landing', 'most-creative', 'best-progression', 'harmless-bail')),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 140),
  -- <user id>/<random uuid>.<ext>, in the sesh-wars-clips bucket
  video_path text NOT NULL UNIQUE
    CHECK (video_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov|webm)$'),
  poster_path text CHECK (poster_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  by_guardian boolean NOT NULL DEFAULT false,
  rights_confirmed boolean NOT NULL CHECK (rights_confirmed),
  open_terrain_confirmed boolean NOT NULL CHECK (open_terrain_confirmed),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_sesh_clips_feature ON public.passport_sesh_clips (feature_id, created_at DESC);
CREATE INDEX IF NOT EXISTS passport_sesh_clips_rider ON public.passport_sesh_clips (rider_id);

CREATE TABLE IF NOT EXISTS public.passport_sesh_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id text NOT NULL REFERENCES public.passport_sesh_features (id),
  category text NOT NULL,
  division text NOT NULL,
  defender_clip uuid NOT NULL REFERENCES public.passport_sesh_clips (id) ON DELETE CASCADE,
  challenger_clip uuid NOT NULL UNIQUE REFERENCES public.passport_sesh_clips (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  CHECK (defender_clip <> challenger_clip),
  CHECK (closes_at = created_at + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS passport_sesh_challenges_feature ON public.passport_sesh_challenges (feature_id);

CREATE TABLE IF NOT EXISTS public.passport_sesh_votes (
  challenge_id uuid NOT NULL REFERENCES public.passport_sesh_challenges (id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.passport_sesh_riders (user_id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('defender', 'challenger')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, voter_id)
);

CREATE TABLE IF NOT EXISTS public.passport_sesh_chirps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_kind text NOT NULL CHECK (thread_kind IN ('feature', 'clip', 'challenge')),
  thread_id text NOT NULL CHECK (char_length(thread_id) <= 80),
  author_id uuid NOT NULL REFERENCES public.passport_sesh_riders (user_id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 280),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_sesh_chirps_thread ON public.passport_sesh_chirps (thread_kind, thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.passport_sesh_reactions (
  clip_id uuid NOT NULL REFERENCES public.passport_sesh_clips (id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES public.passport_sesh_riders (user_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sick', 'stomped', 'nice-try', 'your-move', 'send-it')),
  PRIMARY KEY (clip_id, rider_id, kind)
);

CREATE TABLE IF NOT EXISTS public.passport_sesh_reports (
  target_kind text NOT NULL CHECK (target_kind IN ('clip', 'chirp', 'feature')),
  target_id text NOT NULL CHECK (char_length(target_id) <= 80),
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_kind, target_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS public.passport_sesh_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.passport_sesh_moderators (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
);

-- ── Row-level security: reads ─────────────────────────────────────────────

ALTER TABLE public.passport_sesh_riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_chirps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_sesh_moderators ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.passport_sesh_riders, public.passport_sesh_features,
  public.passport_sesh_clips, public.passport_sesh_challenges,
  public.passport_sesh_votes, public.passport_sesh_chirps,
  public.passport_sesh_reactions, public.passport_sesh_reports,
  public.passport_sesh_blocks, public.passport_sesh_moderators
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.passport_sesh_riders, public.passport_sesh_features,
  public.passport_sesh_clips, public.passport_sesh_challenges,
  public.passport_sesh_votes, public.passport_sesh_chirps,
  public.passport_sesh_reactions
  TO anon, authenticated;
GRANT SELECT ON public.passport_sesh_blocks, public.passport_sesh_moderators,
  public.passport_sesh_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.passport_sesh_is_moderator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from passport_sesh_moderators where user_id = auth.uid())
$$;

-- Age group of a rider, without exposing the row (used inside policies).
CREATE OR REPLACE FUNCTION public.passport_sesh_age(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select age_group from passport_sesh_riders where user_id = p_user
$$;

DROP POLICY IF EXISTS sesh_riders_read ON public.passport_sesh_riders;
CREATE POLICY sesh_riders_read ON public.passport_sesh_riders FOR SELECT
  USING (age_group = 'adult' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS sesh_features_read ON public.passport_sesh_features;
CREATE POLICY sesh_features_read ON public.passport_sesh_features FOR SELECT
  USING (status IN ('approved', 'closed') OR proposed_by = auth.uid()
         OR public.passport_sesh_is_moderator());

DROP POLICY IF EXISTS sesh_clips_read ON public.passport_sesh_clips;
CREATE POLICY sesh_clips_read ON public.passport_sesh_clips FOR SELECT
  USING (
    rider_id = auth.uid()
    OR public.passport_sesh_is_moderator()
    OR (status = 'published'
        AND (auth.uid() IS NOT NULL OR public.passport_sesh_age(rider_id) = 'adult'))
  );

-- A challenge is visible when both its clips are (the subqueries run under
-- the clips policy).
DROP POLICY IF EXISTS sesh_challenges_read ON public.passport_sesh_challenges;
CREATE POLICY sesh_challenges_read ON public.passport_sesh_challenges FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.passport_sesh_clips c WHERE c.id = defender_clip)
    AND EXISTS (SELECT 1 FROM public.passport_sesh_clips c WHERE c.id = challenger_clip)
  );

DROP POLICY IF EXISTS sesh_votes_read ON public.passport_sesh_votes;
CREATE POLICY sesh_votes_read ON public.passport_sesh_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS sesh_chirps_read ON public.passport_sesh_chirps;
CREATE POLICY sesh_chirps_read ON public.passport_sesh_chirps FOR SELECT
  USING (
    author_id = auth.uid()
    OR public.passport_sesh_is_moderator()
    OR (status = 'published'
        AND (auth.uid() IS NOT NULL OR public.passport_sesh_age(author_id) = 'adult'))
  );

DROP POLICY IF EXISTS sesh_reactions_read ON public.passport_sesh_reactions;
CREATE POLICY sesh_reactions_read ON public.passport_sesh_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS sesh_reports_read ON public.passport_sesh_reports;
CREATE POLICY sesh_reports_read ON public.passport_sesh_reports FOR SELECT
  USING (reporter_id = auth.uid() OR public.passport_sesh_is_moderator());

DROP POLICY IF EXISTS sesh_blocks_read ON public.passport_sesh_blocks;
CREATE POLICY sesh_blocks_read ON public.passport_sesh_blocks FOR SELECT
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS sesh_moderators_read ON public.passport_sesh_moderators;
CREATE POLICY sesh_moderators_read ON public.passport_sesh_moderators FOR SELECT
  USING (user_id = auth.uid());

-- ── Writes: one function per action ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.passport_sesh_me()
RETURNS passport_sesh_riders LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare r passport_sesh_riders;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  select * into r from passport_sesh_riders where user_id = auth.uid();
  if not found then
    raise exception 'make your rider profile first' using errcode = 'P0002';
  end if;
  return r;
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_blocked(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from passport_sesh_blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

CREATE OR REPLACE FUNCTION public.passport_sesh_profile(
  p_name text, p_home text, p_sport text, p_division text, p_age text
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  insert into passport_sesh_riders (user_id, name, home_mountain, sport, division, age_group)
  values (auth.uid(), btrim(p_name), p_home, p_sport, nullif(p_division, ''), p_age)
  on conflict (user_id) do update
    set name = excluded.name, home_mountain = excluded.home_mountain,
        sport = excluded.sport, division = excluded.division;
  -- The age group is set once: changing it would undo the protections.
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_post(
  p_feature text, p_sport text, p_division text, p_category text, p_caption text,
  p_video text, p_poster text, p_by_guardian boolean, p_rights boolean,
  p_open_terrain boolean, p_answer_to uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare
  me passport_sesh_riders := passport_sesh_me();
  f passport_sesh_features;
  d passport_sesh_clips;
  v_clip uuid;
  v_challenge uuid;
  v_now timestamptz := now();
begin
  select * into f from passport_sesh_features where id = p_feature;
  if not found or f.status <> 'approved' then
    raise exception 'that feature is not open for clips' using errcode = '22023';
  end if;
  if f.opens is not null and (v_now at time zone 'America/Vancouver')::date < f.opens then
    raise exception 'that park has not opened yet' using errcode = '22023';
  end if;
  if not coalesce(p_rights, false) or not coalesce(p_open_terrain, false) then
    raise exception 'confirm the rights and the open terrain' using errcode = '22023';
  end if;
  if coalesce(p_by_guardian, false) and me.age_group <> 'adult' then
    raise exception 'only a parent or guardian posts for a younger rider' using errcode = '22023';
  end if;
  if split_part(p_video, '/', 1) <> auth.uid()::text
     or (p_poster is not null and split_part(p_poster, '/', 1) <> auth.uid()::text) then
    raise exception 'that file is not yours' using errcode = '42501';
  end if;
  if p_answer_to is not null then
    select * into d from passport_sesh_clips where id = p_answer_to and status = 'published';
    if not found then
      raise exception 'that clip is not up any more' using errcode = 'P0002';
    end if;
    if d.rider_id = me.user_id then
      raise exception 'that is your own clip' using errcode = '22023';
    end if;
    if d.feature_id <> p_feature or d.division <> p_division then
      raise exception 'same feature, same division' using errcode = '22023';
    end if;
    if passport_sesh_age(d.rider_id) <> me.age_group then
      raise exception 'challenges stay inside an age group' using errcode = '22023';
    end if;
    if passport_sesh_blocked(me.user_id, d.rider_id) then
      raise exception 'not possible' using errcode = '42501';
    end if;
    if exists (select 1 from passport_sesh_challenges ch
               join passport_sesh_clips a on a.id = ch.challenger_clip
               where ch.defender_clip = d.id and a.rider_id = me.user_id and ch.closes_at > v_now) then
      raise exception 'you already have a challenge open on this clip' using errcode = '23505';
    end if;
  end if;
  insert into passport_sesh_clips (feature_id, rider_id, sport, division, category, caption,
    video_path, poster_path, by_guardian, rights_confirmed, open_terrain_confirmed)
  values (p_feature, me.user_id, p_sport, p_division,
    case when d.id is null then p_category else d.category end,
    btrim(coalesce(p_caption, '')), p_video, p_poster, coalesce(p_by_guardian, false), true, true)
  returning id into v_clip;
  if d.id is not null then
    insert into passport_sesh_challenges (feature_id, category, division, defender_clip,
      challenger_clip, created_at, closes_at)
    values (p_feature, d.category, d.division, d.id, v_clip, v_now, v_now + interval '24 hours')
    returning id into v_challenge;
  end if;
  return jsonb_build_object('clip', v_clip, 'challenge', v_challenge);
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_vote(p_challenge uuid, p_side text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare
  me passport_sesh_riders := passport_sesh_me();
  ch passport_sesh_challenges;
begin
  select * into ch from passport_sesh_challenges where id = p_challenge;
  if not found then
    raise exception 'no such challenge' using errcode = 'P0002';
  end if;
  if ch.closes_at <= now() then
    raise exception 'voting has closed' using errcode = '22023';
  end if;
  if exists (select 1 from passport_sesh_clips where id in (ch.defender_clip, ch.challenger_clip)
             and rider_id = me.user_id) then
    raise exception 'no voting in your own challenge' using errcode = '22023';
  end if;
  -- A younger rider's challenge is voted on by signed-in people only, which
  -- every caller here is; a vote is final (the primary key refuses a second).
  insert into passport_sesh_votes (challenge_id, voter_id, side)
  values (p_challenge, me.user_id, p_side);
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_chirp(p_kind text, p_thread text, p_body text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare
  me passport_sesh_riders := passport_sesh_me();
  v_youth boolean := false;
  v_owner uuid;
  v_id uuid;
begin
  if p_kind = 'clip' then
    select rider_id into v_owner from passport_sesh_clips where id::text = p_thread and status = 'published';
    if not found then raise exception 'no such clip' using errcode = 'P0002'; end if;
    v_youth := passport_sesh_age(v_owner) = 'youth';
    if passport_sesh_blocked(me.user_id, v_owner) then
      raise exception 'not possible' using errcode = '42501';
    end if;
  elsif p_kind = 'challenge' then
    select bool_or(passport_sesh_age(c.rider_id) = 'youth') into v_youth
      from passport_sesh_challenges ch
      join passport_sesh_clips c on c.id in (ch.defender_clip, ch.challenger_clip)
     where ch.id::text = p_thread;
    if v_youth is null then raise exception 'no such challenge' using errcode = 'P0002'; end if;
  elsif p_kind = 'feature' then
    if not exists (select 1 from passport_sesh_features where id = p_thread and status in ('approved', 'closed')) then
      raise exception 'no such feature' using errcode = 'P0002';
    end if;
  else
    raise exception 'bad thread' using errcode = '22023';
  end if;
  if v_youth and me.age_group = 'adult' then
    raise exception 'adults react here, they do not post words' using errcode = '42501';
  end if;
  insert into passport_sesh_chirps (thread_kind, thread_id, author_id, body)
  values (p_kind, p_thread, me.user_id, btrim(p_body))
  returning id into v_id;
  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_react(p_clip uuid, p_kind text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare me passport_sesh_riders := passport_sesh_me();
begin
  if not exists (select 1 from passport_sesh_clips where id = p_clip and status = 'published') then
    raise exception 'no such clip' using errcode = 'P0002';
  end if;
  delete from passport_sesh_reactions where clip_id = p_clip and rider_id = me.user_id and kind = p_kind;
  if found then return false; end if;
  insert into passport_sesh_reactions (clip_id, rider_id, kind) values (p_clip, me.user_id, p_kind);
  return true;
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_report(p_kind text, p_target text, p_reason text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare v_count int;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  insert into passport_sesh_reports (target_kind, target_id, reporter_id, reason)
  values (p_kind, p_target, auth.uid(), p_reason)
  on conflict do nothing;
  select count(*) into v_count from passport_sesh_reports
   where target_kind = p_kind and target_id = p_target;
  if v_count >= 3 then
    if p_kind = 'clip' then
      update passport_sesh_clips set status = 'hidden' where id::text = p_target and status = 'published';
    elsif p_kind = 'chirp' then
      update passport_sesh_chirps set status = 'hidden' where id::text = p_target and status = 'published';
    elsif p_kind = 'feature' then
      update passport_sesh_features set status = 'closed' where id = p_target and status = 'approved';
    end if;
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_block(p_rider uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  insert into passport_sesh_blocks (blocker_id, blocked_id) values (auth.uid(), p_rider)
  on conflict do nothing;
end $$;

CREATE OR REPLACE FUNCTION public.passport_sesh_propose(
  p_mountain text, p_name text, p_kind text, p_where text, p_why text
) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare
  me passport_sesh_riders := passport_sesh_me();
  v_id text := 'p-' || substr(md5(gen_random_uuid()::text), 1, 12);
begin
  if (select count(*) from passport_sesh_features where proposed_by = me.user_id and status = 'proposed') >= 5 then
    raise exception 'five proposals waiting is the limit' using errcode = '22023';
  end if;
  insert into passport_sesh_features (id, mountain_id, name, kind, where_words, description, status, proposed_by)
  values (v_id, p_mountain, btrim(p_name), p_kind, btrim(p_where), btrim(p_why), 'proposed', me.user_id);
  return v_id;
end $$;

-- A moderator restores, hides or removes a clip or chirp; approves, closes or
-- removes a feature (an approval needs the resort's page and the day read).
CREATE OR REPLACE FUNCTION public.passport_sesh_moderate(
  p_kind text, p_target text, p_status text, p_source_url text DEFAULT NULL, p_source_quote text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  if not passport_sesh_is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_kind = 'clip' then
    update passport_sesh_clips set status = p_status where id::text = p_target;
  elsif p_kind = 'chirp' then
    update passport_sesh_chirps set status = p_status where id::text = p_target;
  elsif p_kind = 'feature' then
    update passport_sesh_features
       set status = p_status,
           source_url = coalesce(p_source_url, source_url),
           source_quote = coalesce(p_source_quote, source_quote),
           source_checked = case when p_source_url is not null then current_date else source_checked end
     where id = p_target;
  else
    raise exception 'bad kind' using errcode = '22023';
  end if;
  if p_status = 'published' or p_status = 'approved' then
    delete from passport_sesh_reports where target_kind = p_kind and target_id = p_target;
  end if;
end $$;

REVOKE ALL ON FUNCTION public.passport_sesh_is_moderator() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_age(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_me() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_blocked(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_profile(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_post(text, text, text, text, text, text, text, boolean, boolean, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_vote(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_chirp(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_react(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_report(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_block(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_propose(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_sesh_moderate(text, text, text, text, text) FROM PUBLIC;

-- Policies call these two as the reader, so both roles need them.
GRANT EXECUTE ON FUNCTION public.passport_sesh_is_moderator() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_age(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_profile(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_post(text, text, text, text, text, text, text, boolean, boolean, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_vote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_chirp(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_react(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_report(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_block(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_propose(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_sesh_moderate(text, text, text, text, text) TO authenticated;

-- ── The parks the resorts publish (read 2026-11-10) ────────────────────────
-- Kept in step with src/domain/snow/sesh/catalogue.ts by a test.

INSERT INTO public.passport_sesh_features
  (id, mountain_id, name, kind, sizes, where_words, description, status, opens, source_url, source_quote, source_checked, note)
VALUES
  ('bw-telus-sm', 'big-white', 'TELUS Park — Small & Medium lane', 'park-lane', '{small,medium}', 'TELUS Park, Big White',
   'Big White''s progression lane: rails, jumps and taps with progressive takeoffs and landings. The place to start.',
   'approved', '2026-11-26', 'https://www.bigwhite.com/mountain-conditions/park-conditions', 'Small & Medium Terrain Park Lane', '2026-11-10',
   'Big White supports the Burton Smart Style program. Ride within your ability and check the park every day before riding it.'),
  ('bw-telus-lxl', 'big-white', 'TELUS Park — Large & XL lane', 'park-lane', '{large,xl}', 'TELUS Park, Big White',
   'The bigger lane at TELUS Park, for riders who already own the smalls and mediums.',
   'approved', '2026-11-26', 'https://www.bigwhite.com/mountain-conditions/park-conditions', 'Large & Extra Large Terrain Park Lane', '2026-11-10',
   'Big White supports the Burton Smart Style program. Ride within your ability and check the park every day before riding it.'),
  ('bw-halfpipe', 'big-white', 'TELUS Park halfpipe', 'halfpipe', '{}', 'TELUS Park, Big White',
   'Big White''s halfpipe, listed on the resort''s park conditions page.',
   'approved', '2026-11-26', 'https://www.bigwhite.com/mountain-conditions/park-conditions', 'Halfpipe', '2026-11-10', NULL),
  ('wb-ego', 'whistler-blackcomb', 'Ego Park', 'park-lane', '{small}', 'Whistler Mountain',
   'Small features on Whistler — the resort''s own words for where to start.',
   'approved', NULL, 'https://www.whistlerblackcomb.com/the-mountain/about-the-mountain/terrain-parks.aspx', 'We have opened small features at Ego Park on Whistler', '2026-11-10', NULL),
  ('wb-choker', 'whistler-blackcomb', 'Choker Park', 'park-lane', '{small}', 'Blackcomb Mountain',
   'Small features on Blackcomb.',
   'approved', NULL, 'https://www.whistlerblackcomb.com/the-mountain/about-the-mountain/terrain-parks.aspx', '…and Choker Park on Blackcomb', '2026-11-10', NULL),
  ('wb-terrain-park', 'whistler-blackcomb', 'Terrain Park', 'park-lane', '{medium,large}', 'Whistler Blackcomb',
   'Intermediate and advanced features mixed together — tables, hips, rails and techy jibs. The stepping stone to the Highest Level Park.',
   'approved', NULL, 'https://www.whistlerblackcomb.com/the-mountain/about-the-mountain/terrain-parks.aspx', 'packed with intermediate and advanced features mixed together', '2026-11-10', NULL),
  ('wb-highest-level', 'whistler-blackcomb', 'Highest Level Terrain Park', 'park-lane', '{xl}', 'Whistler Blackcomb',
   'Jumps, spines, rails and jibs designed with the expert rider in mind.',
   'approved', NULL, 'https://www.whistlerblackcomb.com/the-mountain/about-the-mountain/terrain-parks.aspx', 'Massive jumps, spines, rails and jibs designed with the expert rider in mind', '2026-11-10',
   'Helmets are mandatory in this zone (Whistler Blackcomb).')
ON CONFLICT (id) DO NOTHING;

-- ── Storage: the clips bucket (only where Supabase Storage exists) ─────────

DO $storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage schema not present: skipping the sesh-wars-clips bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('sesh-wars-clips', 'sesh-wars-clips', false, 52428800,
          array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg'])
  on conflict (id) do nothing;

  execute 'drop policy if exists sesh_clips_upload on storage.objects';
  execute $p$create policy sesh_clips_upload on storage.objects for insert to authenticated
    with check (bucket_id = 'sesh-wars-clips'
      and (storage.foldername(name))[1] = auth.uid()::text
      and exists (select 1 from public.passport_sesh_riders r where r.user_id = auth.uid()))$p$;

  execute 'drop policy if exists sesh_clips_read_file on storage.objects';
  execute $p$create policy sesh_clips_read_file on storage.objects for select to anon, authenticated
    using (bucket_id = 'sesh-wars-clips' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.passport_sesh_clips c
                 where c.video_path = name or c.poster_path = name)))$p$;

  execute 'drop policy if exists sesh_clips_delete_own on storage.objects';
  execute $p$create policy sesh_clips_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'sesh-wars-clips' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
end
$storage$;

NOTIFY pgrst, 'reload schema';
