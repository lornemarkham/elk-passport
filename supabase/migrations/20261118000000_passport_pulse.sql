-- ============================================================================
-- MIGRATION — passport_pulse (People's Pulse, /labs/pulse)
-- Written 2026-11-18 for the owner brief "P0 — BUILD PEOPLE'S PULSE".
-- Additive and independent: it touches no existing table or function.
--
-- WHAT THIS IS
--
-- Visitors ask a question (a "Pulse"), anyone votes without an account, and
-- results are shown with privacy rules applied in the app
-- (src/lib/pulse/results.ts). Four tables: the key, Pulses, votes, reports.
--
-- WHAT IS STORED, AND WHAT IS NOT
--
--   * A Pulse: its question, answers, optional claim and source, scope, end
--     date, and two one-way hashes (creator device, network-of-the-day) used
--     only for the daily creation limit.
--   * A vote: the answer, the voter's self-reported province/city if given,
--     the time, two referral codes, and two one-way keyed hashes — the device
--     (one vote per browser) and the network address of that UTC day (a cap
--     per Pulse). No name, email, account, raw IP or user agent.
--   * A report: reason, optional note, a one-way hash of the reporter device.
--
-- SECURITY MODEL (same as CourtQueue, ADR 017)
--
--   * No API role can select or change a row: RLS on, no policies, every
--     grant revoked. The only way in is SECURITY DEFINER functions requiring
--     the server's key (env PULSE_STORE_KEY, or one derived from the Atlas
--     service token; never in the browser). Only its sha256 is stored.
--   * `passport_pulse_claim` records the key on first use, only when none is
--     recorded yet. If anyone else claimed first, the server's key will not
--     match, the app reports "not ready", and nothing is written.
--   * `passport_pulse_votes` never leaves with the voter or network hash:
--     the votes function returns the answer, place, time and codes only.
--
-- HOW TO APPLY
--
-- Through the release runner, or paste into the SQL editor of the Passport
-- project. No BEGIN/COMMIT: the runner applies each file in one transaction.
-- Every statement is guarded, so applying it twice changes nothing.
-- Production grants nothing by default, so every grant is explicit.
-- Rollback: docs/product/pulse/PEOPLES-PULSE.md, "Rollback" (kept out of this
-- file so the release runner's line scan sees no destructive SQL).
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_pulse_keys (
  id int PRIMARY KEY CHECK (id = 1),
  key_hash text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_pulses (
  id text PRIMARY KEY CHECK (id ~ '^[a-z2-9]{8}$'),
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'review', 'removed')),
  data jsonb NOT NULL CHECK (pg_column_size(data) < 20000),
  expires_at timestamptz,
  creator text NOT NULL CHECK (char_length(creator) <= 64),
  net text NOT NULL CHECK (char_length(net) <= 64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_pulses_created_idx
  ON public.passport_pulses (created_at DESC);

CREATE TABLE IF NOT EXISTS public.passport_pulse_votes (
  pulse_id text NOT NULL REFERENCES public.passport_pulses(id),
  voter text NOT NULL CHECK (char_length(voter) <= 64),
  net text NOT NULL CHECK (char_length(net) <= 64),
  option_id text NOT NULL CHECK (char_length(option_id) <= 8),
  circle text NOT NULL CHECK (circle ~ '^[a-z2-9]{8}$'),
  via text CHECK (via IS NULL OR via ~ '^[a-z2-9]{8}$'),
  province text CHECK (province IS NULL OR char_length(province) = 2),
  city text CHECK (city IS NULL OR char_length(city) <= 60),
  -- Every place is self-reported today; the column leaves room for a
  -- verified source without pretending to have one.
  geo_source text NOT NULL DEFAULT 'self' CHECK (geo_source IN ('self')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pulse_id, voter)
);
CREATE INDEX IF NOT EXISTS passport_pulse_votes_net_idx
  ON public.passport_pulse_votes (pulse_id, net);
CREATE INDEX IF NOT EXISTS passport_pulse_votes_time_idx
  ON public.passport_pulse_votes (pulse_id, created_at);

CREATE TABLE IF NOT EXISTS public.passport_pulse_reports (
  pulse_id text NOT NULL REFERENCES public.passport_pulses(id),
  reporter text NOT NULL CHECK (char_length(reporter) <= 64),
  reason text NOT NULL CHECK (reason IN ('misleading', 'harassment', 'personal', 'spam', 'hateful', 'other')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pulse_id, reporter)
);

ALTER TABLE public.passport_pulse_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pulses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pulse_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pulse_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_pulse_keys, public.passport_pulses,
  public.passport_pulse_votes, public.passport_pulse_reports
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.passport_pulse_check(p_key text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if p_key is null or char_length(p_key) < 24 or not exists (
    select 1 from passport_pulse_keys
    where id = 1 and key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  ) then
    raise exception 'pulse key refused' using errcode = '28000';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_claim(p_key text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  if p_key is null or char_length(p_key) < 24 then
    raise exception 'pulse key refused' using errcode = '28000';
  end if;
  insert into passport_pulse_keys (id, key_hash)
  values (1, encode(sha256(convert_to(p_key, 'UTF8')), 'hex'))
  on conflict (id) do nothing;
  perform passport_pulse_check(p_key);
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_create(
  p_key text, p_id text, p_data jsonb, p_expires_at timestamptz,
  p_creator text, p_net text, p_max_per_day int
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare made int;
begin
  perform passport_pulse_check(p_key);
  -- One creator (or one network) at a time, so the count below is exact.
  perform pg_advisory_xact_lock(hashtext('pulse-create:' || p_net));
  select count(*) into made from passport_pulses
   where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
     and (creator = p_creator or net = p_net);
  if made >= p_max_per_day then return 'limited'; end if;
  insert into passport_pulses (id, data, expires_at, creator, net)
  values (p_id, p_data, p_expires_at, p_creator, p_net)
  on conflict (id) do nothing;
  if not found then return 'taken'; end if;
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_get(p_key text, p_id text)
RETURNS TABLE (id text, status text, data jsonb, expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select p.id, p.status, p.data, p.expires_at, p.created_at
    from passport_pulses p where p.id = p_id;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_vote(
  p_key text, p_pulse text, p_voter text, p_net text, p_option text,
  p_circle text, p_via text, p_province text, p_city text, p_net_cap int
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
  if exists (select 1 from passport_pulse_votes where pulse_id = p_pulse and voter = p_voter) then
    return 'duplicate';
  end if;
  -- Serialise one network's votes on one Pulse so the cap cannot be raced.
  perform pg_advisory_xact_lock(hashtext('pulse-vote:' || p_pulse || ':' || p_net));
  select count(*) into from_net from passport_pulse_votes
   where pulse_id = p_pulse and net = p_net;
  if from_net >= p_net_cap then return 'limited'; end if;
  insert into passport_pulse_votes (pulse_id, voter, net, option_id, circle, via, province, city)
  values (p_pulse, p_voter, p_net, p_option, p_circle, p_via, p_province, p_city)
  on conflict (pulse_id, voter) do nothing;
  if not found then return 'duplicate'; end if;
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_mine(p_key text, p_pulse text, p_voter text)
RETURNS TABLE (option text, at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select v.option_id, v.created_at from passport_pulse_votes v
    where v.pulse_id = p_pulse and v.voter = p_voter;
end $$;

-- Anonymous rows: never the voter or network hash.
CREATE OR REPLACE FUNCTION public.passport_pulse_votes(p_key text, p_pulse text)
RETURNS TABLE (option text, province text, city text, at timestamptz, circle text, via text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select v.option_id, v.province, v.city, v.created_at, v.circle, v.via
    from passport_pulse_votes v where v.pulse_id = p_pulse
    order by v.created_at limit 50000;
end $$;

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
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 200);
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_report(
  p_key text, p_pulse text, p_reporter text, p_reason text, p_note text, p_threshold int
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare n int;
begin
  perform passport_pulse_check(p_key);
  if not exists (select 1 from passport_pulses where id = p_pulse and status <> 'removed') then
    return 'missing';
  end if;
  insert into passport_pulse_reports (pulse_id, reporter, reason, note)
  values (p_pulse, p_reporter, p_reason, p_note)
  on conflict (pulse_id, reporter) do nothing;
  if not found then return 'duplicate'; end if;
  select count(*) into n from passport_pulse_reports where pulse_id = p_pulse;
  if n >= p_threshold then
    update passport_pulses set status = 'review' where id = p_pulse and status = 'live';
  end if;
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_reported(p_key text)
RETURNS TABLE (id text, status text, data jsonb, expires_at timestamptz,
               created_at timestamptz, total bigint, reports jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query
    select p.id, p.status, p.data, p.expires_at, p.created_at,
           (select count(*) from passport_pulse_votes v where v.pulse_id = p.id),
           (select jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note, 'at', r.created_at)
                             order by r.created_at)
              from passport_pulse_reports r where r.pulse_id = p.id)
      from passport_pulses p
     where p.status <> 'live'
        or exists (select 1 from passport_pulse_reports r where r.pulse_id = p.id)
     order by p.created_at desc
     limit 200;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_set_status(p_key text, p_id text, p_status text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  if p_status not in ('live', 'review', 'removed') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  update passport_pulses set status = p_status where id = p_id;
  return found;
end $$;

REVOKE ALL ON FUNCTION public.passport_pulse_check(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.passport_pulse_claim(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_create(text, text, jsonb, timestamptz, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_get(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_vote(text, text, text, text, text, text, text, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_mine(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_votes(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_list(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_report(text, text, text, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_reported(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_set_status(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passport_pulse_claim(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_create(text, text, jsonb, timestamptz, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_get(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_vote(text, text, text, text, text, text, text, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_mine(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_votes(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_list(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_report(text, text, text, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_reported(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_set_status(text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
