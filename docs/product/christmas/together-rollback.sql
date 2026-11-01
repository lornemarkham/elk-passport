-- ROLLBACK for together-migration.sql (lane christmas, 2026-11-01).
-- Removes announcements and shared memories, and EVERYTHING people shared in
-- them — photos included. Export first if anything should be kept:
--   select * from public.passport_adventure_moments;
-- The adventure core is untouched. Christmas keeps working; it says sharing
-- is not switched on.
DROP TABLE IF EXISTS public.passport_adventure_notice_acks;
DROP TABLE IF EXISTS public.passport_adventure_notices;
DROP TABLE IF EXISTS public.passport_adventure_moments;
DROP FUNCTION IF EXISTS public.passport_adventure_notice_adventure(uuid);
