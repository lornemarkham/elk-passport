-- ============================================================================
-- MIGRATION — passport_pulse_check (Pulse Check, /check)
-- Written 2026-11-18 for the owner brief "P0 — PEOPLE'S PULSE: PULSE CHECK".
-- Additive. Needs 20261118000000_passport_pulse.sql first (it calls
-- passport_pulse_check, passport_pulse_create and reads passport_pulses and
-- passport_pulse_votes). It changes no existing table or function.
--
-- WHAT THIS IS
--
-- A Pulse Check is a public claim, the sources a server opened for it, the
-- asker's assessment, and an ordinary Pulse (data.kind = 'check') as its
-- community poll. Votes stay in passport_pulse_votes. This file adds:
--
--   * passport_pulse_checks: the investigation as JSON (claim, the asker's
--     explanation, sources with verbatim excerpts, assessment, corrections),
--     a version for safe edits, and the creator's one-way device hash.
--   * passport_pulse_check_files: an optional screenshot or photo. PRIVATE:
--     only the creator (by device hash, checked in the app) and moderators
--     can read it. It is never on the public page or in a link preview.
--   * passport_pulse_posts: the discussion — experiences, questions,
--     opinions, suggested sources — with an author device hash (for "mine"
--     and limits) and a network hash of the day (limits), never shown.
--   * passport_pulse_post_reports: one per reporter per post; three hide it.
--   * passport_pulse_check_events: (day, event, source) → count. Visits by
--     kind of referring site and shares by channel. Counts only: no row is
--     about a person, a device or a check.
--
-- WHAT IS NOT STORED: names, emails, accounts, raw IP addresses, user
-- agents, referrer URLs (only a category such as 'facebook'), or anything
-- read from a screenshot.
--
-- SECURITY MODEL (ADR 017 / ADR 021): RLS on, no policies, every grant
-- revoked; SECURITY DEFINER functions requiring the server's key.
--
-- HOW TO APPLY: release runner, or paste into the SQL editor of the Passport
-- project after the earlier passport_pulse migrations. No BEGIN/COMMIT.
-- Guarded: applying it twice changes nothing. Every grant is explicit.
-- Rollback: docs/product/pulse/PULSE-CHECK.md, "Rollback".
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_pulse_checks (
  pulse_id text PRIMARY KEY REFERENCES public.passport_pulses(id),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{8,80}$'),
  data jsonb NOT NULL CHECK (pg_column_size(data) < 150000),
  version int NOT NULL DEFAULT 1,
  creator text NOT NULL CHECK (char_length(creator) <= 64),
  fingerprint text NOT NULL CHECK (char_length(fingerprint) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_pulse_checks_created_idx
  ON public.passport_pulse_checks (created_at DESC);

CREATE TABLE IF NOT EXISTS public.passport_pulse_check_files (
  pulse_id text PRIMARY KEY REFERENCES public.passport_pulse_checks(pulse_id),
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes bytea NOT NULL CHECK (octet_length(bytes) <= 1500000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_pulse_posts (
  id text PRIMARY KEY CHECK (id ~ '^[a-z2-9]{8}$'),
  pulse_id text NOT NULL REFERENCES public.passport_pulse_checks(pulse_id),
  type text NOT NULL CHECK (type IN ('experience', 'question', 'comment', 'source')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 1000),
  url text CHECK (url IS NULL OR char_length(url) <= 500),
  author text NOT NULL CHECK (char_length(author) <= 64),
  net text NOT NULL CHECK (char_length(net) <= 64),
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_pulse_posts_pulse_idx
  ON public.passport_pulse_posts (pulse_id, created_at);
CREATE INDEX IF NOT EXISTS passport_pulse_posts_net_idx
  ON public.passport_pulse_posts (net, created_at);

CREATE TABLE IF NOT EXISTS public.passport_pulse_post_reports (
  post_id text NOT NULL REFERENCES public.passport_pulse_posts(id),
  reporter text NOT NULL CHECK (char_length(reporter) <= 64),
  reason text NOT NULL CHECK (reason IN ('misleading', 'harassment', 'personal', 'spam', 'hateful', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, reporter)
);

CREATE TABLE IF NOT EXISTS public.passport_pulse_check_events (
  day date NOT NULL,
  event text NOT NULL CHECK (event IN ('visit', 'share')),
  source text NOT NULL CHECK (source IN (
    'facebook', 'instagram', 'x', 'reddit', 'tiktok', 'messaging', 'email',
    'search', 'pulse', 'other', 'direct',
    'copy-link', 'copy-comment', 'native', 'whatsapp', 'sms')),
  n int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, source)
);

ALTER TABLE public.passport_pulse_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pulse_check_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pulse_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pulse_post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pulse_check_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_pulse_checks, public.passport_pulse_check_files,
  public.passport_pulse_posts, public.passport_pulse_post_reports,
  public.passport_pulse_check_events
  FROM PUBLIC, anon, authenticated;

-- The Pulse, its check and its file in one transaction, under V1's daily limit.
CREATE OR REPLACE FUNCTION public.passport_pulse_check_create(
  p_key text, p_id text, p_data jsonb, p_expires_at timestamptz,
  p_creator text, p_net text, p_max_per_day int,
  p_slug text, p_check jsonb, p_fingerprint text, p_file_mime text, p_file text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare outcome text;
begin
  perform passport_pulse_check(p_key);
  if coalesce(p_data ->> 'kind', '') <> 'check' then
    raise exception 'a check''s Pulse has kind check' using errcode = '22023';
  end if;
  outcome := passport_pulse_create(p_key, p_id, p_data, p_expires_at, p_creator, p_net, p_max_per_day);
  if outcome <> 'ok' then return outcome; end if;
  insert into passport_pulse_checks (pulse_id, slug, data, creator, fingerprint)
  values (p_id, p_slug, p_check, p_creator, p_fingerprint);
  if p_file is not null then
    insert into passport_pulse_check_files (pulse_id, mime, bytes)
    values (p_id, p_file_mime, decode(p_file, 'base64'));
  end if;
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_check_get(p_key text, p_id text)
RETURNS TABLE (data jsonb, version int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select c.data, c.version from passport_pulse_checks c where c.pulse_id = p_id;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_check_is_creator(p_key text, p_id text, p_creator text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return exists (select 1 from passport_pulse_checks where pulse_id = p_id and creator = p_creator);
end $$;

-- A correction replaces the JSON only from the version it was read at, and
-- only for the creator or a moderator (the server decides which it is).
CREATE OR REPLACE FUNCTION public.passport_pulse_check_update(
  p_key text, p_id text, p_data jsonb, p_version int, p_creator text, p_moderator boolean
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare row_creator text; row_version int;
begin
  perform passport_pulse_check(p_key);
  select creator, version into row_creator, row_version
    from passport_pulse_checks where pulse_id = p_id for update;
  if not found then return 'missing'; end if;
  if not coalesce(p_moderator, false) and row_creator is distinct from p_creator then
    return 'forbidden';
  end if;
  if row_version <> p_version then return 'conflict'; end if;
  update passport_pulse_checks
     set data = p_data, version = version + 1, updated_at = now()
   where pulse_id = p_id;
  return 'ok';
end $$;

-- The private file. The app serves it only to its creator or a moderator.
CREATE OR REPLACE FUNCTION public.passport_pulse_check_file(p_key text, p_id text)
RETURNS TABLE (mime text, b64 text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select f.mime, encode(f.bytes, 'base64') from passport_pulse_check_files f
   where f.pulse_id = p_id;
end $$;

-- The discovery shelves: summaries and counts only, never the whole JSON.
CREATE OR REPLACE FUNCTION public.passport_pulse_check_list(p_key text, p_limit int)
RETURNS TABLE (pulse_id text, slug text, status text, claim text, assessment text, ask text,
               scope jsonb, sources int, corrections int, created_at timestamptz,
               updated_at timestamptz, votes bigint, votes_last_day bigint,
               posts bigint, posts_last_day bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query
    select c.pulse_id, c.slug, p.status, c.data -> 'claim' ->> 'text', c.data ->> 'assessment',
           c.data ->> 'ask', p.data -> 'scope',
           coalesce(jsonb_array_length(c.data -> 'sources'), 0),
           coalesce(jsonb_array_length(c.data -> 'corrections'), 0),
           c.created_at, c.updated_at,
           (select count(*) from passport_pulse_votes v where v.pulse_id = c.pulse_id),
           (select count(*) from passport_pulse_votes v
             where v.pulse_id = c.pulse_id and v.created_at >= now() - interval '1 day'),
           (select count(*) from passport_pulse_posts x where x.pulse_id = c.pulse_id and x.status = 'live'),
           (select count(*) from passport_pulse_posts x where x.pulse_id = c.pulse_id and x.status = 'live'
               and x.created_at >= now() - interval '1 day')
      from passport_pulse_checks c join passport_pulses p on p.id = c.pulse_id
     where p.status = 'live' and c.created_at >= now() - interval '90 days'
     order by c.created_at desc
     limit least(greatest(p_limit, 1), 200);
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_post_add(
  p_key text, p_id text, p_pulse text, p_type text, p_body text, p_url text,
  p_author text, p_net text, p_per_pulse int, p_per_net int
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare since timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  perform passport_pulse_check(p_key);
  if not exists (
    select 1 from passport_pulse_checks c join passport_pulses p on p.id = c.pulse_id
     where c.pulse_id = p_pulse and p.status = 'live'
  ) then return 'missing'; end if;
  perform pg_advisory_xact_lock(hashtext('pulse-post:' || p_net));
  if (select count(*) from passport_pulse_posts
       where pulse_id = p_pulse and author = p_author and created_at >= since) >= p_per_pulse
     or (select count(*) from passport_pulse_posts
       where net = p_net and created_at >= since) >= p_per_net then
    return 'limited';
  end if;
  insert into passport_pulse_posts (id, pulse_id, type, body, url, author, net)
  values (p_id, p_pulse, p_type, p_body, p_url, p_author, p_net)
  on conflict (id) do nothing;
  if not found then return 'taken'; end if;
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_posts(p_key text, p_pulse text, p_author text)
RETURNS TABLE (id text, type text, body text, url text, at timestamptz, mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select x.id, x.type, x.body, x.url, x.created_at,
                      (p_author is not null and x.author = p_author)
    from passport_pulse_posts x where x.pulse_id = p_pulse and x.status = 'live'
    order by x.created_at limit 500;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_post_report(
  p_key text, p_post text, p_reporter text, p_reason text, p_threshold int
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare n int;
begin
  perform passport_pulse_check(p_key);
  if not exists (select 1 from passport_pulse_posts where id = p_post and status <> 'removed') then
    return 'missing';
  end if;
  insert into passport_pulse_post_reports (post_id, reporter, reason)
  values (p_post, p_reporter, p_reason)
  on conflict (post_id, reporter) do nothing;
  if not found then return 'duplicate'; end if;
  select count(*) into n from passport_pulse_post_reports where post_id = p_post;
  if n >= p_threshold then
    update passport_pulse_posts set status = 'hidden' where id = p_post and status = 'live';
  end if;
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_posts_reported(p_key text)
RETURNS TABLE (id text, pulse_id text, type text, body text, url text, at timestamptz,
               status text, reports bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select x.id, x.pulse_id, x.type, x.body, x.url, x.created_at, x.status,
                      (select count(*) from passport_pulse_post_reports r where r.post_id = x.id)
    from passport_pulse_posts x
   where x.status <> 'live' or exists (select 1 from passport_pulse_post_reports r where r.post_id = x.id)
   order by x.created_at desc limit 200;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_post_set_status(p_key text, p_post text, p_status text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  if p_status not in ('live', 'hidden', 'removed') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  update passport_pulse_posts set status = p_status where id = p_post;
  return found;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_check_count(p_key text, p_event text, p_source text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  insert into passport_pulse_check_events (day, event, source, n)
  values ((now() at time zone 'UTC')::date, p_event, p_source, 1)
  on conflict (day, event, source) do update set n = passport_pulse_check_events.n + 1;
end $$;

CREATE OR REPLACE FUNCTION public.passport_pulse_check_usage(p_key text, p_days int)
RETURNS TABLE (day date, event text, source text, n int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query select e.day, e.event, e.source, e.n from passport_pulse_check_events e
   where e.day >= (now() at time zone 'UTC')::date - (least(greatest(p_days, 1), 90) - 1)
   order by e.day desc;
end $$;

REVOKE ALL ON FUNCTION public.passport_pulse_check_create(text, text, jsonb, timestamptz, text, text, int, text, jsonb, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_check_get(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_check_is_creator(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_check_update(text, text, jsonb, int, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_check_file(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_check_list(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_post_add(text, text, text, text, text, text, text, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_posts(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_post_report(text, text, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_posts_reported(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_post_set_status(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_check_count(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_check_usage(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_create(text, text, jsonb, timestamptz, text, text, int, text, jsonb, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_get(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_is_creator(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_update(text, text, jsonb, int, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_file(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_list(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_post_add(text, text, text, text, text, text, text, text, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_posts(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_post_report(text, text, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_posts_reported(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_post_set_status(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_count(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_check_usage(text, int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
