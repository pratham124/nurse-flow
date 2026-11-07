-- ROLLBACK for 20261107212029_account_deletion. Not a migration: it lives outside
-- supabase/migrations so the CLI never applies it by accident. It removes the
-- deletion function and puts the three foreign keys back to ON DELETE RESTRICT.
-- Accounts already deleted stay deleted. Production use: copy it into
-- supabase/migrations under a new timestamp (fix-forward), review, and apply.
BEGIN;

DROP FUNCTION go_private.delete_current_account();

ALTER TABLE public.nurse_request_messages
  DROP CONSTRAINT nurse_request_messages_author_profile_id_fkey,
  ADD CONSTRAINT nurse_request_messages_author_profile_id_fkey
    FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.manual_assignment_overrides
  DROP CONSTRAINT manual_assignment_overrides_created_by_profile_id_fkey,
  ADD CONSTRAINT manual_assignment_overrides_created_by_profile_id_fkey
    FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.optimizer_runs
  DROP CONSTRAINT optimizer_runs_requested_by_profile_id_fkey,
  ADD CONSTRAINT optimizer_runs_requested_by_profile_id_fkey
    FOREIGN KEY (requested_by_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

COMMIT;
