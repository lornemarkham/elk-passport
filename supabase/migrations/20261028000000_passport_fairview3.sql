-- ============================================================================
-- Fairview 3 — No More Crystal Balls. A one-morning live show for ~140 phones.
--
-- Apply in the SQL editor (supabase/README.md hazard 1). Guarded: applying it
-- twice changes nothing. Then set the presenter's key, once, as the owner:
--
--   select public.fairview3_set_presenter_key('choose-a-long-key');
--
-- Shape: one state row the presenter edits, one row per phone that showed
-- up, one vote per phone per question, one row per feedback submission.
--
-- Who may do what: the public anon key (it ships in the browser bundle, so
-- it is public) is granted NOTHING on the tables — RLS is on and there are no
-- policies — and EXECUTE on the functions below, each SECURITY DEFINER and
-- deciding for itself. The presenter's key is checked inside
-- fairview3_presenter_ok against a sha256 (pgcrypto, in the extensions
-- schema as Supabase installs it). Production grants nothing by default, so
-- every grant is explicit (docs/release/PRODUCTION-DATABASE-READINESS.md).
-- ============================================================================

-- Supabase already has both; a local stack may have neither.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.passport_fairview3_state (
  id                 text PRIMARY KEY CHECK (id = 'live'),
  state              jsonb NOT NULL,
  presenter_key_hash text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_fairview3_participants (
  participant_id uuid PRIMARY KEY,
  first_seen     timestamptz NOT NULL DEFAULT now(),
  last_seen      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_fairview3_votes (
  question       text NOT NULL CHECK (question IN ('q1','q2','q3')),
  participant_id uuid NOT NULL,
  option_index   int  NOT NULL CHECK (option_index BETWEEN 0 AND 9),
  at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question, participant_id)
);

CREATE TABLE IF NOT EXISTS public.passport_fairview3_feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  prompt         text NOT NULL CHECK (prompt IN ('missed','better','deliver')),
  body           text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  fingerprint    text NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden')),
  at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_fairview3_feedback_participant
  ON public.passport_fairview3_feedback (participant_id);

ALTER TABLE public.passport_fairview3_state        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_fairview3_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_fairview3_votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_fairview3_feedback     ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even a stray default privilege gives anon nothing here.
REVOKE ALL ON public.passport_fairview3_state,
              public.passport_fairview3_participants,
              public.passport_fairview3_votes,
              public.passport_fairview3_feedback
  FROM anon, authenticated;

INSERT INTO public.passport_fairview3_state (id, state)
VALUES ('live', '{"section":"curtain","questions":{"q1":"closed","q2":"closed","q3":"closed"},"finale":{"started":false,"audioUrl":null,"lyrics":null},"rev":0}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------ owner

-- Runs as the owner in the SQL editor only; anon and authenticated cannot.
CREATE OR REPLACE FUNCTION public.fairview3_set_presenter_key(p_key text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  update passport_fairview3_state
     set presenter_key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex'),
         updated_at = now()
   where id = 'live';
$$;
REVOKE ALL ON FUNCTION public.fairview3_set_presenter_key(text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------ public

CREATE OR REPLACE FUNCTION public.fairview3_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select jsonb_build_object(
    'state', (select state from passport_fairview3_state where id = 'live'),
    'participants', (select count(*) from passport_fairview3_participants),
    'tallies', (
      select coalesce(jsonb_object_agg(q, counts), '{}'::jsonb)
      from (
        select question as q,
               (select jsonb_agg(coalesce(c, 0) order by i)
                  from generate_series(0, 9) i
                  left join (select option_index, count(*) c
                               from passport_fairview3_votes v2
                              where v2.question = v.question
                              group by option_index) t on t.option_index = i) as counts
        from passport_fairview3_votes v
        group by question
      ) s
    ),
    'feedback', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'prompt', prompt, 'body', body) order by at), '[]'::jsonb)
      from passport_fairview3_feedback where status = 'approved'
    ),
    'at', now()
  );
$$;

CREATE OR REPLACE FUNCTION public.fairview3_presence(p_participant uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  insert into passport_fairview3_participants (participant_id)
  values (p_participant)
  on conflict (participant_id) do update set last_seen = now();
$$;

CREATE OR REPLACE FUNCTION public.fairview3_vote(p_participant uuid, p_question text, p_option int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_status text;
  v_max int;
BEGIN
  if p_question not in ('q1','q2','q3') then return 'bad-option'; end if;
  v_max := case p_question when 'q1' then 5 when 'q2' then 5 else 3 end;
  if p_option is null or p_option < 0 or p_option >= v_max then return 'bad-option'; end if;
  select state->'questions'->>p_question into v_status from passport_fairview3_state where id = 'live';
  if v_status is distinct from 'open' then return 'closed'; end if;
  insert into passport_fairview3_participants (participant_id) values (p_participant)
    on conflict (participant_id) do update set last_seen = now();
  insert into passport_fairview3_votes (question, participant_id, option_index)
  values (p_question, p_participant, p_option)
  on conflict (question, participant_id) do update set option_index = excluded.option_index, at = now();
  return 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.fairview3_feedback(p_participant uuid, p_prompt text, p_body text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_print text;
BEGIN
  if p_prompt not in ('missed','better','deliver') then return 'duplicate'; end if;
  if p_body is null or char_length(p_body) < 1 or char_length(p_body) > 280 then return 'duplicate'; end if;
  v_print := trim(regexp_replace(lower(p_body), '[^a-z0-9]+', ' ', 'g'));
  if (select count(*) from passport_fairview3_feedback where participant_id = p_participant) >= 6 then
    return 'too-many';
  end if;
  if exists (select 1 from passport_fairview3_feedback where participant_id = p_participant and fingerprint = v_print) then
    return 'duplicate';
  end if;
  insert into passport_fairview3_participants (participant_id) values (p_participant)
    on conflict (participant_id) do update set last_seen = now();
  insert into passport_fairview3_feedback (participant_id, prompt, body, fingerprint)
  values (p_participant, p_prompt, p_body, v_print);
  return 'ok';
END;
$$;

-- --------------------------------------------------------------- presenter

CREATE OR REPLACE FUNCTION public.fairview3_presenter_ok(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  select exists (
    select 1 from passport_fairview3_state
     where id = 'live'
       and presenter_key_hash is not null
       and p_key is not null and char_length(p_key) > 0
       and presenter_key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  );
$$;

CREATE OR REPLACE FUNCTION public.fairview3_presenter(p_key text, p_action jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_state jsonb;
  v_type text := p_action->>'type';
  v_what text;
BEGIN
  if not public.fairview3_presenter_ok(p_key) then return false; end if;
  select state into v_state from passport_fairview3_state where id = 'live' for update;

  if v_type = 'section' then
    if (p_action->>'section') not in ('curtain','merlin','spellbook','team-data','team-ai','team-unification','team-care','parallel','know','vote-1','vote-2','vote-3','challenge','finale') then
      raise exception 'bad section';
    end if;
    v_state := jsonb_set(v_state, '{section}', to_jsonb(p_action->>'section'));

  elsif v_type = 'question' then
    if (p_action->>'question') not in ('q1','q2','q3') or (p_action->>'status') not in ('closed','open','revealed') then
      raise exception 'bad question';
    end if;
    v_state := jsonb_set(v_state, array['questions', p_action->>'question'], to_jsonb(p_action->>'status'));

  elsif v_type = 'finale' then
    if p_action ? 'started' then
      v_state := jsonb_set(v_state, '{finale,started}', to_jsonb((p_action->>'started')::boolean));
    end if;
    if p_action ? 'audioUrl' then
      if p_action->'audioUrl' = 'null'::jsonb or p_action->>'audioUrl' = '' then
        v_state := jsonb_set(v_state, '{finale,audioUrl}', 'null'::jsonb);
      elsif char_length(p_action->>'audioUrl') <= 2048 and (p_action->>'audioUrl') ~ '^(https://|/)' then
        v_state := jsonb_set(v_state, '{finale,audioUrl}', p_action->'audioUrl');
      else
        raise exception 'bad audio url';
      end if;
    end if;
    if p_action ? 'lyrics' then
      if p_action->'lyrics' = 'null'::jsonb or p_action->>'lyrics' = '' then
        v_state := jsonb_set(v_state, '{finale,lyrics}', 'null'::jsonb);
      elsif char_length(p_action->>'lyrics') <= 8000 then
        v_state := jsonb_set(v_state, '{finale,lyrics}', p_action->'lyrics');
      else
        raise exception 'lyrics too long';
      end if;
    end if;

  elsif v_type = 'moderate' then
    if (p_action->>'status') not in ('pending','approved','hidden') then raise exception 'bad status'; end if;
    update passport_fairview3_feedback set status = p_action->>'status' where id = (p_action->>'id')::uuid;
    return true;

  elsif v_type = 'reset' then
    v_what := p_action->>'what';
    if v_what not in ('votes','feedback','all') then raise exception 'bad reset'; end if;
    if v_what <> 'feedback' then delete from passport_fairview3_votes; end if;
    if v_what <> 'votes' then delete from passport_fairview3_feedback; end if;
    if v_what = 'all' then
      delete from passport_fairview3_participants;
      v_state := '{"section":"curtain","questions":{"q1":"closed","q2":"closed","q3":"closed"},"finale":{"started":false,"audioUrl":null,"lyrics":null},"rev":0}'::jsonb;
    end if;
  else
    raise exception 'bad action';
  end if;

  v_state := jsonb_set(v_state, '{rev}', to_jsonb(coalesce((v_state->>'rev')::int, 0) + 1));
  update passport_fairview3_state set state = v_state, updated_at = now() where id = 'live';
  return true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fairview3_inbox(p_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  select case when public.fairview3_presenter_ok(p_key) then jsonb_build_object(
    'feedback', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'participant_id', participant_id, 'prompt', prompt,
        'body', body, 'status', status, 'at', at) order by at desc), '[]'::jsonb)
      from passport_fairview3_feedback
    )
  ) else null end;
$$;

-- ------------------------------------------------------------------ grants

GRANT EXECUTE ON FUNCTION public.fairview3_snapshot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_presence(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_vote(uuid, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_feedback(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_presenter_ok(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_presenter(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_inbox(text) TO anon, authenticated;

-- PostgREST learns the new functions at once (Supabase also reloads on DDL).
NOTIFY pgrst, 'reload schema';
