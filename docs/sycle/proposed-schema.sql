-- PROPOSED, NOT APPLIED. Deliberately outside supabase/migrations/, which is a
-- shared contract; see docs/sycle/README.md "Before it can ship", decision 2.
--
-- A durable SycleStore for the Sycle arrival board. Access is server-side
-- only, keyed on the board's own participant id (not auth.users), so RLS is
-- enabled with NO policies: anon and authenticated roles can read nothing.
-- That means the server needs a privileged key, which is the exception to
-- createSupabaseServerClient's anon-only rule that a human has to approve.

CREATE TABLE IF NOT EXISTS public.sycle_participants (
  id           uuid PRIMARY KEY,               -- the signed-cookie identity
  board_id     text NOT NULL UNIQUE,           -- public handle on the board
  display_name text CHECK (char_length(display_name) <= 40),
  visibility   text NOT NULL DEFAULT 'off'
               CHECK (visibility IN ('named', 'anonymous', 'off')),
  flight_number text,
  flight_date  date,
  adventures   text[] NOT NULL DEFAULT '{}' CHECK (cardinality(adventures) <= 40),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((flight_number IS NULL) = (flight_date IS NULL)),
  CHECK (visibility <> 'named' OR display_name IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.sycle_flights (
  key        text PRIMARY KEY,                 -- "AC855|2026-10-20"
  record     jsonb NOT NULL,                   -- FlightRecord
  fetched_at timestamptz NOT NULL
);

ALTER TABLE public.sycle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sycle_flights ENABLE ROW LEVEL SECURITY;

-- Expiry is enforced by the application on every read (store.purge). If
-- pg_cron is available, this is a belt to go with those braces:
--   SELECT cron.schedule('sycle-expiry', '0 * * * *',
--     $$DELETE FROM public.sycle_participants WHERE now() >= '<SYCLE_DATA_EXPIRES_AT>'$$);
--   …and DROP both tables once the pilot is over.
