-- ============================================================================
-- Fairview 3 — Executive Hot Seat + the musical showdown.
--
-- Apply in the SQL editor AFTER 20261028000000_passport_fairview3.sql
-- (supabase/README.md hazard 1). Guarded: applying it twice changes nothing.
-- It does not touch the presenter key.
--
-- Adds: a Q&A table and its upvotes (RLS on, no policies, anon granted
-- nothing), a fourth ballot "q4" (the showdown: 0 metal, 1 country,
-- 2 electro swing), three audio slots and a winner in the state row, and
-- replaces the snapshot / vote / presenter / inbox functions so they know
-- about all of it. Every new function is SECURITY DEFINER and GRANTed
-- explicitly (production grants nothing by default).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_fairview3_qa (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 32),
  body           text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  fingerprint    text NOT NULL,
  status         text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','answered','hidden')),
  at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_fairview3_qa_participant
  ON public.passport_fairview3_qa (participant_id);

CREATE TABLE IF NOT EXISTS public.passport_fairview3_qa_votes (
  question_id    uuid NOT NULL REFERENCES public.passport_fairview3_qa(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  PRIMARY KEY (question_id, participant_id)
);

ALTER TABLE public.passport_fairview3_qa       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_fairview3_qa_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_fairview3_qa, public.passport_fairview3_qa_votes
  FROM anon, authenticated;

-- The showdown ballot joins q1..q3.
ALTER TABLE public.passport_fairview3_votes
  DROP CONSTRAINT IF EXISTS passport_fairview3_votes_question_check;
ALTER TABLE public.passport_fairview3_votes
  ADD CONSTRAINT passport_fairview3_votes_question_check
  CHECK (question IN ('q1','q2','q3','q4'));

-- Fill the live state row to the new shape, keeping everything already set.
UPDATE public.passport_fairview3_state
   SET state = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(state, '{questions,q4}', coalesce(state->'questions'->'q4', '"closed"'::jsonb)),
             '{qa}', coalesce(state->'qa', '{"selected":null}'::jsonb)),
           '{showdown}', coalesce(state->'showdown', '{"announced":false,"winner":null}'::jsonb)),
         '{finale}',
         case when state->'finale' ? 'tracks' then state->'finale' else
           '{"started":false,"track":null,"volume":0.8,"tracks":{"metal":{"audioUrl":null,"lyrics":null},"country":{"audioUrl":null,"lyrics":null},"electroswing":{"audioUrl":null,"lyrics":null}}}'::jsonb
         end)
 WHERE id = 'live';

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
    'qa', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'body', t.body, 'status', t.status,
               'votes', t.votes, 'at', t.at)
             order by (t.status = 'answered'), t.votes desc, t.at), '[]'::jsonb)
      from (
        select q.*, (select count(*) from passport_fairview3_qa_votes v where v.question_id = q.id) as votes
          from passport_fairview3_qa q
         where q.status <> 'hidden'
         order by (q.id::text = (select state->'qa'->>'selected' from passport_fairview3_state where id = 'live')) desc,
                  (q.status = 'answered'), votes desc, q.at
         limit 80
      ) t
    ),
    'at', now()
  );
$$;

CREATE OR REPLACE FUNCTION public.fairview3_vote(p_participant uuid, p_question text, p_option int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_status text;
  v_max int;
BEGIN
  if p_question not in ('q1','q2','q3','q4') then return 'bad-option'; end if;
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

CREATE OR REPLACE FUNCTION public.fairview3_qa_ask(p_participant uuid, p_name text, p_body text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_print text;
BEGIN
  if p_body is null or char_length(p_body) < 1 or char_length(p_body) > 280 then return 'duplicate'; end if;
  if p_name is null or char_length(p_name) < 1 or char_length(p_name) > 32 then return 'duplicate'; end if;
  v_print := trim(regexp_replace(lower(p_body), '[^a-z0-9]+', ' ', 'g'));
  if (select count(*) from passport_fairview3_qa where participant_id = p_participant) >= 5 then
    return 'too-many';
  end if;
  if exists (select 1 from passport_fairview3_qa where participant_id = p_participant and fingerprint = v_print) then
    return 'duplicate';
  end if;
  insert into passport_fairview3_participants (participant_id) values (p_participant)
    on conflict (participant_id) do update set last_seen = now();
  insert into passport_fairview3_qa (participant_id, name, body, fingerprint)
  values (p_participant, p_name, p_body, v_print);
  return 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.fairview3_qa_upvote(p_participant uuid, p_question text, p_on boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
BEGIN
  begin
    v_id := p_question::uuid;
  exception when others then
    return 'missing';
  end;
  if not exists (select 1 from passport_fairview3_qa where id = v_id and status <> 'hidden') then
    return 'missing';
  end if;
  insert into passport_fairview3_participants (participant_id) values (p_participant)
    on conflict (participant_id) do update set last_seen = now();
  if p_on then
    insert into passport_fairview3_qa_votes (question_id, participant_id)
    values (v_id, p_participant) on conflict do nothing;
  else
    delete from passport_fairview3_qa_votes where question_id = v_id and participant_id = p_participant;
  end if;
  return 'ok';
END;
$$;

-- --------------------------------------------------------------- presenter

CREATE OR REPLACE FUNCTION public.fairview3_presenter(p_key text, p_action jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_state jsonb;
  v_type text := p_action->>'type';
  v_what text;
  v_track text;
  v_id uuid;
  v_default constant jsonb := '{"section":"curtain","questions":{"q1":"closed","q2":"closed","q3":"closed","q4":"closed"},"qa":{"selected":null},"showdown":{"announced":false,"winner":null},"finale":{"started":false,"track":null,"volume":0.8,"tracks":{"metal":{"audioUrl":null,"lyrics":null},"country":{"audioUrl":null,"lyrics":null},"electroswing":{"audioUrl":null,"lyrics":null}}},"rev":0}'::jsonb;
BEGIN
  if not public.fairview3_presenter_ok(p_key) then return false; end if;
  select state into v_state from passport_fairview3_state where id = 'live' for update;

  if v_type = 'section' then
    if (p_action->>'section') not in ('curtain','merlin','spellbook','team-data','team-ai','team-unification','team-care','parallel','know','vote-1','vote-2','vote-3','challenge','hotseat','showdown','finale') then
      raise exception 'bad section';
    end if;
    v_state := jsonb_set(v_state, '{section}', to_jsonb(p_action->>'section'));

  elsif v_type = 'question' then
    if (p_action->>'question') not in ('q1','q2','q3','q4') or (p_action->>'status') not in ('closed','open','revealed') then
      raise exception 'bad question';
    end if;
    v_state := jsonb_set(v_state, array['questions', p_action->>'question'], to_jsonb(p_action->>'status'));

  elsif v_type = 'finale' then
    if p_action ? 'started' then
      v_state := jsonb_set(v_state, '{finale,started}', to_jsonb((p_action->>'started')::boolean));
    end if;
    if p_action ? 'track' then
      if p_action->'track' = 'null'::jsonb then
        v_state := jsonb_set(v_state, '{finale,track}', 'null'::jsonb);
      elsif (p_action->>'track') in ('metal','country','electroswing') then
        v_state := jsonb_set(v_state, '{finale,track}', p_action->'track');
      else
        raise exception 'bad track';
      end if;
    end if;
    if p_action ? 'volume' then
      if (p_action->>'volume')::numeric < 0 or (p_action->>'volume')::numeric > 1 then
        raise exception 'bad volume';
      end if;
      v_state := jsonb_set(v_state, '{finale,volume}', p_action->'volume');
    end if;

  elsif v_type = 'track' then
    v_track := p_action->>'track';
    if v_track not in ('metal','country','electroswing') then raise exception 'bad track'; end if;
    if p_action ? 'audioUrl' then
      if p_action->'audioUrl' = 'null'::jsonb or p_action->>'audioUrl' = '' then
        v_state := jsonb_set(v_state, array['finale','tracks',v_track,'audioUrl'], 'null'::jsonb);
      elsif char_length(p_action->>'audioUrl') <= 2048 and (p_action->>'audioUrl') ~ '^(https://|/)' then
        v_state := jsonb_set(v_state, array['finale','tracks',v_track,'audioUrl'], p_action->'audioUrl');
      else
        raise exception 'bad audio url';
      end if;
    end if;
    if p_action ? 'lyrics' then
      if p_action->'lyrics' = 'null'::jsonb or p_action->>'lyrics' = '' then
        v_state := jsonb_set(v_state, array['finale','tracks',v_track,'lyrics'], 'null'::jsonb);
      elsif char_length(p_action->>'lyrics') <= 8000 then
        v_state := jsonb_set(v_state, array['finale','tracks',v_track,'lyrics'], p_action->'lyrics');
      else
        raise exception 'lyrics too long';
      end if;
    end if;

  elsif v_type = 'showdown' then
    if p_action ? 'announced' then
      v_state := jsonb_set(v_state, '{showdown,announced}', to_jsonb((p_action->>'announced')::boolean));
    end if;
    if p_action ? 'winner' then
      if p_action->'winner' = 'null'::jsonb then
        v_state := jsonb_set(v_state, '{showdown,winner}', 'null'::jsonb);
      elsif (p_action->>'winner') in ('metal','country','electroswing') then
        v_state := jsonb_set(v_state, '{showdown,winner}', p_action->'winner');
      else
        raise exception 'bad winner';
      end if;
    end if;

  elsif v_type = 'qa-select' then
    if p_action->'id' = 'null'::jsonb then
      v_state := jsonb_set(v_state, '{qa,selected}', 'null'::jsonb);
    else
      begin
        v_id := (p_action->>'id')::uuid;
      exception when others then
        v_id := null;
      end;
      -- Only a question that exists and is not hidden can reach the stage.
      if v_id is not null and exists (select 1 from passport_fairview3_qa where id = v_id and status <> 'hidden') then
        v_state := jsonb_set(v_state, '{qa,selected}', to_jsonb(v_id::text));
      end if;
    end if;

  elsif v_type = 'qa-moderate' then
    if (p_action->>'status') not in ('visible','answered','hidden') then raise exception 'bad status'; end if;
    v_id := (p_action->>'id')::uuid;
    update passport_fairview3_qa set status = p_action->>'status' where id = v_id;
    -- Answered or hidden questions leave the stage.
    if (p_action->>'status') <> 'visible' and v_state->'qa'->>'selected' = v_id::text then
      v_state := jsonb_set(v_state, '{qa,selected}', 'null'::jsonb);
    end if;

  elsif v_type = 'moderate' then
    if (p_action->>'status') not in ('pending','approved','hidden') then raise exception 'bad status'; end if;
    update passport_fairview3_feedback set status = p_action->>'status' where id = (p_action->>'id')::uuid;
    return true;

  elsif v_type = 'reset' then
    v_what := p_action->>'what';
    if v_what not in ('votes','feedback','qa','all') then raise exception 'bad reset'; end if;
    if v_what in ('votes','all') then
      delete from passport_fairview3_votes;
      v_state := jsonb_set(v_state, '{showdown}', '{"announced":false,"winner":null}'::jsonb);
    end if;
    if v_what in ('feedback','all') then delete from passport_fairview3_feedback; end if;
    if v_what in ('qa','all') then
      delete from passport_fairview3_qa;
      v_state := jsonb_set(v_state, '{qa,selected}', 'null'::jsonb);
    end if;
    if v_what = 'all' then
      delete from passport_fairview3_participants;
      v_state := v_default;
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
    ),
    'qa', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'participant_id', t.participant_id, 'name', t.name, 'body', t.body,
        'status', t.status, 'votes', t.votes, 'at', t.at)
        order by (t.status = 'answered'), t.votes desc, t.at), '[]'::jsonb)
      from (
        select q.*, (select count(*) from passport_fairview3_qa_votes v where v.question_id = q.id) as votes
          from passport_fairview3_qa q
      ) t
    )
  ) else null end;
$$;

-- ------------------------------------------------------------------ grants

GRANT EXECUTE ON FUNCTION public.fairview3_snapshot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_vote(uuid, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_qa_ask(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_qa_upvote(uuid, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_presenter(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fairview3_inbox(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
