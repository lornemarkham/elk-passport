-- ROLLBACK for location-migration.sql. Drops ONLY the location table and its
-- functions/triggers. Every shared snow day, its plan, chat and photos stay.
-- Deleting this table deletes every position anyone is sharing right now.
DROP TRIGGER IF EXISTS passport_snow_locations_gone ON public.passport_adventure_members;
DROP TABLE IF EXISTS public.passport_snow_locations;
DROP FUNCTION IF EXISTS public.passport_snow_locations_purge(text);
DROP FUNCTION IF EXISTS public.passport_snow_locations_gone();
DROP FUNCTION IF EXISTS public.passport_snow_locations_guard();
DROP FUNCTION IF EXISTS public.passport_snow_is_sharing(text);
NOTIFY pgrst, 'reload schema';
