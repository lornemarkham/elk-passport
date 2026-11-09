# Release record 2026-11-09 (M653): GHAD + Snow Day, migration order and rollback

Candidate: the commit that adds this file (parent `122dc21`, which is `05feb38` plus the activity-migration fix).
Supersedes the candidate sha in `RELEASE-2026-11-08-GHAD-SNOW.md`. Plan: `~/forge/docs/RELEASE-2026-11-09-FOUR-PRODUCTS.md`.

## Pending on production (`frllwwxesxbmmaadzfaf`), in file order

1. `20261102000000_passport_date_nights.sql`
2. `20261102100000_passport_adventure_packing.sql`
3. `20261103000000_passport_snow.sql`
4. `20261108000000_passport_snow_activity.sql` (needs 3)

The runner applies them in one `psql --single-transaction`. None carries transaction control (checked with the
runner's own `migrationProblem` over all 12 files). Applying by hand: `psql --single-transaction -v ON_ERROR_STOP=1 -f`.
Owner runs `db-baseline` first, confirming only the eight files `20260927000000`..`20261101000000`.

## Rollback (run in a transaction; take the runner's recovery point first)

- Activity: `DELETE FROM public.passport_snow_proposals WHERE topic='activity';` then re-add the CHECK without `'activity'`.
- Snow: `docs/product/snow/shared-rollback.sql`.
- Packing: header of its file (`drop table`).
- Date Night:
  `DROP FUNCTION public.passport_date_night_setup, public.passport_date_night_answer(text, jsonb), public.passport_date_night_open(text);`
  (give `passport_date_night_setup` its full argument list) then
  `DROP TABLE public.passport_date_night_answers, public.passport_date_nights;`
