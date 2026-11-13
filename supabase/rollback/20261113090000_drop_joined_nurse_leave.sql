-- Rollback for 20261113090000_joined_nurse_leave.sql: joined nurses can no longer
-- remove their own access. Deploy Go without the leave route first.
BEGIN;
DROP POLICY IF EXISTS go_joined_shift_nurse_access_leave ON public.shift_nurse_access;
COMMIT;
