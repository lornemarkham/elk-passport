-- PROPOSED, NOT APPLIED. Deliberately outside supabase/migrations/, which is a
-- shared contract. See ROADMAP.md decision D3 and ARCHITECTURE.md §7.
--
-- A durable ConferenceStore (src/lib/conference/store.ts). Access is
-- server-side only. Memberships are keyed on the foundation's IdentityKey
-- ("user:<uuid>" or "guest:<uuid>"), and guests are not auth.users, so RLS is
-- enabled with NO policies: anon and authenticated roles can read nothing,
-- and the server needs a privileged key. That is an exception to
-- createSupabaseServerClient's anon-only rule, and a human has to approve it.

CREATE TABLE IF NOT EXISTS public.passport_conferences (
  id            text PRIMARY KEY,                 -- random, unguessable
  details       jsonb NOT NULL,                   -- ConferenceDetails, validated by details.ts
  access_code   text UNIQUE,                      -- normalised (no dashes), NULL = codes off
  retain_until  timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_conference_members (
  conference_id text NOT NULL REFERENCES public.passport_conferences(id) ON DELETE CASCADE,
  member_id     text NOT NULL,                    -- the only id browsers and modules see
  identity      text NOT NULL CHECK (identity ~ '^(user|guest):'),
  role          text NOT NULL CHECK (role IN ('organiser', 'member')),
  display_name  text CHECK (char_length(display_name) <= 40),
  visibility    text NOT NULL DEFAULT 'hidden' CHECK (visibility IN ('hidden', 'members')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  via           text NOT NULL CHECK (via IN ('created', 'code', 'link')),
  PRIMARY KEY (conference_id, member_id),
  UNIQUE (conference_id, identity),
  CHECK (visibility <> 'members' OR display_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS passport_conference_members_identity
  ON public.passport_conference_members (identity);

CREATE TABLE IF NOT EXISTS public.passport_conference_invites (
  token         text PRIMARY KEY,                 -- 32 random bytes, base64url
  conference_id text NOT NULL REFERENCES public.passport_conferences(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  max_uses      integer CHECK (max_uses IS NULL OR max_uses >= 1),
  uses          integer NOT NULL DEFAULT 0
);

ALTER TABLE public.passport_conferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_invites ENABLE ROW LEVEL SECURITY;

-- Expiry is enforced by the service on every read (purge). With pg_cron, a
-- belt for those braces:
--   SELECT cron.schedule('conference-expiry', '0 * * * *',
--     $$DELETE FROM public.passport_conferences WHERE now() >= retain_until$$);
-- Module tables must cascade from passport_conferences or register a
-- ConferenceLifecycle; preferably both.
