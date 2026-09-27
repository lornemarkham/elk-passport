-- Passport baseline — captured from the live database on 2026-09-27.
--
-- WHAT THIS IS
--
-- The Passport-owned half of the database, as it actually existed in the
-- `elk-atlas` Supabase project (ref frllwwxesxbmmaadzfaf, PostgreSQL 17.6) when
-- this file was written. It was produced with `supabase db dump --linked
-- --schema public` and then filtered to the objects Passport owns; every
-- table definition, check constraint, function body, policy expression and
-- grant below is the dump's own text. Nothing here was reconstructed from
-- documentation.
--
-- WHY IT IS IDEMPOTENT
--
-- These objects already exist in production, and this repository is not the
-- owner of that project's migration history — Atlas is (see supabase/README.md).
-- So every statement is guarded: run against the live project it changes
-- nothing, and run against an empty database it creates the contract in full.
--
-- WHAT IT IS NOT
--
-- Not Atlas's schema. `boards` and `board_items` live in the same Postgres
-- database and belong to Atlas; a board's contents are Atlas's to define, and
-- only the sharing layer around them is Passport's. Not data: no rows, no
-- secrets, no user records.
--
-- Two deliberate departures from the dump's literal text, both documented in
-- supabase/README.md: `passport_events.id` carries its identity clause inline
-- rather than as a following ALTER, and `ALTER ... OWNER TO "postgres"` lines
-- are omitted so the file can be applied by whatever role owns a fresh project.

-- ---------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS "public"."passport_board_invites" (
    "token" "text" NOT NULL,
    "board_id" "text" NOT NULL,
    "board_owner_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "passport_board_invites_role_check" CHECK (("role" = ANY (ARRAY['editor'::"text", 'viewer'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."passport_board_members" (
    "board_id" "text" NOT NULL,
    "board_owner_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "passport_board_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'editor'::"text", 'viewer'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."passport_events" (
    "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "actor_id" "uuid",
    "kind" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "passport_events_resource_type_check" CHECK (("resource_type" = 'board'::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."passport_movie_reactions" (
    "user_id" "uuid" NOT NULL,
    "film_id" "text" NOT NULL,
    "verdict" "text" NOT NULL,
    "felt" "text",
    "got_me" "text",
    "reacted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "passport_movie_reactions_felt_check" CHECK (("felt" = ANY (ARRAY['cozy'::"text", 'spooky'::"text", 'creepy'::"text", 'nightmare'::"text"]))),
    CONSTRAINT "passport_movie_reactions_verdict_check" CHECK (("verdict" = ANY (ARRAY['loved'::"text", 'good'::"text", 'meh'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."passport_october_things" (
    "user_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "entity_kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "starts_at" timestamp with time zone,
    "state" "text" DEFAULT 'ahead'::"text" NOT NULL,
    "wanted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lived_at" timestamp with time zone,
    CONSTRAINT "passport_october_things_entity_kind_check" CHECK (("entity_kind" = ANY (ARRAY['Place'::"text", 'Organization'::"text", 'Activity'::"text", 'Event'::"text", 'Movie'::"text"]))),
    CONSTRAINT "passport_october_things_lived_has_time" CHECK ((("state" <> 'lived'::"text") OR ("lived_at" IS NOT NULL))),
    CONSTRAINT "passport_october_things_state_check" CHECK (("state" = ANY (ARRAY['ahead'::"text", 'lived'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."passport_preferences" (
    "user_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "source" "text" DEFAULT 'explicit'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "passport_preferences_source_check" CHECK (("source" = 'explicit'::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."passport_profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "home_area" "text",
    "timezone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."passport_recently_viewed" (
    "user_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- ------------------------------------------- primary keys and foreign keys
--
-- Every `user_id` is `auth.users(id) ON DELETE CASCADE`: a deleted account
-- takes its own rows with it, and Passport keeps no shadow copy of a person.

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_board_invites_pkey' and conrelid = 'public.passport_board_invites'::regclass) then
    alter table "public"."passport_board_invites" add constraint "passport_board_invites_pkey" PRIMARY KEY ("token");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_board_invites_created_by_fkey' and conrelid = 'public.passport_board_invites'::regclass) then
    alter table "public"."passport_board_invites" add constraint "passport_board_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_board_members_pkey' and conrelid = 'public.passport_board_members'::regclass) then
    alter table "public"."passport_board_members" add constraint "passport_board_members_pkey" PRIMARY KEY ("board_id", "user_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_board_members_user_id_fkey' and conrelid = 'public.passport_board_members'::regclass) then
    alter table "public"."passport_board_members" add constraint "passport_board_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_events_pkey' and conrelid = 'public.passport_events'::regclass) then
    alter table "public"."passport_events" add constraint "passport_events_pkey" PRIMARY KEY ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_events_actor_id_fkey' and conrelid = 'public.passport_events'::regclass) then
    alter table "public"."passport_events" add constraint "passport_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_movie_reactions_pkey' and conrelid = 'public.passport_movie_reactions'::regclass) then
    alter table "public"."passport_movie_reactions" add constraint "passport_movie_reactions_pkey" PRIMARY KEY ("user_id", "film_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_movie_reactions_user_id_fkey' and conrelid = 'public.passport_movie_reactions'::regclass) then
    alter table "public"."passport_movie_reactions" add constraint "passport_movie_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_october_things_pkey' and conrelid = 'public.passport_october_things'::regclass) then
    alter table "public"."passport_october_things" add constraint "passport_october_things_pkey" PRIMARY KEY ("user_id", "entity_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_october_things_user_id_fkey' and conrelid = 'public.passport_october_things'::regclass) then
    alter table "public"."passport_october_things" add constraint "passport_october_things_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_preferences_pkey' and conrelid = 'public.passport_preferences'::regclass) then
    alter table "public"."passport_preferences" add constraint "passport_preferences_pkey" PRIMARY KEY ("user_id", "key");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_preferences_user_id_fkey' and conrelid = 'public.passport_preferences'::regclass) then
    alter table "public"."passport_preferences" add constraint "passport_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_profiles_pkey' and conrelid = 'public.passport_profiles'::regclass) then
    alter table "public"."passport_profiles" add constraint "passport_profiles_pkey" PRIMARY KEY ("user_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_profiles_user_id_fkey' and conrelid = 'public.passport_profiles'::regclass) then
    alter table "public"."passport_profiles" add constraint "passport_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_recently_viewed_pkey' and conrelid = 'public.passport_recently_viewed'::regclass) then
    alter table "public"."passport_recently_viewed" add constraint "passport_recently_viewed_pkey" PRIMARY KEY ("user_id", "entity_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'passport_recently_viewed_user_id_fkey' and conrelid = 'public.passport_recently_viewed'::regclass) then
    alter table "public"."passport_recently_viewed" add constraint "passport_recently_viewed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  end if;
end $$;

-- --------------------------------------------------------------- indexes

CREATE INDEX IF NOT EXISTS "passport_board_invites_by_board" ON "public"."passport_board_invites" USING "btree" ("board_id");
CREATE INDEX IF NOT EXISTS "passport_board_members_by_user" ON "public"."passport_board_members" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "passport_events_by_resource" ON "public"."passport_events" USING "btree" ("resource_type", "resource_id", "id" DESC);
CREATE INDEX IF NOT EXISTS "passport_movie_reactions_by_user" ON "public"."passport_movie_reactions" USING "btree" ("user_id", "reacted_at" DESC);
CREATE INDEX IF NOT EXISTS "passport_october_things_by_user_state" ON "public"."passport_october_things" USING "btree" ("user_id", "state");
CREATE INDEX IF NOT EXISTS "passport_recently_viewed_by_time" ON "public"."passport_recently_viewed" USING "btree" ("user_id", "viewed_at" DESC);

-- -------------------------------------------------------------- functions
--
-- All four are SECURITY DEFINER with `search_path = public`, because the
-- caller following an invite link is by definition not yet a member and so
-- cannot read the invite that would let them become one.

CREATE OR REPLACE FUNCTION "public"."passport_board_role"("p_board_id" "text", "p_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from passport_board_members
  where board_id = p_board_id and user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION "public"."passport_describe_board_invite"("p_token" "text") RETURNS TABLE("valid" boolean, "role" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    (i.revoked_at is null
      and (i.expires_at is null or i.expires_at >= now())) as valid,
    i.role
  from passport_board_invites i
  where i.token = p_token;
$$;

CREATE OR REPLACE FUNCTION "public"."passport_is_board_member"("p_board_id" "text", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from passport_board_members
    where board_id = p_board_id and user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION "public"."passport_redeem_board_invite"("p_token" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite passport_board_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;

  select * into v_invite
  from passport_board_invites
  where token = p_token;

  if not found
     or v_invite.revoked_at is not null
     or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    return null;
  end if;

  -- Already on the board: succeed and change nothing. Following a link twice,
  -- or one an owner sent to somebody who was already there, should land them on
  -- the board rather than reporting an error at them.
  insert into passport_board_members (board_id, board_owner_id, user_id, role)
  values (v_invite.board_id, v_invite.board_owner_id, auth.uid(), v_invite.role)
  on conflict (board_id, user_id) do nothing;

  return v_invite.board_id;
end;
$$;

-- ------------------------------------------------ row level security

ALTER TABLE "public"."passport_board_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passport_board_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passport_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passport_movie_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passport_october_things" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passport_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passport_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passport_recently_viewed" ENABLE ROW LEVEL SECURITY;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_board_invites' and policyname = 'passport_board_invites_members_read') then
    CREATE POLICY "passport_board_invites_members_read" ON "public"."passport_board_invites" FOR SELECT USING ("public"."passport_is_board_member"("board_id", "auth"."uid"()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_board_invites' and policyname = 'passport_board_invites_owner_writes') then
    CREATE POLICY "passport_board_invites_owner_writes" ON "public"."passport_board_invites" USING (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text")) WITH CHECK (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_board_members' and policyname = 'passport_board_members_owner_writes') then
    CREATE POLICY "passport_board_members_owner_writes" ON "public"."passport_board_members" USING (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text")) WITH CHECK (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_board_members' and policyname = 'passport_board_members_self_claim') then
    CREATE POLICY "passport_board_members_self_claim" ON "public"."passport_board_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'owner'::"text") AND ("board_owner_id" = "auth"."uid"())));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_board_members' and policyname = 'passport_board_members_visible') then
    CREATE POLICY "passport_board_members_visible" ON "public"."passport_board_members" FOR SELECT USING ("public"."passport_is_board_member"("board_id", "auth"."uid"()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_events' and policyname = 'passport_events_member_read') then
    CREATE POLICY "passport_events_member_read" ON "public"."passport_events" FOR SELECT USING ((("resource_type" = 'board'::"text") AND "public"."passport_is_board_member"("resource_id", "auth"."uid"())));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_events' and policyname = 'passport_events_member_write') then
    CREATE POLICY "passport_events_member_write" ON "public"."passport_events" FOR INSERT WITH CHECK ((("actor_id" = "auth"."uid"()) AND ("resource_type" = 'board'::"text") AND ("public"."passport_board_role"("resource_id", "auth"."uid"()) = ANY (ARRAY['owner'::"text", 'editor'::"text"]))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_movie_reactions' and policyname = 'passport_movie_reactions_own_all') then
    CREATE POLICY "passport_movie_reactions_own_all" ON "public"."passport_movie_reactions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_october_things' and policyname = 'passport_october_things_own_all') then
    CREATE POLICY "passport_october_things_own_all" ON "public"."passport_october_things" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_preferences' and policyname = 'passport_preferences_own_all') then
    CREATE POLICY "passport_preferences_own_all" ON "public"."passport_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_profiles' and policyname = 'passport_profiles_own_insert') then
    CREATE POLICY "passport_profiles_own_insert" ON "public"."passport_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_profiles' and policyname = 'passport_profiles_own_select') then
    CREATE POLICY "passport_profiles_own_select" ON "public"."passport_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_profiles' and policyname = 'passport_profiles_own_update') then
    CREATE POLICY "passport_profiles_own_update" ON "public"."passport_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passport_recently_viewed' and policyname = 'passport_recently_viewed_own_all') then
    CREATE POLICY "passport_recently_viewed_own_all" ON "public"."passport_recently_viewed" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  end if;
end $$;

-- ----------------------------------------------------------------- grants
--
-- `anon` receives no DML on any Passport table. `authenticated` receives only
-- what a person needs for their own rows, and RLS decides which those are.

GRANT ALL ON FUNCTION "public"."passport_board_role"("p_board_id" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."passport_describe_board_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."passport_describe_board_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."passport_is_board_member"("p_board_id" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."passport_redeem_board_invite"("p_token" "text") TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_board_invites" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."passport_board_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_board_invites" TO "service_role";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_board_members" TO "anon";
GRANT ALL ON TABLE "public"."passport_board_members" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_board_members" TO "service_role";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_events" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_events" TO "service_role";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_movie_reactions" TO "anon";
GRANT ALL ON TABLE "public"."passport_movie_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_movie_reactions" TO "service_role";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_october_things" TO "anon";
GRANT ALL ON TABLE "public"."passport_october_things" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_october_things" TO "service_role";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_preferences" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."passport_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_preferences" TO "service_role";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."passport_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_profiles" TO "service_role";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_recently_viewed" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."passport_recently_viewed" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_recently_viewed" TO "service_role";
