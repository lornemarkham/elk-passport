-- ============================================================================
-- MIGRATION — passport_insiders (Local Insider Network: /local, /ambassadors)
-- Written 2026-11-09 for the owner brief "P0: Local Insider Network" (ADR 018).
-- Additive and independent: it touches no existing table or function.
--
-- WHAT THIS IS
--
-- The network (listings locals sent in, the review trail, ambassadors) is one
-- JSON document with a version number. The app writes it only if its version
-- is still the one it read (compare-and-swap), the CourtQueue pattern of
-- ADR 017 in its own table. See src/lib/insiders/store.ts.
--
-- SECURITY MODEL
--
--   * The document holds submitters' and ambassadors' email addresses. The
--     anon key is public, so the tables grant nobody anything and have RLS on
--     with no policies: no API role can select or change a row directly.
--   * The only way in is SECURITY DEFINER functions that require the server's
--     key (derived from the server-only Atlas token, or INSIDERS_STORE_KEY;
--     never in the browser). Only its sha256 is stored.
--   * `passport_insiders_claim` records the key on first use, only when none
--     is recorded yet. If anyone else claimed first, the server's key will not
--     match, the app says "not ready", and nothing is written.
--
-- HOW TO APPLY
--
-- Through the release runner, or paste into the SQL editor of the Passport
-- project. No BEGIN/COMMIT: the runner applies each file in one transaction.
-- Every statement is guarded, so applying it twice changes nothing.
-- Production grants nothing by default, so every grant is explicit.
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_insider_docs (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 120),
  version bigint NOT NULL CHECK (version > 0),
  doc jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_insider_keys (
  id int PRIMARY KEY CHECK (id = 1),
  key_hash text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passport_insider_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_insider_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_insider_docs, public.passport_insider_keys
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.passport_insiders_check(p_key text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if p_key is null or char_length(p_key) < 24 or not exists (
    select 1 from passport_insider_keys
    where id = 1 and key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  ) then
    raise exception 'insiders key refused' using errcode = '28000';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.passport_insiders_claim(p_key text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  if p_key is null or char_length(p_key) < 24 then
    raise exception 'insiders key refused' using errcode = '28000';
  end if;
  insert into passport_insider_keys (id, key_hash)
  values (1, encode(sha256(convert_to(p_key, 'UTF8')), 'hex'))
  on conflict (id) do nothing;
  perform passport_insiders_check(p_key);
end $$;

CREATE OR REPLACE FUNCTION public.passport_insiders_get(p_key text, p_keys text[])
RETURNS TABLE (key text, version bigint, doc jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_insiders_check(p_key);
  if coalesce(array_length(p_keys, 1), 0) > 20 then
    raise exception 'too many keys' using errcode = '22023';
  end if;
  return query
    select d.key, d.version, d.doc from passport_insider_docs d
    where d.key = any(p_keys);
end $$;

CREATE OR REPLACE FUNCTION public.passport_insiders_put(
  p_key text, p_doc_key text, p_expected bigint, p_doc jsonb
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_insiders_check(p_key);
  if p_doc is null or pg_column_size(p_doc) > 4000000 then
    raise exception 'document too large' using errcode = '22023';
  end if;
  if p_expected = 0 then
    insert into passport_insider_docs (key, version, doc)
    values (p_doc_key, 1, p_doc)
    on conflict (key) do nothing;
    return found;
  end if;
  update passport_insider_docs
     set doc = p_doc, version = version + 1, updated_at = now()
   where key = p_doc_key and version = p_expected;
  return found;
end $$;

REVOKE ALL ON FUNCTION public.passport_insiders_check(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.passport_insiders_claim(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_insiders_get(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_insiders_put(text, text, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passport_insiders_claim(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_insiders_get(text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_insiders_put(text, text, bigint, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
