-- People's Pulse, Quick Ideas (mission 908): one engine, more ways to ask.
--
-- Should I Do It?, Settle This, Is This Normal? and Rank These are all
-- People's Pulses with a `kind` in their JSON (no schema change for that).
-- A vote may now also carry three optional things, and visitors' actions are
-- counted per day for aggregate usage. Same model as 20261118000000: tables
-- closed to every API role, reached only through SECURITY DEFINER functions
-- that check the server's key.
--
-- WHAT IS ADDED, AND WHAT IS NOT
--
--   * Three nullable vote columns: a written reason (Should I Do It?, at
--     most 280 characters, shown anonymously with its answer), a ranking
--     (Rank These: answer numbers in order, "3142"), and a comparison group
--     (Is This Normal?: "g2"). Is This Normal? stores a range the voter
--     picked, never a raw number.
--   * `passport_pulse_events`: (day, event, kind) → count. Shares, results
--     cards made, shared links opened. No device, no address, no Pulse id.
--   * `passport_pulse_usage` returns counts only. It reads voter hashes to
--     count distinct and returning browsers but never returns one.
--   * `passport_pulse_list` is replaced (same signature) so Pulses created
--     "by link only" (`data.unlisted`) never appear on the public shelves.
--
-- V1's `passport_pulse_vote` and `passport_pulse_votes` are untouched; the
-- app falls back to them for plain votes until this file is applied.
--
-- HOW TO APPLY
--
-- After 20261118000000 (and 20261118120000), through the release runner or
-- the SQL editor of the Passport project. No BEGIN/COMMIT. Every statement is
-- guarded, so applying it twice changes nothing. Production grants nothing by
-- default, so every grant is explicit.
-- Rollback: docs/product/pulse/QUICK-IDEAS.md, "Rollback".

ALTER TABLE public.passport_pulse_votes
  ADD COLUMN IF NOT EXISTS reason text CHECK (reason IS NULL OR char_length(reason) <= 280),
  ADD COLUMN IF NOT EXISTS ranking text CHECK (ranking IS NULL OR ranking ~ '^[1-6]{2,6}$'),
  ADD COLUMN IF NOT EXISTS grp text CHECK (grp IS NULL OR grp ~ '^g[1-6]$');

CREATE TABLE IF NOT EXISTS public.passport_pulse_events (
  day date NOT NULL,
  event text NOT NULL CHECK (event IN ('share', 'card', 'link-open', 'circle-ask')),
  kind text NOT NULL CHECK (kind IN ('pulse', 'decide', 'settle', 'normal', 'rank')),
  n int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, kind)
);
ALTER TABLE public.passport_pulse_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_pulse_events FROM PUBLIC, anon, authenticated;

-- V1's vote, plus the three optional parts. Same rules, same order.
CREATE OR REPLACE FUNCTION public.passport_pulse_cast(
  p_key text, p_pulse text, p_voter text, p_net text, p_option text,
  p_circle text, p_via text, p_province text, p_city text, p_net_cap int,
  p_reason text, p_ranking text, p_group text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare p passport_pulses%rowtype; from_net int;
begin
  perform passport_pulse_check(p_key);
  select * into p from passport_pulses where id = p_pulse;
  if not found or p.status = 'removed' then return 'missing'; end if;
  if p.status <> 'live' or (p.expires_at is not null and p.expires_at <= now()) then
    return 'closed';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p.data -> 'options') o where o ->> 'id' = p_option
  ) then
    return 'bad-option';
  end if;
  if p_ranking is not null and (
    p_ranking !~ '^[1-6]{2,6}$'
    or char_length(p_ranking) <> jsonb_array_length(p.data -> 'options')
  ) then
    return 'bad-option';
  end if;
  if p_group is not null and not exists (
    select 1 from jsonb_array_elements(coalesce(p.data -> 'group' -> 'options', '[]'::jsonb)) g
     where g ->> 'id' = p_group
  ) then
    return 'bad-option';
  end if;
  if exists (select 1 from passport_pulse_votes where pulse_id = p_pulse and voter = p_voter) then
    return 'duplicate';
  end if;
  perform pg_advisory_xact_lock(hashtext('pulse-vote:' || p_pulse || ':' || p_net));
  select count(*) into from_net from passport_pulse_votes
   where pulse_id = p_pulse and net = p_net;
  if from_net >= p_net_cap then return 'limited'; end if;
  insert into passport_pulse_votes
    (pulse_id, voter, net, option_id, circle, via, province, city, reason, ranking, grp)
  values
    (p_pulse, p_voter, p_net, p_option, p_circle, p_via, p_province, p_city,
     nullif(p_reason, ''), p_ranking, p_group)
  on conflict (pulse_id, voter) do nothing;
  if not found then return 'duplicate'; end if;
  return 'ok';
end $$;

-- Anonymous rows with the optional parts: never the voter or network hash.
CREATE OR REPLACE FUNCTION public.passport_pulse_rows(p_key text, p_pulse text)
RETURNS TABLE (option text, province text, city text, at timestamptz, circle text, via text,
               reason text, ranking text, "group" text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select v.option_id, v.province, v.city, v.created_at, v.circle, v.via,
                      v.reason, v.ranking, v.grp
    from passport_pulse_votes v where v.pulse_id = p_pulse
    order by v.created_at limit 50000;
end $$;

-- V1's shelves, without Pulses shared by link only.
CREATE OR REPLACE FUNCTION public.passport_pulse_list(p_key text, p_limit int)
RETURNS TABLE (id text, status text, data jsonb, expires_at timestamptz,
               created_at timestamptz, total bigint, last_day bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query
    select p.id, p.status, p.data, p.expires_at, p.created_at,
           (select count(*) from passport_pulse_votes v where v.pulse_id = p.id),
           (select count(*) from passport_pulse_votes v
             where v.pulse_id = p.id and v.created_at >= now() - interval '1 day')
      from passport_pulses p
     where p.status = 'live' and p.created_at >= now() - interval '60 days'
       and coalesce((p.data ->> 'unlisted')::boolean, false) = false
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 200);
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_count(p_key text, p_event text, p_kind text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  insert into passport_pulse_events (day, event, kind, n)
  values ((now() at time zone 'UTC')::date, p_event, p_kind, 1)
  on conflict (day, event, kind) do update set n = passport_pulse_events.n + 1;
end $$;

-- Counts for the last p_days UTC days. Nothing that names a browser leaves.
CREATE OR REPLACE FUNCTION public.passport_pulse_usage(p_key text, p_days int)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare since date := (now() at time zone 'UTC')::date - (least(greatest(p_days, 1), 90) - 1);
begin
  perform passport_pulse_check(p_key);
  return jsonb_build_object(
    'pulses', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select (p.created_at at time zone 'UTC')::date as day,
               coalesce(p.data ->> 'kind', 'pulse') as kind,
               p.data ->> 'template' as template,
               count(*) as n
          from passport_pulses p
         where (p.created_at at time zone 'UTC')::date >= since
         group by 1, 2, 3) x),
    'votes', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select (v.created_at at time zone 'UTC')::date as day,
               coalesce(p.data ->> 'kind', 'pulse') as kind,
               count(*) as n,
               count(*) filter (where v.via is not null) as referred
          from passport_pulse_votes v join passport_pulses p on p.id = v.pulse_id
         where (v.created_at at time zone 'UTC')::date >= since
         group by 1, 2) x),
    'events', (
      select coalesce(jsonb_agg(e), '[]'::jsonb) from (
        select day, event, sum(n) as n from passport_pulse_events
         where day >= since group by 1, 2) e),
    'voters', (
      select count(distinct voter) from passport_pulse_votes
       where (created_at at time zone 'UTC')::date >= since),
    'returning', (
      select count(*) from (
        select voter from passport_pulse_votes
         where (created_at at time zone 'UTC')::date >= since
         group by voter
        having count(distinct (created_at at time zone 'UTC')::date) >= 2) r)
  );
end $$;

REVOKE ALL ON FUNCTION public.passport_pulse_cast(text, text, text, text, text, text, text, text, text, int, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_rows(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_list(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_count(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_usage(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passport_pulse_cast(text, text, text, text, text, text, text, text, text, int, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_rows(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_list(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_count(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_usage(text, int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
