# Production database readiness — Passport release

**Project:** `frllwwxesxbmmaadzfaf` (shared with Atlas) · **Prepared:** 2026-10-21 from `integration/release` @ `b6f571a` · **Status:** prepared, **not run against production** (no production access from this checkout). Nothing here was applied, pushed, merged or deployed.

This document gives you **one read-only diagnostic** to paste into the Supabase SQL editor. It compares the live database with the migration files in this repository, grades every area `PASS` / `FAIL` / `REVIEW`, and names the exact repository file that fixes anything that is not `PASS`. It never fixes anything itself.

## 1. What the repository says must exist

| Area                | Source of truth in the repo                                                                           | Creates                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Passport baseline   | `supabase/migrations/20260927000000_passport_baseline.sql`                                            | 8 tables, 11 policies (+3 below), 4 functions                |
| Board ownership fix | `docs/product/group-adventures/boards-owner-claim-fix.sql` (the `ca20324` version, **not** `d1ba0be`) | replaces 3 policies, adds `passport_board_has_members(text)` |
| Conferences         | `supabase/migrations/20261012000000_passport_conferences.sql`                                         | 4 tables, 9 policies, 11 functions                           |
| Conference Arrivals | `supabase/migrations/20261014000000_passport_conference_arrivals.sql` (needs 20261012)                | 1 table, 2 policies, 3 functions                             |
| Conference grants   | `supabase/migrations/20261016000000_passport_conference_grants.sql` (needs 20261012 **and** 20261014) | grants only                                                  |
| Adventures / Saved  | `supabase/migrations/20261021000000_passport_adventures.sql`                                          | 8 tables, 24 policies, 9 functions, 5 triggers               |
| Hockey Night        | `docs/product/hockey/migration.sql` (**not** in `supabase/migrations/`; it is a proposed contract)    | 10 tables, 25 policies, 8 functions                          |

Facts that shape the checks:

- **Production applies no default table grants.** Every migration therefore states its grants. A missing `GRANT` shows up as `42501 permission denied` for every signed-in visitor (Conference crashed this way on 2026-10-16; Hockey is exposed to the same thing if it was migrated before commit `ee54cc4`).
- **The migration history belongs to Atlas.** Apply Passport SQL only through the SQL editor, never `supabase db push` (`supabase/README.md`). This also means `supabase_migrations.schema_migrations` tells you nothing about Passport, so the diagnostic ignores it and inspects the catalogs directly.
- Policy blocks in the 2026-10-12 → 10-21 files are _create-if-no-policy-with-that-name-exists_. Re-running a file adds missing objects but **will not replace a policy that has drifted**. The diagnostic flags drift as `REVIEW` for that reason.
- The Adventures migration has no hard dependency on another Passport migration (only `auth.users`, `auth.uid()`, `gen_random_uuid()`, `sha256()`). Its dependency is _sequencing_: `RELEASE.md` puts the board ownership fix first.
- `passport_board_interest` (read by the app) and `page_compositions` have **no migration in this repository**. They cannot be compared and are reported as `REVIEW`.

## 2. How the diagnostic works

- One `SELECT`. It reads `pg_class`, `pg_attribute`, `pg_policies`, `pg_proc`, `pg_trigger`, `pg_constraint`, `pg_default_acl` and `has_*_privilege()`. It contains no `INSERT`/`UPDATE`/`DELETE`/DDL/`GRANT`/`REVOKE`.
- The only reads of user data are four `count(*)` queries over the `passport_board_*` tables (the board ownership audit), run through `query_to_xml()` behind a `to_regclass()` guard. A missing table gives a `REVIEW` row, not an error. No tokens, ids or emails are printed.
- It **does not assume a table exists because of its name**. Every expected table is looked up in `pg_class` (`relkind` r/p, `public` schema); every function by exact name **and** argument signature; every policy by table + name + command. Anything absent is reported by name, and dependent checks are skipped (and counted as skipped) rather than erroring.
- The expected objects were **generated from the repository migrations**, not typed by hand: all seven files were applied to a scratch Postgres 17 (PGlite) with production's grant posture and then introspected. Column names and types, policy command + definition fingerprint, function signature / `SECURITY DEFINER` / `search_path` / body hash / EXECUTE grants, trigger names and table + column privileges were captured from that.
- Output columns: `status`, `group`, `check`, `detail`, `fix`. The first row is `OVERALL`. `FAIL` rows sort first, then `REVIEW`, then `PASS`. `fix` is filled only when the row is not `PASS`.

### What it checks per group

| Check                                                                    | Fails when                                                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| tables exist                                                             | any expected table is absent                                                                                                                  |
| columns exist with the repo types                                        | a column is absent or has another type (nullability, defaults and `CHECK`s are **not** compared)                                              |
| row level security enabled                                               | any present table has RLS off                                                                                                                 |
| anon holds no SELECT/INSERT/UPDATE/DELETE                                | `anon` can touch any Passport table                                                                                                           |
| authenticated has the table privileges the app needs                     | a required `SELECT`/`INSERT`/`DELETE` is missing (the 42501 case)                                                                             |
| authenticated UPDATE limited to the intended columns                     | a signed-in user can update a column the repo withholds (`role`, `host_id`, `uses`, `owner_id`, `member_id`…)                                 |
| authenticated UPDATE covers the columns the app edits                    | an intended column grant is missing                                                                                                           |
| authenticated has no unintended table-level privilege                    | `REVIEW`: extra DML (often means default grants are on)                                                                                       |
| policies exist with the repo command                                     | a policy is missing or has the wrong command                                                                                                  |
| policy definitions match the repo                                        | `REVIEW`: expression differs (older version, hand edit, or Postgres-version deparse noise)                                                    |
| no policies beyond the repo                                              | `REVIEW`: unknown policy on a Passport table                                                                                                  |
| functions exist / SECURITY DEFINER / search_path / EXECUTE grants / body | missing or `SECURITY DEFINER` flipped = `FAIL`; `anon` able to execute something the repo withholds = `FAIL`; config or body drift = `REVIEW` |
| triggers exist                                                           | any of the 5 Adventures triggers is absent                                                                                                    |

Named security checks on top: the three board policies (§3 below), no `INSERT`/`ALL` policy on `passport_adventures` or `passport_adventure_members`, the old lane-draft `passport_adventure_invites_owner_all` policy is gone, `passport_adventure_hockey` keeps its `kind = 'hockey-night'` guard, Arrivals' cascade foreign key to `passport_conference_members`, and the Hockey object counts (10 / 25 / 8) that `docs/product/hockey/verify.sql` uses.

## 3. Board ownership: what is checked

The two live holes (`group-adventures/README.md` §6) are detected from the **policy text itself**, so a stale `d1ba0be` fix (which closed hole 1 only) is caught:

| Row                                                                      | Passes when                                                                                                            |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `self_claim INSERT policy refuses boards that already have members`      | `with_check` contains `passport_board_has_members` and `board_owner_id = auth.uid()`                                   |
| `passport_board_members owner_writes pins board_owner_id`                | `with_check` contains `board_owner_id = auth.uid()`                                                                    |
| `passport_board_invites owner_writes pins board_owner_id and created_by` | `with_check` contains both                                                                                             |
| `only the three known … write policies exist`                            | no other `INSERT`/`UPDATE`/`ALL` policy on `passport_board_members` / `_invites`                                       |
| four `audit:` rows                                                       | each count is 0. A non-zero count is a possible past takeover: `REVIEW`, a human decision, and the fix deletes nothing |
| `info: owner rows total`                                                 | always `PASS`; a value near 0 confirms first shares were failing (`5f91b5c`)                                           |

The audit counts are the same predicates as `boards-ownership-audit.sql`, which is what lists the actual rows when a count is not 0.

## 4. The diagnostic SQL (copy-paste)

Supabase dashboard → project `frllwwxesxbmmaadzfaf` → **SQL editor** → new query → paste → **Run**. Save the output (export CSV) before and after each remediation step.

```sql
-- ============================================================================
-- PASSPORT — PRODUCTION DATABASE READINESS DIAGNOSTIC          (READ ONLY)
-- Project: frllwwxesxbmmaadzfaf          Generated against repo main @ integration/release
--
-- One SELECT statement. It reads system catalogs (pg_class, pg_policies,
-- pg_proc, pg_attribute, pg_trigger, has_*_privilege) and, for the board
-- ownership audit only, COUNTS rows in the three passport_board_* tables via
-- query_to_xml(), guarded so a missing table is reported, never an error.
-- It creates, alters, grants and locks nothing. It prints no tokens, emails,
-- user ids or other row data.
--
-- HOW TO READ IT
--   status   PASS    matches the repository migration exactly
--            FAIL    a required object / grant / policy is missing or unsafe
--            REVIEW  differs from the repo but needs a human decision
--                    (drift, extras, or something the repo cannot answer)
--   fix      the repository file that remediates a non-PASS row. Nothing is
--            applied for you. Follow the order in PRODUCTION-DATABASE-READINESS.md.
-- The first row is OVERALL. FAIL rows sort first.
-- ============================================================================
with
spec_tables(grp, tbl, cols, p_sel, p_ins, p_del, upd, ggrp, file, gfile, sev) as (values
  ('20261021','passport_adventure_days','adventure_id:text,on_day:date,ask:text,updated_by:uuid,updated_at:timestamp with time zone',true,true,true,'ask,updated_by','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('20261021','passport_adventure_hockey','adventure_id:text,puck_drop:timestamp with time zone,home_team:text,away_team:text,arena_atlas_ref:text,arena_label:text,updated_at:timestamp with time zone',true,true,true,'all','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('20261021','passport_adventure_invites','id:uuid,adventure_id:text,token_hash:text,label:text,max_uses:integer,uses:integer,expires_at:timestamp with time zone,revoked_at:timestamp with time zone,created_by:uuid,created_at:timestamp with time zone',true,true,true,'label,expires_at,revoked_at','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('20261021','passport_adventure_items','id:uuid,adventure_id:text,atlas_ref:text,label:text,note:text,status:text,on_day:date,starts_at:timestamp with time zone,position:integer,added_by:uuid,created_at:timestamp with time zone,updated_at:timestamp with time zone',true,true,true,'atlas_ref,label,note,status,on_day,starts_at,position','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('20261021','passport_adventure_members','adventure_id:text,user_id:uuid,member_id:text,role:text,display_name:text,visibility:text,joined_at:timestamp with time zone',true,false,true,'display_name,visibility','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('20261021','passport_adventure_removals','adventure_id:text,user_id:uuid,removed_at:timestamp with time zone',false,false,false,'none','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('20261021','passport_adventure_responses','item_id:uuid,adventure_id:text,user_id:uuid,response:text,answered_at:timestamp with time zone',true,true,true,'response,answered_at','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('20261021','passport_adventures','id:text,kind:text,title:text,owner_id:uuid,starts_on:date,ends_on:date,time_zone:text,destination_label:text,destination_town_id:text,created_at:timestamp with time zone,updated_at:timestamp with time zone',true,false,true,'title,starts_on,ends_on,time_zone,destination_label,destination_town_id','20261021','supabase/migrations/20261021000000_passport_adventures.sql','supabase/migrations/20261021000000_passport_adventures.sql','FAIL'),
  ('baseline','passport_board_invites','token:text,board_id:text,board_owner_id:uuid,role:text,created_by:uuid,created_at:timestamp with time zone,expires_at:timestamp with time zone,revoked_at:timestamp with time zone',true,true,false,'all','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW'),
  ('baseline','passport_board_members','board_id:text,board_owner_id:uuid,user_id:uuid,role:text,added_at:timestamp with time zone',true,true,true,'all','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW'),
  ('20261014','passport_conference_arrivals','conference_id:text,user_id:uuid,member_id:text,shared:boolean,record:jsonb,updated_at:timestamp with time zone',true,false,true,'none','20261016','supabase/migrations/20261014000000_passport_conference_arrivals.sql','supabase/migrations/20261016000000_passport_conference_grants.sql','FAIL'),
  ('20261012','passport_conference_codes','conference_id:text,code:text,code_key:text',true,true,true,'none','20261016','supabase/migrations/20261012000000_passport_conferences.sql','supabase/migrations/20261016000000_passport_conference_grants.sql','FAIL'),
  ('20261012','passport_conference_invites','token:text,conference_id:text,created_at:timestamp with time zone,expires_at:timestamp with time zone,revoked_at:timestamp with time zone,max_uses:integer,uses:integer',true,true,false,'revoked_at','20261016','supabase/migrations/20261012000000_passport_conferences.sql','supabase/migrations/20261016000000_passport_conference_grants.sql','FAIL'),
  ('20261012','passport_conference_members','conference_id:text,user_id:uuid,member_id:text,role:text,display_name:text,visibility:text,joined_at:timestamp with time zone,via:text',true,true,true,'display_name,visibility','20261016','supabase/migrations/20261012000000_passport_conferences.sql','supabase/migrations/20261016000000_passport_conference_grants.sql','FAIL'),
  ('20261012','passport_conferences','id:text,details:jsonb,created_by:uuid,retain_until:timestamp with time zone,created_at:timestamp with time zone,updated_at:timestamp with time zone',true,true,false,'details,retain_until,updated_at','20261016','supabase/migrations/20261012000000_passport_conferences.sql','supabase/migrations/20261016000000_passport_conference_grants.sql','FAIL'),
  ('baseline','passport_events','id:bigint,resource_type:text,resource_id:text,actor_id:uuid,kind:text,payload:jsonb,created_at:timestamp with time zone',true,true,false,'none','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW'),
  ('baseline','passport_movie_reactions','user_id:uuid,film_id:text,verdict:text,felt:text,got_me:text,reacted_at:timestamp with time zone',true,true,true,'all','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW'),
  ('hockey','passport_occasion_consents','occasion_id:uuid,prompt_id:text,user_id:uuid,agreed:boolean,at:timestamp with time zone',true,true,true,'all','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_cues','occasion_id:uuid,prompt_id:text,cued_by:uuid,cued_at:timestamp with time zone',true,true,true,'all','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_invites','id:uuid,occasion_id:uuid,token_hash:text,label:text,max_uses:integer,uses:integer,expires_at:timestamp with time zone,revoked_at:timestamp with time zone,created_by:uuid,created_at:timestamp with time zone',true,true,true,'label,expires_at,revoked_at','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_members','occasion_id:uuid,user_id:uuid,role:text,display_name:text,emoji:text,hue:smallint,vibe:text,edge:smallint,joined_at:timestamp with time zone',true,true,true,'display_name,emoji,hue,vibe,edge','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_moments','id:uuid,occasion_id:uuid,actor_id:uuid,kind:text,text:text,emoji:text,at:timestamp with time zone',true,true,true,'all','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_options','id:uuid,occasion_id:uuid,prompt_id:text,label:text,detail:text,place:jsonb,added_by:uuid,created_at:timestamp with time zone',true,true,true,'all','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_prompts','occasion_id:uuid,prompt_id:text,reveal:text,lock_offset_minutes:integer,audience_only:uuid,open_to_suggestions:boolean,asked_by:uuid,content:jsonb,resolution:jsonb,created_at:timestamp with time zone',true,true,true,'resolution','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_reactions','occasion_id:uuid,moment_id:uuid,emoji:text,user_id:uuid,at:timestamp with time zone',true,true,true,'all','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasion_responses','occasion_id:uuid,prompt_id:text,user_id:uuid,value:jsonb,answered_at:timestamp with time zone',true,true,true,'all','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('hockey','passport_occasions','id:uuid,template:text,title:text,starts_at:timestamp with time zone,host_id:uuid,details:jsonb,brief:jsonb,created_at:timestamp with time zone',true,true,true,'title,starts_at,details,brief','hockey','docs/product/hockey/migration.sql','docs/product/hockey/migration.sql','FAIL'),
  ('baseline','passport_october_things','user_id:uuid,entity_id:text,entity_kind:text,name:text,starts_at:timestamp with time zone,state:text,wanted_at:timestamp with time zone,lived_at:timestamp with time zone',true,true,true,'all','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW'),
  ('baseline','passport_preferences','user_id:uuid,key:text,value:jsonb,source:text,updated_at:timestamp with time zone',true,true,false,'all','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW'),
  ('baseline','passport_profiles','user_id:uuid,display_name:text,home_area:text,timezone:text,created_at:timestamp with time zone,updated_at:timestamp with time zone',true,true,false,'all','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW'),
  ('baseline','passport_recently_viewed','user_id:uuid,entity_id:text,viewed_at:timestamp with time zone',false,false,false,'none','baseline','supabase/migrations/20260927000000_passport_baseline.sql','supabase/migrations/20260927000000_passport_baseline.sql','REVIEW')
),
spec_policies(grp, tbl, pol, cmd, fp) as (values
  ('20261021','passport_adventure_days','passport_adventure_days_member_read','SELECT','600f608eaa2b408e00c3e7d9a4372803'),
  ('20261021','passport_adventure_days','passport_adventure_days_owner_clear','DELETE','ebee682cf49cecb3f269dbae9b84ecf3'),
  ('20261021','passport_adventure_days','passport_adventure_days_owner_plan','INSERT','7805d26f24f22d1efdd4d496c2abdb83'),
  ('20261021','passport_adventure_days','passport_adventure_days_owner_replan','UPDATE','1c2a3893107a68c3354c3d45a610b2d5'),
  ('20261021','passport_adventure_hockey','passport_adventure_hockey_member_read','SELECT','600f608eaa2b408e00c3e7d9a4372803'),
  ('20261021','passport_adventure_hockey','passport_adventure_hockey_owner_write','ALL','9114dd1bd474aa3f8c7899dfc15fcd1d'),
  ('20261021','passport_adventure_invites','passport_adventure_invites_owner_change','UPDATE','395f511ea84515ac48ce241e7d5e594d'),
  ('20261021','passport_adventure_invites','passport_adventure_invites_owner_create','INSERT','87ec21ae338a6e454523a06c3e95b156'),
  ('20261021','passport_adventure_invites','passport_adventure_invites_owner_delete','DELETE','ebee682cf49cecb3f269dbae9b84ecf3'),
  ('20261021','passport_adventure_invites','passport_adventure_invites_owner_read','SELECT','ebee682cf49cecb3f269dbae9b84ecf3'),
  ('20261021','passport_adventure_items','passport_adventure_items_change','UPDATE','7c3ecd3ea1a651f5e6d7ddbb089276f4'),
  ('20261021','passport_adventure_items','passport_adventure_items_member_propose','INSERT','93c01a5fd3b97dd5b5ac2d0795d1e723'),
  ('20261021','passport_adventure_items','passport_adventure_items_member_read','SELECT','600f608eaa2b408e00c3e7d9a4372803'),
  ('20261021','passport_adventure_items','passport_adventure_items_withdraw','DELETE','bef233b3dc89751ece8f563626963f96'),
  ('20261021','passport_adventure_members','passport_adventure_members_read','SELECT','0f1b1b34c7db4a9656103032637767c0'),
  ('20261021','passport_adventure_members','passport_adventure_members_remove','DELETE','37005c991b403838540efc2eebe54aec'),
  ('20261021','passport_adventure_members','passport_adventure_members_self_update','UPDATE','be276ad1c5668679a5f747cc827faac5'),
  ('20261021','passport_adventure_responses','passport_adventure_responses_member_read','SELECT','600f608eaa2b408e00c3e7d9a4372803'),
  ('20261021','passport_adventure_responses','passport_adventure_responses_own_change','UPDATE','9c876fe15d5225e5915a91f44213b121'),
  ('20261021','passport_adventure_responses','passport_adventure_responses_own_delete','DELETE','786680e0970476ac54330bfe8f3e4d66'),
  ('20261021','passport_adventure_responses','passport_adventure_responses_own_write','INSERT','b000543b3e15ed715b9fe281e93d4614'),
  ('20261021','passport_adventures','passport_adventures_member_read','SELECT','445d17f6917e3c4e0d0d2b2799f76c59'),
  ('20261021','passport_adventures','passport_adventures_owner_delete','DELETE','7efba39e53a6be5954db663a3f39b945'),
  ('20261021','passport_adventures','passport_adventures_owner_update','UPDATE','6f05b97b5f71f9297a0e36bf35b2850b'),
  ('baseline','passport_board_invites','passport_board_invites_members_read','SELECT','5c05bd381bb69b0eeeaf46b0a4416b89'),
  ('board-fix','passport_board_invites','passport_board_invites_owner_writes','ALL','72b1500b6111c14ef9a76d9a14b4ab39'),
  ('board-fix','passport_board_members','passport_board_members_owner_writes','ALL','d94fac4dea69325188d3fdc91b60d6ef'),
  ('board-fix','passport_board_members','passport_board_members_self_claim','INSERT','c0ce2503f1d401180459dbd710de0dd3'),
  ('baseline','passport_board_members','passport_board_members_visible','SELECT','5c05bd381bb69b0eeeaf46b0a4416b89'),
  ('20261014','passport_conference_arrivals','passport_conference_arrivals_delete','DELETE','17c5f4530477541c9c0fb4ab3908d738'),
  ('20261014','passport_conference_arrivals','passport_conference_arrivals_read','SELECT','6207bf59d03f723f4865e6b7fcfe4a54'),
  ('20261012','passport_conference_codes','passport_conference_codes_organiser','ALL','06bfe5526b785688ef84498c9da060e7'),
  ('20261012','passport_conference_invites','passport_conference_invites_organiser','ALL','06bfe5526b785688ef84498c9da060e7'),
  ('20261012','passport_conference_members','passport_conference_members_found','INSERT','72ff43819da8e4dff07a55fe81ef2c5e'),
  ('20261012','passport_conference_members','passport_conference_members_leave','DELETE','17c5f4530477541c9c0fb4ab3908d738'),
  ('20261012','passport_conference_members','passport_conference_members_read','SELECT','abdfb929e01c25678d36819c1c99c3a9'),
  ('20261012','passport_conference_members','passport_conference_members_self_update','UPDATE','be276ad1c5668679a5f747cc827faac5'),
  ('20261012','passport_conferences','passport_conferences_create','INSERT','519ddb037ea4e35a05e0475e2b09f4f1'),
  ('20261012','passport_conferences','passport_conferences_organiser_update','UPDATE','1830650d32da782222727f3431a113ab'),
  ('20261012','passport_conferences','passport_conferences_read','SELECT','09eed42ad9cee358cba3cbd0c32e900b'),
  ('baseline','passport_events','passport_events_member_read','SELECT','22a9d089e6243f688761ad68e9fb564c'),
  ('baseline','passport_events','passport_events_member_write','INSERT','2225189f3044caba9f07dd4c086b8da8'),
  ('baseline','passport_movie_reactions','passport_movie_reactions_own_all','ALL','7715a00bd42d9b45386da58495664402'),
  ('hockey','passport_occasion_consents','passport_occasion_consents_own','ALL','f41d13818d71394396a74d3671519e7d'),
  ('hockey','passport_occasion_cues','passport_occasion_cues_open','INSERT','e41469fb6913499e246ca10fefb05058'),
  ('hockey','passport_occasion_cues','passport_occasion_cues_read','SELECT','d0608b6cf66c1acb22cc8d2180deb320'),
  ('hockey','passport_occasion_invites','passport_occasion_invites_host_all','ALL','356b342a8a76515a9ba2b5565682e828'),
  ('hockey','passport_occasion_members','passport_occasion_members_read','SELECT','d0608b6cf66c1acb22cc8d2180deb320'),
  ('hockey','passport_occasion_members','passport_occasion_members_remove','DELETE','7a01db0e33e0a8f0c3155098523c4a24'),
  ('hockey','passport_occasion_members','passport_occasion_members_self_update','UPDATE','be276ad1c5668679a5f747cc827faac5'),
  ('hockey','passport_occasion_moments','passport_occasion_moments_read','SELECT','d0608b6cf66c1acb22cc8d2180deb320'),
  ('hockey','passport_occasion_moments','passport_occasion_moments_say','INSERT','34fdc75919d1f0232c9e399f6a715a9e'),
  ('hockey','passport_occasion_moments','passport_occasion_moments_unsay','DELETE','de452546c2516b2b9f9f9d04c0cab034'),
  ('hockey','passport_occasion_options','passport_occasion_options_read','SELECT','d0608b6cf66c1acb22cc8d2180deb320'),
  ('hockey','passport_occasion_options','passport_occasion_options_suggest','INSERT','6456c9fa1b45371c4fff7d1b0998baa0'),
  ('hockey','passport_occasion_options','passport_occasion_options_withdraw','DELETE','9f63f93178b258c3afb410c79394a7ab'),
  ('hockey','passport_occasion_prompts','passport_occasion_prompts_ask','INSERT','8ccfcc6ca91d5a19e39b0fe6c48d0c4e'),
  ('hockey','passport_occasion_prompts','passport_occasion_prompts_read','SELECT','5629ae87a1a332675f4b6706400ca5de'),
  ('hockey','passport_occasion_prompts','passport_occasion_prompts_resolve','UPDATE','1361f94a50728cd84b0935e2f0aa627d'),
  ('hockey','passport_occasion_reactions','passport_occasion_reactions_own','INSERT','e3cf1c176b56c0b6cc6adcc6a1a3cdc7'),
  ('hockey','passport_occasion_reactions','passport_occasion_reactions_read','SELECT','d0608b6cf66c1acb22cc8d2180deb320'),
  ('hockey','passport_occasion_reactions','passport_occasion_reactions_unreact','DELETE','786680e0970476ac54330bfe8f3e4d66'),
  ('hockey','passport_occasion_responses','passport_occasion_responses_answer','INSERT','5dd29576a269a8df30737ccbe1a448d7'),
  ('hockey','passport_occasion_responses','passport_occasion_responses_change','UPDATE','605dd075ca9322e68ae88586e0e9678b'),
  ('hockey','passport_occasion_responses','passport_occasion_responses_read','SELECT','3c55ee2cb7ca9f251d87e32ce9b9e628'),
  ('hockey','passport_occasions','passport_occasions_host_delete','DELETE','8fe1369b1403374edae35902b7da714d'),
  ('hockey','passport_occasions','passport_occasions_host_update','UPDATE','e7ee91fe6476fe55de55eaa40fa8ae7c'),
  ('hockey','passport_occasions','passport_occasions_member_read','SELECT','848c4462f556ced12df8e3dadc19d314'),
  ('baseline','passport_october_things','passport_october_things_own_all','ALL','7715a00bd42d9b45386da58495664402'),
  ('baseline','passport_preferences','passport_preferences_own_all','ALL','7715a00bd42d9b45386da58495664402'),
  ('baseline','passport_profiles','passport_profiles_own_insert','INSERT','2067eab54bcc052ffeb95cca26918f68'),
  ('baseline','passport_profiles','passport_profiles_own_select','SELECT','c060873b48a27f12dc1357ddf11d9f8f'),
  ('baseline','passport_profiles','passport_profiles_own_update','UPDATE','7715a00bd42d9b45386da58495664402'),
  ('baseline','passport_recently_viewed','passport_recently_viewed_own_all','ALL','7715a00bd42d9b45386da58495664402')
),
spec_funcs(grp, fn, args, secdef, cfg, body, anon_x, auth_x, file, is_base) as (values
  ('20261021','passport_adventure_item_adventure','p_item uuid',true,'search_path=public','f2a9594c26d270b947a2f9beadc9e5f1',false,true,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('20261021','passport_adventure_member_gone','',true,'search_path=public','42ef769e2a8aec322722242dfe2802a2',false,false,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('20261021','passport_adventure_role','p_adventure text',true,'search_path=public','c58e176562c2e5949a79bcc83ae23561',false,true,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('20261021','passport_adventure_touch','',false,'','2087ee763cae5a840d5f9851ac4e1eb8',false,false,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('board-fix','passport_board_has_members','p_board_id text',true,'search_path=public','3124d2f4c0ed9361e0b60b6db84a817d',false,true,'docs/product/group-adventures/boards-owner-claim-fix.sql',false),
  ('baseline','passport_board_role','p_board_id text, p_user_id uuid',true,'search_path=public','22442cae484e9d41e3765e270e0a7252',false,true,'supabase/migrations/20260927000000_passport_baseline.sql',true),
  ('20261014','passport_conference_arrivals_save','p_conference text, p_record jsonb',true,'search_path=public, pg_temp','e781e55b48fd83ccc2195a005ea89181',false,true,'supabase/migrations/20261014000000_passport_conference_arrivals.sql',false),
  ('20261014','passport_conference_arrivals_tracking_ok','t jsonb',false,'search_path=public, pg_temp','3ef57fe9eed3b34a48cf2ce8d8ecf15f',false,true,'supabase/migrations/20261014000000_passport_conference_arrivals.sql',false),
  ('20261014','passport_conference_arrivals_visible','p_conference text, p_user uuid',true,'search_path=public, pg_temp','f123c65c4a46882511e6cf4e3f19db49',false,true,'supabase/migrations/20261014000000_passport_conference_arrivals.sql',false),
  ('20261012','passport_conference_code_taken','p_code text',true,'search_path=public','47ccb7343d470faad1e47bb58a798d17',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_describe_invite','p_token text',true,'search_path=public','91e70782f526251bc9b5c65ab6169052',true,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_expired','',true,'search_path=public','6250049dd7c2e7d25439fe8d1dda03c5',true,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_has_members','p_conference text',true,'search_path=public','d82f7c23ccf040e0940a3fce4ead020a',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_headcount','p_conference text',true,'search_path=public','678959ee32ce8f8134d824af4dfe67d3',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_is_member','p_conference text',true,'search_path=public','51ca77cd0c4f53c835eaa660bcc90bf1',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_is_organiser','p_conference text',true,'search_path=public','73e853e0903d2f7fc0646445187ce163',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_redeem_code','p_code text, p_member_id text',true,'search_path=public','d0ebe892a4ca9ad1a106071ff56783ef',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_redeem_invite','p_token text, p_member_id text',true,'search_path=public','b9d8e2de11f34bd3cab8222032c7d80b',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_remove','p_conference text',true,'search_path=public','18ebebcbcec629f9ba5ab6accf78004b',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261012','passport_conference_role','p_conference text',true,'search_path=public','2987a9c329dc2e20a4aa8b36f7c3cc0f',false,true,'supabase/migrations/20261012000000_passport_conferences.sql',false),
  ('20261021','passport_create_adventure','p_kind text, p_title text, p_display_name text, p_starts_on date, p_ends_on date, p_time_zone text, p_destination_label text, p_destination_town_id text',true,'search_path=public','e9f94d0b9ee7614aaabb3edd0ce4c8e2',false,true,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('hockey','passport_create_occasion','p_template text, p_title text, p_starts_at timestamp with time zone, p_details jsonb, p_display_name text, p_emoji text, p_hue smallint, p_prompts jsonb',true,'search_path=public','9ea869ad62b4d079cda018829ae47d6e',false,true,'docs/product/hockey/migration.sql',false),
  ('20261021','passport_describe_adventure_invite','p_token text',true,'search_path=public','9e8fc561ad28d8013824383aae91dac5',true,true,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('baseline','passport_describe_board_invite','p_token text',true,'search_path=public','70426a89ae7c4187b2a3a51b951c6622',true,true,'supabase/migrations/20260927000000_passport_baseline.sql',true),
  ('hockey','passport_describe_occasion_invite','p_token text',true,'search_path=public','8c3d67084658fba21bd7908a75bb1041',true,true,'docs/product/hockey/migration.sql',false),
  ('20261021','passport_is_adventure_member','p_adventure text',true,'search_path=public','987de6f8ff30ae2da038384c7edc7076',false,true,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('20261021','passport_is_adventure_owner','p_adventure text',true,'search_path=public','5e7dedf22135c034253faee4e002d366',false,true,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('baseline','passport_is_board_member','p_board_id text, p_user_id uuid',true,'search_path=public','c0506ac56a2b342d36e2c6b3ec356e7d',false,true,'supabase/migrations/20260927000000_passport_baseline.sql',true),
  ('hockey','passport_is_occasion_member','p_occasion uuid, p_user uuid',true,'search_path=public','4663b3e0945777ed4e8355d156e54caf',false,true,'docs/product/hockey/migration.sql',false),
  ('hockey','passport_occasion_answer_visible','p_occasion uuid, p_prompt text, p_author uuid, p_viewer uuid',true,'search_path=public','d6a5947e5876868a94af5c6e1420465e',false,true,'docs/product/hockey/migration.sql',false),
  ('hockey','passport_occasion_prompt_locked','p_occasion uuid, p_prompt text',true,'search_path=public','e3a4a76c466bb43be1170464369dd804',false,true,'docs/product/hockey/migration.sql',false),
  ('hockey','passport_occasion_prompt_visible','p_occasion uuid, p_audience uuid, p_asked_by uuid, p_viewer uuid',true,'search_path=public','06bde203aa8e0c823aa7a384408aee29',false,true,'docs/product/hockey/migration.sql',false),
  ('hockey','passport_occasion_role','p_occasion uuid, p_user uuid',true,'search_path=public','d221e242e0155b4101b3e08affc7a2d2',false,true,'docs/product/hockey/migration.sql',false),
  ('20261021','passport_redeem_adventure_invite','p_token text, p_display_name text, p_visibility text',true,'search_path=public','0778cef428125d9e8ec988110de1a6c8',false,true,'supabase/migrations/20261021000000_passport_adventures.sql',false),
  ('baseline','passport_redeem_board_invite','p_token text',true,'search_path=public','2d868506cd6c598f633ba67262ef202f',false,true,'supabase/migrations/20260927000000_passport_baseline.sql',true),
  ('hockey','passport_redeem_occasion_invite','p_token text, p_display_name text, p_emoji text, p_hue smallint',true,'search_path=public','043a80f3ddb6fc1460619649e76bf448',false,true,'docs/product/hockey/migration.sql',false)
),
spec_trg(grp, tbl, tg) as (values
  ('20261021','passport_adventures','passport_adventures_touch'),
  ('20261021','passport_adventure_members','passport_adventure_members_gone'),
  ('20261021','passport_adventure_items','passport_adventure_items_touch'),
  ('20261021','passport_adventure_days','passport_adventure_days_touch'),
  ('20261021','passport_adventure_hockey','passport_adventure_hockey_touch')
),
grp_meta(grp, ord, label) as (values
  ('env', 0, 'environment'),
  ('baseline', 1, '20260927 baseline'),
  ('board-fix', 2, 'board ownership fix'),
  ('20261012', 3, '20261012 conferences'),
  ('20261014', 4, '20261014 conference arrivals'),
  ('20261016', 5, '20261016 conference grants'),
  ('20261021', 6, '20261021 adventures'),
  ('hockey', 7, 'Hockey Night (docs/product/hockey)'),
  ('other', 8, 'other tables the app reads')
),
-- ---------------------------------------------------------------- actual facts
tx as (
  select s.*, c.oid as relid, coalesce(c.relrowsecurity, false) as rls
  from spec_tables s
  left join pg_class c on c.relname = s.tbl
   and c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
),
tp as (
  select tx.*,
    case when relid is null then null else array_remove(array[
      case when p_sel and not has_table_privilege('authenticated', relid, 'SELECT') then 'SELECT' end,
      case when p_ins and not has_table_privilege('authenticated', relid, 'INSERT') then 'INSERT' end,
      case when p_del and not has_table_privilege('authenticated', relid, 'DELETE') then 'DELETE' end
    ], null) end as miss_priv,
    case when relid is null then null else array_remove(array[
      case when not p_sel and has_table_privilege('authenticated', relid, 'SELECT') then 'SELECT' end,
      case when not p_ins and has_table_privilege('authenticated', relid, 'INSERT') then 'INSERT' end,
      case when not p_del and has_table_privilege('authenticated', relid, 'DELETE') then 'DELETE' end
    ], null) end as extra_priv,
    case when relid is null then null else (
         has_table_privilege('anon', relid, 'SELECT') or has_table_privilege('anon', relid, 'INSERT')
      or has_table_privilege('anon', relid, 'UPDATE') or has_table_privilege('anon', relid, 'DELETE')) end as anon_dml,
    array(select a.attname::text from pg_attribute a
          where a.attrelid = tx.relid and a.attnum > 0 and not a.attisdropped
            and has_column_privilege('authenticated', tx.relid, a.attnum, 'UPDATE')
          order by a.attnum) as upd_have,
    case tx.upd
      when 'all' then array(select a.attname::text from pg_attribute a
                            where a.attrelid = tx.relid and a.attnum > 0 and not a.attisdropped order by a.attnum)
      when 'none' then '{}'::text[]
      else string_to_array(tx.upd, ',') end as upd_want
  from tx
),
cx as (
  select tp.grp, tp.tbl, tp.file, e.col, e.typ,
         format_type(a.atttypid, a.atttypmod) as have
  from tp
  cross join lateral (
    select split_part(x, ':', 1) as col, split_part(x, ':', 2) as typ
    from unnest(string_to_array(tp.cols, ',')) x) e
  left join pg_attribute a on a.attrelid = tp.relid and a.attname = e.col
   and a.attnum > 0 and not a.attisdropped
  where tp.relid is not null
),
px as (
  select sp.*, st.relid, pp.cmd as have_cmd, (pp.policyname is not null) as there,
    md5(regexp_replace(coalesce(pp.qual, '') || '|' || coalesce(pp.with_check, '') || '|' || pp.roles::text || '|' || pp.permissive, '\s+', ' ', 'g')) as have_fp,
    pp.with_check as have_check
  from spec_policies sp
  join tx st on st.tbl = sp.tbl
  left join pg_policies pp on pp.schemaname = 'public' and pp.tablename = sp.tbl and pp.policyname = sp.pol
),
fx as (
  select sf.*, p.oid as foid, p.prosecdef as have_sd,
    coalesce(array_to_string(p.proconfig, ';'), '') as have_cfg,
    md5(p.prosrc) as have_body,
    case when p.oid is null then null else has_function_privilege('anon', p.oid, 'EXECUTE') end as have_anon,
    case when p.oid is null then null else has_function_privilege('authenticated', p.oid, 'EXECUTE') end as have_auth
  from spec_funcs sf
  left join pg_proc p on p.proname = sf.fn and p.pronamespace = 'public'::regnamespace
   and pg_get_function_identity_arguments(p.oid) = sf.args
),
-- --------------------------------------------------------------------- checks
checks(grp, check_name, status, detail, fix) as (

  -- ===== environment ======================================================
  select 'env', 'Postgres >= 15', case when current_setting('server_version_num')::int >= 150000 then 'PASS' else 'FAIL' end,
         current_setting('server_version'), 'Supabase dashboard: upgrade the project'
  union all
  select 'env', 'roles anon / authenticated exist',
         case when (select count(*) from pg_roles where rolname in ('anon', 'authenticated')) = 2 then 'PASS' else 'FAIL' end,
         coalesce((select string_agg(rolname, ', ') from pg_roles where rolname in ('anon', 'authenticated')), 'none'),
         'Not a Supabase project, or roles dropped. Stop and escalate.'
  union all
  select 'env', 'auth.users and auth.uid() present',
         case when to_regclass('auth.users') is not null and to_regprocedure('auth.uid()') is not null then 'PASS' else 'FAIL' end,
         (to_regclass('auth.users') is not null)::text || ' / ' || (to_regprocedure('auth.uid()') is not null)::text,
         'Supabase Auth schema missing. Stop and escalate.'
  union all
  select 'env', 'gen_random_uuid() and sha256(bytea) available',
         case when to_regprocedure('gen_random_uuid()') is not null and to_regprocedure('sha256(bytea)') is not null then 'PASS' else 'FAIL' end,
         (to_regprocedure('gen_random_uuid()') is not null)::text || ' / ' || (to_regprocedure('sha256(bytea)') is not null)::text,
         'Needed by 20261021 and Hockey. Stop and escalate.'
  union all
  -- Informational: the repo's migrations state every grant outright because
  -- production does NOT apply Supabase's default table privileges (see
  -- 20261016 header). If defaults are present the grant checks below are
  -- weaker evidence, because privileges may come from the defaults.
  select 'env', 'default privileges on new public tables (posture)',
         case when exists (select 1 from pg_default_acl d where d.defaclnamespace = 'public'::regnamespace
                             and d.defaclobjtype = 'r' and d.defaclacl::text ~ '(anon|authenticated)=')
              then 'REVIEW' else 'PASS' end,
         coalesce((select string_agg(d.defaclrole::regrole::text || ' -> ' || d.defaclacl::text, '; ')
                   from pg_default_acl d where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'),
                  'none (production posture: every grant must be stated)'),
         'Informational. Default grants present means a missing GRANT could be masked on this project but not on a fresh one.'

  -- ===== tables, columns, RLS: per migration group ========================
  union all
  select grp, 'tables exist',
         case when count(*) filter (where relid is null) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where relid is null) = 0 then count(*) || ' of ' || count(*) || ' present'
              else 'MISSING ' || count(*) filter (where relid is null) || ' of ' || count(*) || ': '
                   || string_agg(tbl, ', ' order by tbl) filter (where relid is null) end,
         min(file)
  from tx group by grp
  union all
  select grp, 'columns exist with the repo types',
         case when count(*) filter (where have is distinct from typ) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where have is distinct from typ) = 0
              then count(*) || ' columns across ' || count(distinct tbl) || ' present tables'
              else left(string_agg(tbl || '.' || col || ' (want ' || typ || ', have ' || coalesce(have, 'ABSENT') || ')', '; ' order by tbl, col)
                        filter (where have is distinct from typ), 900) end,
         min(file)
  from cx group by grp
  union all
  select grp, 'row level security enabled',
         case when count(*) filter (where relid is not null and not rls) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where relid is not null and not rls) = 0
              then count(*) filter (where relid is not null) || ' present tables all have RLS'
              else 'RLS OFF on: ' || string_agg(tbl, ', ' order by tbl) filter (where relid is not null and not rls) end,
         min(file)
  from tx group by grp
  union all
  select grp, 'anon holds no SELECT/INSERT/UPDATE/DELETE',
         case when count(*) filter (where anon_dml) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where anon_dml) = 0 then 'none of ' || count(*) filter (where relid is not null) || ' present tables'
              else 'anon can touch: ' || string_agg(tbl, ', ' order by tbl) filter (where anon_dml) end,
         min(file)
  from tp group by grp

  -- ===== grants to authenticated (reported under the file that states them)
  union all
  select ggrp, 'authenticated has the table privileges the app needs',
         case when count(*) filter (where cardinality(miss_priv) > 0) = 0 then 'PASS' else min(sev) end,
         case when count(*) filter (where cardinality(miss_priv) > 0) = 0
              then count(*) filter (where relid is not null) || ' present tables ok'
              else left('permission denied (42501) for signed-in users on: ' || string_agg(tbl || ' lacks ' || array_to_string(miss_priv, '+'), '; ' order by tbl)
                        filter (where cardinality(miss_priv) > 0), 900) end,
         min(case when grp = 'hockey' then 'docs/product/hockey/fix-grants.sql (tables exist) — else the creating migration' else gfile end)
  from tp group by ggrp
  union all
  select ggrp, 'authenticated has no unintended table-level privilege',
         case when count(*) filter (where cardinality(extra_priv) > 0) = 0 then 'PASS' else 'REVIEW' end,
         case when count(*) filter (where cardinality(extra_priv) > 0) = 0 then 'none'
              else left(string_agg(tbl || ' also has ' || array_to_string(extra_priv, '+'), '; ' order by tbl)
                        filter (where cardinality(extra_priv) > 0), 900) end,
         'Compare with the REVOKE lines in ' || min(gfile) || '. Default grants may be in effect.'
  from tp group by ggrp
  union all
  select ggrp, 'authenticated UPDATE limited to the intended columns',
         case when count(*) filter (where relid is not null and exists (select 1 from unnest(upd_have) c where c <> all (upd_want))) = 0
              then 'PASS' else min(sev) end,
         case when count(*) filter (where relid is not null and exists (select 1 from unnest(upd_have) c where c <> all (upd_want))) = 0
              then 'no table lets a signed-in user rewrite a column the repo withholds'
              else left('TOO WIDE: ' || string_agg(tbl || ' may update ' || (select string_agg(c, ',') from unnest(upd_have) c where c <> all (upd_want)), '; ' order by tbl)
                        filter (where relid is not null and exists (select 1 from unnest(upd_have) c where c <> all (upd_want))), 900) end,
         'Narrow with the REVOKE UPDATE / GRANT UPDATE (cols) lines in ' || min(file) || ' (re-run it, it is idempotent)'
  from tp group by ggrp
  union all
  select ggrp, 'authenticated UPDATE covers the columns the app edits',
         case when count(*) filter (where relid is not null and exists (select 1 from unnest(upd_want) c where c <> all (upd_have))) = 0
              then 'PASS' else min(sev) end,
         case when count(*) filter (where relid is not null and exists (select 1 from unnest(upd_want) c where c <> all (upd_have))) = 0
              then 'ok'
              else left('CANNOT UPDATE: ' || string_agg(tbl || '.' || (select string_agg(c, ',') from unnest(upd_want) c where c <> all (upd_have)), '; ' order by tbl)
                        filter (where relid is not null and exists (select 1 from unnest(upd_want) c where c <> all (upd_have))), 900) end,
         min(case when grp = 'hockey' then 'docs/product/hockey/fix-grants.sql' else gfile end)
  from tp group by ggrp

  -- ===== policies ==========================================================
  union all
  select grp, 'policies exist with the repo command',
         case when count(*) filter (where relid is not null and (not there or have_cmd is distinct from cmd)) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where relid is not null and (not there or have_cmd is distinct from cmd)) = 0
              then count(*) filter (where relid is not null) || ' of ' || count(*) filter (where relid is not null) || ' present'
                   || case when count(*) filter (where relid is null) > 0 then ' (' || count(*) filter (where relid is null) || ' skipped: table missing)' else '' end
              else left('MISSING/WRONG: ' || string_agg(tbl || '.' || pol || case when there then ' (cmd ' || have_cmd || ', want ' || cmd || ')' else '' end, '; ' order by tbl, pol)
                        filter (where relid is not null and (not there or have_cmd is distinct from cmd)), 900) end,
         min(case grp when 'board-fix' then 'docs/product/group-adventures/boards-owner-claim-fix.sql'
                      else (select file from spec_tables t where t.grp = px.grp limit 1) end)
  from px group by grp
  union all
  select grp, 'policy definitions match the repo (fingerprint)',
         case when count(*) filter (where there and have_fp <> fp) = 0 then 'PASS' else 'REVIEW' end,
         case when count(*) filter (where there and have_fp <> fp) = 0 then 'all present policies identical'
              else left('DIFFER: ' || string_agg(tbl || '.' || pol, '; ' order by tbl, pol) filter (where there and have_fp <> fp)
                        || '. Could be an older version, a hand edit, or Postgres-version deparse noise: read pg_policies for these.', 900) end,
         case grp when 'board-fix' then 'docs/product/group-adventures/boards-owner-claim-fix.sql (DROP + CREATE: replaces these policies)'
                  else 'Read the live definition first. Policy blocks in ' || (select file from spec_tables t where t.grp = px.grp limit 1)
                       || ' are skip-if-exists: a re-run will NOT replace a drifted policy; drop it by hand, then re-run.' end
  from px group by grp
  union all
  select st.grp, 'no policies beyond the repo on these tables',
         case when count(pp.policyname) = 0 then 'PASS' else 'REVIEW' end,
         case when count(pp.policyname) = 0 then 'none' else left(string_agg(pp.tablename || '.' || pp.policyname, '; ' order by pp.tablename, pp.policyname), 900) end,
         'Unknown policy on a Passport table: find who added it before release'
  from spec_tables st
  left join pg_policies pp on pp.schemaname = 'public' and pp.tablename = st.tbl
   and not exists (select 1 from spec_policies sp where sp.tbl = pp.tablename and sp.pol = pp.policyname)
  group by st.grp

  -- ===== functions =========================================================
  union all
  select grp, 'functions exist (exact signature)',
         case when count(*) filter (where foid is null) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where foid is null) = 0 then count(*) || ' of ' || count(*) || ' present'
              else 'MISSING: ' || string_agg(fn || '(' || args || ')', '; ' order by fn) filter (where foid is null) end,
         min(file)
  from fx group by grp
  union all
  select grp, 'SECURITY DEFINER as in the repo',
         case when count(*) filter (where foid is not null and have_sd <> secdef) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where foid is not null and have_sd <> secdef) = 0 then 'ok'
              else string_agg(fn, ', ' order by fn) filter (where foid is not null and have_sd <> secdef) end,
         min(file)
  from fx group by grp
  union all
  select grp, 'function search_path / config as in the repo',
         case when count(*) filter (where foid is not null and have_cfg <> cfg) = 0 then 'PASS' else 'REVIEW' end,
         case when count(*) filter (where foid is not null and have_cfg <> cfg) = 0 then 'ok'
              else left(string_agg(fn || ' (have "' || have_cfg || '", want "' || cfg || '")', '; ' order by fn) filter (where foid is not null and have_cfg <> cfg), 900) end,
         min(file)
  from fx group by grp
  union all
  select grp, 'function EXECUTE grants (anon / authenticated)',
         case when count(*) filter (where foid is not null and (have_anon is distinct from anon_x or have_auth is distinct from auth_x)) = 0 then 'PASS'
              when bool_and(is_base) filter (where foid is not null and (have_anon is distinct from anon_x or have_auth is distinct from auth_x)) then 'REVIEW'
              else 'FAIL' end,
         case when count(*) filter (where foid is not null and (have_anon is distinct from anon_x or have_auth is distinct from auth_x)) = 0 then 'ok'
              else left(string_agg(fn || ': anon ' || have_anon || ' (want ' || anon_x || '), authenticated ' || have_auth || ' (want ' || auth_x || ')', '; ' order by fn)
                        filter (where foid is not null and (have_anon is distinct from anon_x or have_auth is distinct from auth_x)), 900) end,
         case grp when 'baseline' then 'No repo file revokes PUBLIC EXECUTE on the baseline helpers. See readiness doc, finding R1 (proposal only).'
                  else 'Re-run ' || min(file) || ' (REVOKE/GRANT lines are idempotent)' end
  from fx group by grp
  union all
  select grp, 'function bodies identical to the repo',
         case when count(*) filter (where foid is not null and have_body <> body) = 0 then 'PASS' else 'REVIEW' end,
         case when count(*) filter (where foid is not null and have_body <> body) = 0 then 'all present functions identical'
              else left('DIFFER: ' || string_agg(fn, ', ' order by fn) filter (where foid is not null and have_body <> body), 900) end,
         'An older version is live. CREATE OR REPLACE FUNCTION in ' || min(file) || ' replaces bodies (additive); read the live body first.'
  from fx group by grp

  -- ===== triggers ==========================================================
  union all
  select g.grp, 'triggers exist',
         case when count(*) filter (where tr.oid is null) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where tr.oid is null) = 0 then count(*) || ' of ' || count(*) || ' present'
              else 'MISSING: ' || string_agg(g.tbl || '.' || g.tg, '; ') filter (where tr.oid is null) end,
         (select file from spec_tables t where t.grp = g.grp limit 1)
  from spec_trg g
  left join pg_class c on c.relname = g.tbl and c.relnamespace = 'public'::regnamespace
  left join pg_trigger tr on tr.tgrelid = c.oid and tr.tgname = g.tg and not tr.tgisinternal
  group by g.grp

  -- ===== board ownership (security) ========================================
  union all
  select 'board-fix', 'self_claim INSERT policy refuses boards that already have members',
         case when pp.policyname is null then 'FAIL'
              when pp.with_check ~ 'passport_board_has_members' and pp.with_check ~ 'board_owner_id\s*=\s*\(?(select\s+)?auth\.uid\(\)' then 'PASS' else 'FAIL' end,
         case when pp.policyname is null then 'policy passport_board_members_self_claim not found'
              when pp.with_check ~ 'passport_board_has_members' then 'pins board_owner_id = auth.uid() and requires an empty board'
              else 'OLD POLICY LIVE: any signed-in user can insert an owner row for ANY board id (README §6 hole 1)' end,
         'docs/product/group-adventures/boards-owner-claim-fix.sql'
  from (select 1) x left join pg_policies pp on pp.schemaname = 'public' and pp.tablename = 'passport_board_members' and pp.policyname = 'passport_board_members_self_claim'
  union all
  select 'board-fix', 'passport_board_members owner_writes pins board_owner_id',
         case when pp.policyname is not null and pp.with_check ~ 'board_owner_id\s*=\s*\(?(select\s+)?auth\.uid\(\)' then 'PASS' else 'FAIL' end,
         case when pp.policyname is null then 'policy not found'
              when pp.with_check ~ 'board_owner_id\s*=\s*\(?(select\s+)?auth\.uid\(\)' then 'with_check pins board_owner_id'
              else 'OLD POLICY LIVE: an owner can repoint a row at someone else (README §6 hole 2)' end,
         'docs/product/group-adventures/boards-owner-claim-fix.sql'
  from (select 1) x left join pg_policies pp on pp.schemaname = 'public' and pp.tablename = 'passport_board_members' and pp.policyname = 'passport_board_members_owner_writes'
  union all
  select 'board-fix', 'passport_board_invites owner_writes pins board_owner_id and created_by',
         case when pp.policyname is not null and pp.with_check ~ 'board_owner_id\s*=\s*\(?(select\s+)?auth\.uid\(\)' and pp.with_check ~ 'created_by\s*=\s*\(?(select\s+)?auth\.uid\(\)' then 'PASS' else 'FAIL' end,
         case when pp.policyname is null then 'policy not found'
              when pp.with_check ~ 'created_by' and pp.with_check ~ 'board_owner_id' then 'with_check pins both'
              else 'OLD POLICY LIVE: an owner can mint an invite naming someone else as board owner' end,
         'docs/product/group-adventures/boards-owner-claim-fix.sql'
  from (select 1) x left join pg_policies pp on pp.schemaname = 'public' and pp.tablename = 'passport_board_invites' and pp.policyname = 'passport_board_invites_owner_writes'
  union all
  select 'board-fix', 'only the three known board-member/invite write policies exist',
         case when count(*) = 0 then 'PASS' else 'REVIEW' end,
         coalesce(string_agg(tablename || '.' || policyname || ' [' || cmd || ']', '; '), 'none'),
         'An extra INSERT/UPDATE/ALL policy on passport_board_members or _invites can re-open the hole'
  from pg_policies where schemaname = 'public' and tablename in ('passport_board_members', 'passport_board_invites')
    and cmd in ('INSERT', 'UPDATE', 'ALL')
    and policyname not in ('passport_board_members_self_claim', 'passport_board_members_owner_writes', 'passport_board_invites_owner_writes')
  union all
  -- Data audit: counts only (docs/product/group-adventures/boards-ownership-audit.sql lists the rows).
  select 'board-fix', a.name, case when a.n is null then 'REVIEW' when a.n = 0 then 'PASS' else 'REVIEW' end,
         case when a.n is null then 'table(s) missing, cannot audit'
              when a.n = 0 then '0' else a.n || ' — treat as possible disclosure; run boards-ownership-audit.sql for the rows. The fix deletes nothing; revoking/deleting is a human decision.' end,
         'docs/product/group-adventures/boards-ownership-audit.sql'
  from (values
    ('audit: owner rows naming someone else', case when to_regclass('public.passport_board_members') is null then null else
       (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members where role = ''owner'' and board_owner_id <> user_id', false, true, '')))[1]::text::bigint end),
    ('audit: member rows whose board_owner_id is not that board''s owner', case when to_regclass('public.passport_board_members') is null then null else
       (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members m where m.role <> ''owner'' and not exists (select 1 from public.passport_board_members o where o.board_id = m.board_id and o.role = ''owner'' and o.user_id = m.board_owner_id)', false, true, '')))[1]::text::bigint end),
    ('audit: invites naming someone else', case when to_regclass('public.passport_board_invites') is null or to_regclass('public.passport_board_members') is null then null else
       (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites i where i.board_owner_id <> i.created_by or not exists (select 1 from public.passport_board_members o where o.board_id = i.board_id and o.role = ''owner'' and o.user_id = i.created_by)', false, true, '')))[1]::text::bigint end),
    ('audit: boards with more than one owner row', case when to_regclass('public.passport_board_members') is null then null else
       (xpath('/row/c/text()', query_to_xml('select count(*) as c from (select board_id from public.passport_board_members where role = ''owner'' group by board_id having count(*) > 1) z', false, true, '')))[1]::text::bigint end)
  ) as a(name, n)
  union all
  select 'board-fix', 'info: owner rows total (near 0 = first-share bug 5f91b5c never exercised)',
         'PASS',
         case when to_regclass('public.passport_board_members') is null then 'table missing'
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members where role = ''owner''', false, true, '')))[1]::text end,
         null

  -- ===== conference arrivals dependency ===================================
  union all
  select '20261014', 'FK arrivals -> conference_members (member leaves, flight erased)',
         case when exists (select 1 from pg_constraint k
                           where k.contype = 'f' and k.conrelid = to_regclass('public.passport_conference_arrivals')
                             and k.confrelid = to_regclass('public.passport_conference_members') and k.confdeltype = 'c') then 'PASS' else 'FAIL' end,
         case when to_regclass('public.passport_conference_arrivals') is null then 'arrivals table missing' else 'ON DELETE CASCADE foreign key from arrivals to members' end,
         'supabase/migrations/20261014000000_passport_conference_arrivals.sql (needs 20261012 first)'

  -- ===== adventures (security) ============================================
  union all
  select '20261021', 'no INSERT/ALL policy on passport_adventures or _members (only the RPCs create them)',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(tablename || '.' || policyname || ' [' || cmd || ']', '; '), 'none'),
         'Drop the policy by hand after reading it: anyone could otherwise write themselves a membership.'
  from pg_policies where schemaname = 'public' and tablename in ('passport_adventures', 'passport_adventure_members') and cmd in ('INSERT', 'ALL')
  union all
  select '20261021', 'old lane-draft policy passport_adventure_invites_owner_all is gone',
         case when exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'passport_adventure_invites_owner_all') then 'FAIL' else 'PASS' end,
         'present means an owner cannot revoke a link once anybody has used it',
         'supabase/migrations/20261021000000_passport_adventures.sql (contains DROP POLICY IF EXISTS for it)'
  union all
  select '20261021', 'passport_adventure_removals has RLS and no policy (deny-all except the definer function)',
         case when to_regclass('public.passport_adventure_removals') is null then 'FAIL'
              when exists (select 1 from pg_policies where tablename = 'passport_adventure_removals') then 'REVIEW' else 'PASS' end,
         case when to_regclass('public.passport_adventure_removals') is null then 'table missing' else 'checked' end,
         'supabase/migrations/20261021000000_passport_adventures.sql'
  union all
  select '20261021', 'passport_adventure_hockey kind guard (WITH CHECK a.kind = ''hockey-night'')',
         case when exists (select 1 from pg_policies where tablename = 'passport_adventure_hockey' and policyname = 'passport_adventure_hockey_owner_write' and with_check ~ 'hockey-night') then 'PASS' else 'FAIL' end,
         case when to_regclass('public.passport_adventure_hockey') is null then 'table missing' else 'owner_write policy checked' end, 'supabase/migrations/20261021000000_passport_adventures.sql'

  -- ===== hockey: same counts as docs/product/hockey/verify.sql =============
  union all
  select 'hockey', 'counts match verify.sql (10 tables / 25 policies / 8 functions)',
         case when (select count(*) from pg_tables where schemaname = 'public' and tablename like 'passport\_occasion%') = 10
               and (select count(*) from pg_policies where policyname like 'passport\_occasion%') = 25
               and (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and proname like 'passport\_%occasion%') = 8
              then 'PASS' else 'FAIL' end,
         (select count(*) from pg_tables where schemaname = 'public' and tablename like 'passport\_occasion%') || ' tables / '
           || (select count(*) from pg_policies where policyname like 'passport\_occasion%') || ' policies / '
           || (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and proname like 'passport\_%occasion%') || ' functions',
         'docs/product/hockey/preflight.sql -> migration.sql -> verify.sql'

  -- ===== other tables the app reads, with no migration in this repo ========
  union all
  select 'other', 'passport_board_interest (app reads it; NO migration in this repo)',
         'REVIEW',
         case when to_regclass('public.passport_board_interest') is null
              then 'MISSING. The board "interested" mark answers "can''t be recorded yet" until it exists. The migration travelled in an integration report, not in supabase/migrations/.'
              else 'EXISTS (not verifiable against the repo). RLS on: ' || (select relrowsecurity::text from pg_class where oid = to_regclass('public.passport_board_interest'))
                   || '; policies: ' || coalesce((select string_agg(policyname || ' [' || cmd || ']', ', ') from pg_policies where tablename = 'passport_board_interest'), 'NONE')
                   || '; anon DML: ' || (has_table_privilege('anon', to_regclass('public.passport_board_interest'), 'SELECT')
                                          or has_table_privilege('anon', to_regclass('public.passport_board_interest'), 'INSERT'))::text end,
         'Contracts lane must supply and commit a migration (docs/domain/integration-contracts.md). Not blocking.'
  union all
  select 'other', 'page_compositions (app reads it; documented as never existing)',
         'REVIEW',
         case when to_regclass('public.page_compositions') is null then 'missing, as supabase/README.md hazard 2 records: curator compositions fall back to defaults'
              else 'EXISTS — not in this repo' end,
         'None. Known, accepted.'
)
select status, "group", "check", detail, fix
from (
  select 'OVERALL' as status, '' as "group", 'READINESS' as "check",
         case when count(*) filter (where status = 'FAIL') > 0 then 'NOT READY: ' else
              case when count(*) filter (where status = 'REVIEW') > 0 then 'READY PENDING REVIEW: ' else 'READY: ' end end
         || count(*) filter (where status = 'FAIL') || ' FAIL, '
         || count(*) filter (where status = 'REVIEW') || ' REVIEW, '
         || count(*) filter (where status = 'PASS') || ' PASS' as detail,
         null::text as fix, -1 as o1, 0 as o2
  from checks
  union all
  select c.status, m.label, c.check_name, c.detail,
         case when c.status = 'PASS' then null else c.fix end,
         case c.status when 'FAIL' then 0 when 'REVIEW' then 1 else 2 end, m.ord
  from checks c join grp_meta m on m.grp = c.grp
) r
order by o1, o2, "group", "check";
```

## 5. Expected results

### 5.1 After everything is applied (the target)

```
OVERALL  READINESS   READY PENDING REVIEW: 0 FAIL, 3 REVIEW, 103 PASS
```

Zero `FAIL` is the release gate. The three expected `REVIEW` rows are all known and none is a blocker:

| `REVIEW` row                                  | Why it is expected                                                                                                                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260927 baseline` · function EXECUTE grants | `anon` can execute `passport_board_role`, `passport_is_board_member`, `passport_redeem_board_invite` because the baseline never revokes `PUBLIC` EXECUTE (finding **R1**). Disappears if production's ACLs already exclude `anon`; 2 `REVIEW` rows then |
| `other` · `passport_board_interest`           | No migration in this repo (finding **R2**). If the table is missing, boards show "can't be recorded yet"                                                                                                                                                |
| `other` · `page_compositions`                 | Documented as never existing (`supabase/README.md` hazard 2); curator composition falls back to defaults                                                                                                                                                |

Any _other_ `REVIEW` after remediation (policy fingerprint drift, unknown policy, extra privilege, body differs) needs a human reading the live definition before release.

### 5.2 Per-area expectation, and what a failure means

| Area                             | `PASS` means                                                                                                                                                                                                                                      | Typical `FAIL` and its fix file                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hockey Night**                 | 10 tables, 71 columns, 25 policies, 8 functions, RLS on all, `authenticated` holds the DML in the grants block, no column UPDATE on `members.role`, `occasions.host_id`, `invites.uses`, `anon` executes only `passport_describe_occasion_invite` | tables missing → `docs/product/hockey/preflight.sql` → `migration.sql` → `verify.sql`. Tables present but `authenticated lacks SELECT+INSERT+DELETE` → `docs/product/hockey/fix-grants.sql`     |
| **Adventures** 20261021          | 8 tables, 60 columns, 24 policies, 9 functions, 5 triggers; no `INSERT` policy on `passport_adventures`/`_members`; `invites_owner_all` absent; `anon` has nothing                                                                                | tables/functions/triggers missing, or `invites_owner_all` present → re-run `supabase/migrations/20261021000000_passport_adventures.sql` (idempotent, ends with `NOTIFY pgrst, 'reload schema'`) |
| **Conference core** 20261012     | 4 tables, 9 policies, 11 functions; `anon` executes only `describe_invite` and `expired()`                                                                                                                                                        | `supabase/migrations/20261012000000_passport_conferences.sql`                                                                                                                                   |
| **Conference Arrivals** 20261014 | `passport_conference_arrivals`, cascade FK to members, 3 functions, 2 policies                                                                                                                                                                    | table missing (`audit 2026-10-21`: it was) → `supabase/migrations/20261014000000_passport_conference_arrivals.sql`                                                                              |
| **Conference grants** 20261016   | `authenticated` has `SELECT/INSERT` (+`DELETE` where stated) on the 5 conference tables and no wider UPDATE                                                                                                                                       | `42501` → `supabase/migrations/20261016000000_passport_conference_grants.sql` **after** 20261012 and 20261014                                                                                   |
| **Board ownership**              | the three policy rows `PASS`, four audit counts 0                                                                                                                                                                                                 | `docs/product/group-adventures/boards-owner-claim-fix.sql`                                                                                                                                      |

### 5.3 What the recovery audit (2026-10-21) predicts you will see on first run

Not verified; taken from `docs/release/AGENT-WORK-RECOVERY-AUDIT.md` and `docs/product/vancouver/RELEASE-2026-10-19.md`. Use it to sanity-check, not to skip the run.

- `board ownership fix`: 3 × `FAIL` "OLD POLICY LIVE" + `passport_board_has_members` missing (fix "ready, urgent; not applied").
- `20261014 conference arrivals`: `FAIL`, table and functions missing (an anon probe showed it absent).
- `20261016 conference grants`: `FAIL` on 42501 for the arrivals table at least; possibly all five.
- `20261021 adventures`: 8 tables, 9 functions, 5 triggers `FAIL` (not applied).
- `Hockey`: tables present; grants unknown. `FAIL` on "authenticated has the table privileges" if migrated before `ee54cc4`.

### 5.4 How the diagnostic itself was tested

Run against scratch Postgres 17 (PGlite) built from the repo's own files, **not** against production:

| Scenario                                                                                                                                     | Result                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| All seven files applied                                                                                                                      | `READY PENDING REVIEW: 0 FAIL, 3 REVIEW, 103 PASS` (the three rows above)                               |
| Baseline + Conferences + Hockey, no grants, no board fix, no Arrivals/Adventures                                                             | `NOT READY: 16 FAIL` — board holes, Arrivals/Adventures missing, 42501 rows with the correct fix files  |
| Baseline only                                                                                                                                | `NOT READY: 17 FAIL`, every other area reported missing by name, no SQL error                           |
| Everything applied, then default grants on, one policy dropped, `invites_owner_all` and an `INSERT` policy added, one forged board owner row | `FAIL`s for anon DML, too-wide UPDATE, missing/extra policies; `REVIEW` for the board row; no SQL error |
| Whole script inside `BEGIN READ ONLY`                                                                                                        | runs, 107 rows                                                                                          |

Caveat: the local scenario is Postgres 17; production's major version is not known from here (the script checks it is ≥ 15). Policy fingerprints come from `pg_policies` text, which can deparse differently across major versions. That is why a fingerprint mismatch is `REVIEW`, never `FAIL`.

## 6. Required remediation order

Do each step in the SQL editor, re-run the diagnostic after each, and stop at any step whose result is not what its row says. **Take a database backup/point-in-time marker first** (Supabase dashboard → Database → Backups) so a rollback target exists.

| #   | Step                                                                                                                | Run (in this order)                                                                                                                                                                                           | Re-run diagnostic: expect                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Baseline reading                                                                                                    | the diagnostic; save output                                                                                                                                                                                   | records the real state                                                                                                                                          |
| 1   | **Board ownership** (security; do first, alone). Execution package: `docs/release/board-ownership-repair/README.md` | `docs/product/group-adventures/boards-ownership-audit.sql` (read-only; keep output) → `docs/product/group-adventures/boards-owner-claim-fix.sql` (one transaction, idempotent, deletes nothing) → audit again | `board ownership fix` all `PASS`. Any audit finding: a **separate human decision** (revoke the invites, delete the rows named, treat those boards as disclosed) |
| 2   | **Hockey Night** (date-bound: the game is Sun 25 Oct; per the audit, before Fri 23 Oct)                             | _tables missing:_ `preflight.sql` (all `OK`) → `migration.sql` → `verify.sql` (all `OK`). _Tables present, grants missing:_ `fix-grants.sql` → `verify.sql`. All in `docs/product/hockey/`                    | `Hockey Night` all `PASS`                                                                                                                                       |
| 3   | **Conference core** (only if the diagnostic says missing)                                                           | `supabase/migrations/20261012000000_passport_conferences.sql`                                                                                                                                                 | `20261012 conferences` all `PASS`                                                                                                                               |
| 4   | **Conference Arrivals**                                                                                             | `supabase/migrations/20261014000000_passport_conference_arrivals.sql`                                                                                                                                         | `20261014` all `PASS`                                                                                                                                           |
| 5   | **Conference grants**                                                                                               | `supabase/migrations/20261016000000_passport_conference_grants.sql`                                                                                                                                           | `20261016` all `PASS`                                                                                                                                           |
| 6   | **Adventures / Saved**                                                                                              | `supabase/migrations/20261021000000_passport_adventures.sql`                                                                                                                                                  | `20261021 adventures` all `PASS`                                                                                                                                |
| 7   | Final reading                                                                                                       | the diagnostic                                                                                                                                                                                                | `0 FAIL`; only the three known `REVIEW`s                                                                                                                        |

Why this order:

- **Board first**: live takeover hole; `RELEASE.md` sequences Adventures after it, and the fix is the smallest change.
- **Hockey next** because it is date-bound and independent of everything below.
- **20261014 before 20261016 is mandatory.** The grants file does a plain `GRANT … ON passport_conference_arrivals`. The editor submits a script as one multi-statement request (one implicit transaction), so on a project without the table the whole grants file errors with `42P01` and **none** of its grants apply.
- **Adventures last**: no other step depends on it; it is the only step with a new surface.

Outside SQL, and not covered by the diagnostic (do not skip): reload PostgREST's schema cache if a new table 404s (the Adventures file ends with `NOTIFY pgrst, 'reload schema'`; the other files do not, so run `NOTIFY pgrst, 'reload schema';` once after the last step); production env `CONFERENCE_STORE=supabase`, `CONFERENCE_ARRIVALS=on` (or off until step 4–5 pass); Supabase Auth redirect allow-list and SMTP for Hockey (`docs/product/hockey/PRODUCTION-READINESS.md` B2–B3); then `docs/product/group-adventures/verification/prod-isolation.mjs --i-mean-production [--adventures]` with two test accounts.

## 7. Findings from preparing this (decisions for a human)

**R1 — Baseline helper functions are probably executable by `anon`.** `20260927` ends with `GRANT ALL ON FUNCTION … TO authenticated` but never `REVOKE … FROM PUBLIC`, so Postgres' default `PUBLIC` EXECUTE stands. Applied to a scratch database, `anon` can execute all four baseline functions. `passport_board_role(board, user)` and `passport_is_board_member(board, user)` take an arbitrary user id, so a signed-out caller can ask "is user X on board Y, and as what". Low severity (needs both ids) but it contradicts the model the later migrations state. The diagnostic reports it as `REVIEW` (it cannot tell whether production's ACLs differ). **There is no repo file for it.** A proposal, unreviewed and untested on any real project, for you to decide on:

```sql
-- PROPOSAL ONLY — not in the repo, not applied.
revoke execute on function public.passport_board_role(text, uuid) from anon, public;
revoke execute on function public.passport_is_board_member(text, uuid) from anon, public;
revoke execute on function public.passport_redeem_board_invite(text) from anon, public;
-- passport_describe_board_invite(text) must stay executable by anon (a link is read while signed out).
-- authenticated already holds an explicit GRANT on all of these.
```

**R2 — `passport_board_interest` has no migration anywhere in this repo.** `src/lib/data/boards-interest-server.ts` documents it as "proposed, not yet migrated"; the migration "travels in the integration report". The app degrades to "can't be recorded yet". Not a release blocker, but the contracts lane owes a committed migration.

**R3 — Hockey's migration is not in `supabase/migrations/`.** It lives in `docs/product/hockey/` as a proposed contract. The diagnostic treats it as the source of truth because it is what `verify.sql` and `PRODUCTION-READINESS.md` apply. Moving it is a shared-contract change for `passport-domain`/integration, not done here.

**R4 — Hockey and Adventures overlap by design but not by schema.** `passport_adventure_hockey` (20261021) is an extension table of the new core; Hockey's live nights use `passport_occasion_*`. ADR 009 says they converge later. Nothing to remediate; do not read a passing Adventures check as meaning Hockey nights live in Adventures.

**R5 — The diagnostic does not compare** `CHECK` constraints, defaults, nullability, indexes, unique constraints, `service_role` grants, Realtime publications or table ownership. Columns are compared by name and type only. The Arrivals foreign key is the only constraint checked. Compare with `verify.sql` (Hockey) and the per-file "Read-only checks" in `docs/product/group-adventures/RELEASE.md` if you need more.

## 8. Risks and rollback

None of these have been run against production. Rollbacks that are not repo files are written from the migrations' object lists and should be reviewed before use.

| Step                | Risk                                                                                                                                                                                                              | Rollback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnostic          | Takes brief catalog reads; no locks beyond those. The `count(*)` reads touch only the board tables                                                                                                                | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1 Board fix         | Replaces three policies and adds one function in one transaction. If a client still runs the pre-`5f91b5c` upsert, first shares on empty boards stay refused (they already are). It can only tighten              | Re-run the three policy statements from the baseline after `DROP POLICY` on each (**re-opens both holes**; only if genuine sharing breaks). Then `drop function public.passport_board_has_members(text);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2 Hockey            | `migration.sql` only adds `passport_occasion*` objects and alters nothing that existed. `fix-grants.sql` only grants (additive, idempotent)                                                                       | `docs/product/hockey/disable.sql` first (stops new nights and joins, deletes nothing). `rollback.sql` drops all 10 tables and 8 functions and **deletes every Hockey Night**; it refuses to run while any occasion exists unless you uncomment its `set local` line. Export first. Un-granting (the reverse `REVOKE`) re-creates the 42501 crash for signed-in users: do not                                                                                                                                                                                                                                                                                                                                                                  |
| 3 Conference core   | Adds 4 tables and 11 functions; touches no existing object                                                                                                                                                        | No repo rollback. Only before anyone has a conference: `drop table public.passport_conference_arrivals, public.passport_conference_invites, public.passport_conference_members, public.passport_conference_codes, public.passport_conferences cascade;` and drop the 11 `passport_conference_*` functions by signature                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4 Arrivals          | Adds 1 table, 3 functions. Conference data already in production is not touched                                                                                                                                   | `drop table public.passport_conference_arrivals;` `drop function public.passport_conference_arrivals_save(text, jsonb), public.passport_conference_arrivals_tracking_ok(jsonb), public.passport_conference_arrivals_visible(text, uuid);` Flights are lost. Alternatively set `CONFERENCE_ARRIVALS` off, which keeps the table                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5 Conference grants | Grants only; additive                                                                                                                                                                                             | Reverse `REVOKE`s would re-break `/conferences` for every signed-in visitor. Do not roll back; fix forward                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6 Adventures        | Adds 8 tables, 9 functions, 5 triggers. Idempotent. No data exists yet. **If the app ships before this step** (the Forge runner auto-ships `integration/release`) nothing breaks: every adventure API answers 503 | `RELEASE.md`: only before anyone uses it, drop the 8 tables in reverse dependency order (`passport_adventure_hockey`, `_days`, `_responses`, `_items`, `_removals`, `_invites`, `_members`, `passport_adventures`) and the 9 `passport_*adventure*` functions: `passport_create_adventure(text, text, text, date, date, text, text, text)`, `passport_describe_adventure_invite(text)`, `passport_redeem_adventure_invite(text, text, text)`, `passport_adventure_role(text)`, `passport_is_adventure_member(text)`, `passport_is_adventure_owner(text)`, `passport_adventure_item_adventure(uuid)`, `passport_adventure_member_gone()`, `passport_adventure_touch()`. Once users have adventures, dropping deletes their data (export first) |

General risks:

- **Shared project.** Atlas owns the rest of `public`. Every Passport object is named `passport_*` (and `page_compositions`/`boards`/`board_items` are Atlas's); nothing here touches Atlas tables. Never `supabase db push`.
- **Re-running does not repair drift.** A `REVIEW` fingerprint row means a policy differs; the guarded re-run will leave it. Read the live policy, decide, drop it by hand, re-run.
- **The editor's role is `postgres`**, which bypasses RLS and sees every grant; the diagnostic asks about `anon`/`authenticated` explicitly with `has_*_privilege()`, so its answers are about those roles, not about you.
- **A `PASS` is not an attack test.** The isolation proof is `prod-isolation.mjs` with two real accounts (step 5 of `group-adventures/RELEASE.md`), which has not been run.
